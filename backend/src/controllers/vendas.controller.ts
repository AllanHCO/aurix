import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { invalidatePrefix } from '../services/cache.service';
import { getUploadsRootDir } from '../config/env';

import { prisma } from '../lib/prisma';

/** Retorna o ID da categoria de entrada "Vendas" (cria se não existir). Usar dentro de tx. */
async function getOrCreateVendasCategory(
  tx: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>,
  usuarioId: string
): Promise<string> {
  let cat = await tx.financialCategory.findFirst({
    where: { usuario_id: usuarioId, type: 'income', name: 'Vendas' }
  });
  if (!cat) {
    cat = await tx.financialCategory.create({
      data: { usuario_id: usuarioId, name: 'Vendas', type: 'income' }
    });
  }
  return cat.id;
}

/** Gera código único YYYYMMDDHHmmssSSS (17 dígitos). Usar apenas no servidor. */
function generateSaleCode(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${y}${m}${d}${h}${min}${s}${ms}`;
}

/** Cache de idempotência: chave -> { statusCode, body, createdAt }. TTL 60s. */
const IDEMPOTENCY_TTL_MS = 60_000;
const idempotencyCache = new Map<string, { statusCode: number; body: unknown; createdAt: number }>();

function purgeExpiredIdempotency() {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache.entries()) {
    if (now - entry.createdAt > IDEMPOTENCY_TTL_MS) idempotencyCache.delete(key);
  }
}

const itemVendaSchema = z.object({
  produto_id: z.string().uuid('ID do produto inválido'),
  quantidade: z.union([z.number(), z.string()]).transform(val => Number(val)).pipe(z.number().int().positive('Quantidade deve ser positiva')),
  preco_unitario: z.union([z.number(), z.string()]).transform(val => Number(val)).pipe(z.number().positive('Preço unitário deve ser positivo'))
});

const itemServicoSchema = z.object({
  produto_id: z.string().uuid().optional().nullable(),
  descricao: z.string().min(1, 'Descrição do serviço é obrigatória').max(500),
  quantidade: z.union([z.number(), z.string()]).transform(val => Number(val)).pipe(z.number().int().min(1)).default(1),
  valor_unitario: z.union([z.number(), z.string()]).transform(val => Number(val)).pipe(z.number().min(0))
});

const vendaSchema = z.object({
  tipo: z.enum(['sale', 'quote', 'service_order']).default('sale'),
  cliente_id: z.string().uuid('ID do cliente inválido'),
  client_extra_item_id: z.string().uuid().optional().nullable(),
  business_area_id: z.string().uuid().optional().nullable(),
  itens: z.array(itemVendaSchema).default([]),
  servicos: z.array(itemServicoSchema).optional().default([]),
  desconto_percentual: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val))
    .pipe(
      z
        .number()
        .min(-100, 'Use entre -100% (acréscimo) e 100% (desconto)')
        .max(100, 'Use entre -100% e 100%')
    )
    .default(0),
  forma_pagamento: z.string().min(1).optional().nullable(),
  status: z.enum(['PAGO', 'PENDENTE', 'PARCIAL', 'ORCAMENTO']).default('PENDENTE'),
  agendamento_id: z.string().uuid().optional(),
  // Ordem de Serviço
  os_status: z.enum(['ABERTA', 'EM_EXECUCAO', 'CONCLUIDA']).optional(),
  problema_relatado: z.string().max(10000).optional().nullable(),
  observacoes_tecnicas: z.string().max(10000).optional().nullable(),
  texto_garantia: z.string().max(2000).optional().nullable(),
  os_agradecimento: z.string().max(2000).optional().nullable(),
  aceite_por: z.string().max(200).optional().nullable()
}).refine(
  (data) => data.tipo !== 'sale' || (data.forma_pagamento != null && String(data.forma_pagamento).length > 0),
  { message: 'Forma de pagamento é obrigatória para venda direta', path: ['forma_pagamento'] }
).refine(
  // Venda direta (tipo=sale) também pode ser feita apenas com serviços (sem produtos),
  // mantendo "quote" com regra antiga (exige itens/produtos).
  (data) =>
    data.tipo === 'quote'
      ? data.itens.length >= 1
      : data.itens.length >= 1 || (data.servicos?.length ?? 0) >= 1,
  { message: 'Adicione pelo menos um item (peça) ou um serviço.', path: ['itens'] }
);

type ItemVendaParsed = { produto_id: string; quantidade: number; preco_unitario: number };

/** Consolida itens com mesmo produto_id: soma quantidades e usa o primeiro preco_unitario. */
function consolidarItens(itens: ItemVendaParsed[]): ItemVendaParsed[] {
  const map = new Map<string, { quantidade: number; preco_unitario: number }>();
  for (const item of itens) {
    const cur = map.get(item.produto_id);
    if (!cur) {
      map.set(item.produto_id, { quantidade: item.quantidade, preco_unitario: item.preco_unitario });
    } else {
      cur.quantidade += item.quantidade;
    }
  }
  return Array.from(map.entries()).map(([produto_id, v]) => ({
    produto_id,
    quantidade: v.quantidade,
    preco_unitario: v.preco_unitario
  }));
}

const PAGE_SIZE_OPTIONS = [10, 50, 100] as const;

function parsePageSize(value: unknown): number {
  const n = parseInt(String(value), 10);
  return PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number]) ? n : 10;
}

export const listarVendas = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const status = req.query.status as string | undefined;
  const tipoFilter = req.query.tipo as string | undefined; // 'sale' | 'quote' | undefined (todos)
  const statusFilter = ['PENDENTE', 'PAGO', 'PARCIAL', 'FECHADA', 'ORCAMENTO', 'CANCELADO'].includes(status ?? '')
    ? status
    : undefined;
  const q = ((req.query.q ?? req.query.searchTerm) as string)?.trim();
  const startDate = (req.query.startDate as string)?.trim();
  const endDate = (req.query.endDate as string)?.trim();

  const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const pageSize = parsePageSize(req.query.pageSize ?? req.query.limit);
  const skip = (page - 1) * pageSize;

  const businessAreaId = (req.query.business_area_id ?? req.query.areaId) as string | undefined;

  const where: Prisma.VendaWhereInput = {
    usuario_id: userId,
    ...(tipoFilter === 'sale' && { tipo: 'sale' }),
    ...(tipoFilter === 'quote' && { tipo: 'quote' }),
    ...(tipoFilter === 'service_order' && { tipo: 'service_order' }),
    ...(statusFilter && { status: statusFilter as Prisma.EnumVendaStatusFilter }),
    ...(businessAreaId && businessAreaId.length > 0 && { business_area_id: businessAreaId })
  };
  if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) || endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    where.createdAt = {};
    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      (where.createdAt as Prisma.DateTimeFilter).gte = new Date(startDate + 'T00:00:00.000Z');
    }
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      (where.createdAt as Prisma.DateTimeFilter).lte = new Date(endDate + 'T23:59:59.999Z');
    }
  }
  if (q && q.length >= 1) {
    where.OR = [
      { sale_code: { contains: q, mode: 'insensitive' } },
      { os_code: { contains: q, mode: 'insensitive' } },
      { cliente: { nome: { contains: q, mode: 'insensitive' } } },
      ...(q.replace(/\D/g, '').length >= 2 ? [{ cliente: { telefone: { contains: q } } }] : [])
    ];
  }

  const [items, totalItems] = await Promise.all([
    prisma.venda.findMany({
      where,
      include: {
        cliente: { select: { nome: true } },
        client_extra_item: { select: { id: true, title: true, type: true } },
        business_area: { select: { id: true, name: true, color: true } },
        itens: { include: { produto: { select: { nome: true } } } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    }),
    prisma.venda.count({ where })
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  res.json({
    items,
    totalItems,
    totalPages,
    page,
    pageSize
  });
};

export const obterVenda = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;

  const venda = await prisma.venda.findFirst({
    where: {
      id,
      usuario_id: userId
    },
    include: {
      cliente: true,
      client_extra_item: true,
      business_area: true,
      itens: { include: { produto: true } },
      servicos: true,
      // IMPORTANTE: a tabela de anexos pode não existir em bancos legados.
      // O modal já carrega anexos por endpoint separado e trata erro; assim,
      // evitamos quebrar o fluxo de edição inteiro.
    }
  });

  if (!venda) {
    throw new AppError('Venda não encontrada', 404);
  }

  res.json(venda);
};

export const criarVenda = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const idempotencyKey = (req.headers['idempotency-key'] ?? req.headers['x-idempotency-key']) as string | undefined;

  purgeExpiredIdempotency();
  const keyTrimmed = idempotencyKey?.trim();
  if (keyTrimmed) {
    const cacheKey = `${userId}:${keyTrimmed}`;
    const cached = idempotencyCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt <= IDEMPOTENCY_TTL_MS) {
      return res.status(cached.statusCode).json(cached.body);
    }
  }

  try {
    const parsed = vendaSchema.parse(req.body);
    const data = {
      ...parsed,
      itens: consolidarItens(parsed.itens),
      servicos: parsed.servicos ?? []
    };

    const isOs = data.tipo === 'service_order';
    const isQuote = data.tipo === 'quote';
    if (!isOs && data.itens.length === 0 && data.servicos.length === 0) {
      throw new AppError('Venda deve ter pelo menos um item (produto) ou um serviço', 400);
    }
    if (isOs && data.itens.length === 0 && data.servicos.length === 0) {
      throw new AppError('Ordem de serviço deve ter pelo menos um item (peça) ou um serviço.', 400);
    }

    const venda = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const cliente = await tx.cliente.findFirst({ where: { id: data.cliente_id, usuario_id: userId } });
      if (!cliente) throw new AppError('Cliente não encontrado', 404);

      let agendamentoId: string | undefined;
      if (data.agendamento_id) {
        const ag = await tx.agendamento.findFirst({
          where: { id: data.agendamento_id, usuario_id: userId }
        });
        if (!ag) throw new AppError('Agendamento não encontrado', 404);
        if (ag.status === 'CANCELADO') throw new AppError('Não é possível criar venda para agendamento cancelado.', 400);
        const jaVinculada = await tx.venda.findFirst({
          where: { agendamento_id: data.agendamento_id }
        });
        if (jaVinculada) throw new AppError('Este agendamento já possui uma venda vinculada.', 400);
        agendamentoId = data.agendamento_id;
      }

      const effectiveStatus = isQuote ? 'ORCAMENTO' : isOs ? 'PENDENTE' : data.status;
      const formaPagamento = isQuote ? null : (isOs ? (data.forma_pagamento?.trim() || null) : (data.forma_pagamento ?? ''));

      for (const item of data.itens) {
        const produto = await tx.produto.findUnique({ where: { id: item.produto_id } });
        if (!produto) throw new AppError(`Produto não encontrado`, 404);
        if (!isQuote && !isOs && data.status === 'PAGO' && produto.estoque_atual < item.quantidade) {
          throw new AppError(
            `Estoque insuficiente para o produto ${produto.nome}. Disponível: ${produto.estoque_atual}`,
            400
          );
        }
      }

      const subtotalItens = data.itens.reduce(
        (acc, item) => acc + Number(item.preco_unitario) * Number(item.quantidade),
        0
      );
      const subtotalServicos = data.servicos.reduce(
        (acc, s) => acc + Number(s.valor_unitario) * Number(s.quantidade),
        0
      );
      const subtotal = subtotalItens + subtotalServicos;
      const percentual = Math.min(100, Math.max(-100, Number(data.desconto_percentual) ?? 0));
      const valorDesconto = subtotal * (percentual / 100);
      const total = Math.round((subtotal - valorDesconto) * 100) / 100;

      let clientExtraItemId: string | null = null;
      if (data.client_extra_item_id) {
        const extraItem = await tx.clientExtraItem.findFirst({
          where: { id: data.client_extra_item_id, client_id: data.cliente_id }
        });
        if (extraItem) clientExtraItemId = extraItem.id;
      }

      let businessAreaId: string | null = null;
      if (data.business_area_id) {
        const area = await tx.businessArea.findFirst({
          where: { id: data.business_area_id, usuario_id: userId, is_active: true }
        });
        if (area) businessAreaId = area.id;
      }

      const osCode = isOs ? `OS-${generateSaleCode()}` : null;
      const saleCode = isOs ? null : generateSaleCode();
      const maxAttempts = 20;
      let novaVenda: Awaited<ReturnType<typeof tx.venda.create>> | null = null;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const createData: Prisma.VendaCreateInput = {
            sale_code: saleCode,
            os_code: isOs ? (attempt === 0 ? osCode : `OS-${generateSaleCode()}${attempt}`) : null,
            tipo: data.tipo,
            cliente: { connect: { id: data.cliente_id } },
            usuario: { connect: { id: userId } },
            ...(businessAreaId ? { business_area: { connect: { id: businessAreaId } } } : {}),
            ...(agendamentoId ? { agendamento: { connect: { id: agendamentoId } } } : {}),
            ...(clientExtraItemId ? { client_extra_item: { connect: { id: clientExtraItemId } } } : {}),
            total,
            desconto: valorDesconto,
            forma_pagamento: formaPagamento,
            status: effectiveStatus,
            itens: data.itens.length > 0 ? {
              create: data.itens.map(item => ({
                produto_id: item.produto_id,
                quantidade: item.quantidade,
                preco_unitario: item.preco_unitario
              }))
            } : undefined,
            servicos: data.servicos.length > 0 ? {
              create: data.servicos.map(s => ({
                produto_id: s.produto_id ?? null,
                descricao: s.descricao,
                quantidade: s.quantidade,
                valor_unitario: s.valor_unitario
              }))
            } : undefined
          };
          if (isOs) {
            (createData as Prisma.VendaCreateInput).os_status = (data.os_status as 'ABERTA' | 'EM_EXECUCAO' | 'CONCLUIDA') ?? 'ABERTA';
            (createData as Prisma.VendaCreateInput).problema_relatado = data.problema_relatado ?? null;
            (createData as Prisma.VendaCreateInput).observacoes_tecnicas = data.observacoes_tecnicas ?? null;
            (createData as Prisma.VendaCreateInput).texto_garantia = data.texto_garantia ?? null;
            (createData as Prisma.VendaCreateInput).os_agradecimento = data.os_agradecimento ?? null;
            (createData as Prisma.VendaCreateInput).aceite_por = data.aceite_por ?? null;
          }
          novaVenda = await tx.venda.create({
            data: createData,
            include: {
              cliente: true,
              client_extra_item: true,
              itens: { include: { produto: true } },
              servicos: true
            }
          });
          break;
        } catch (err: unknown) {
          const isUniqueViolation = err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002';
          if (isUniqueViolation && attempt < maxAttempts - 1) {
            continue;
          }
          throw err;
        }
      }
      if (!novaVenda) throw new AppError('Não foi possível gerar código único. Tente novamente.', 500);

      if (!isQuote && !isOs && data.status === 'PAGO') {
        for (const item of data.itens) {
          await tx.produto.update({
            where: { id: item.produto_id },
            data: { estoque_atual: { decrement: item.quantidade } }
          });
        }
        const categoryId = await getOrCreateVendasCategory(tx, userId);
        const saleDate = novaVenda.createdAt;
        const dateOnly = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
        await tx.financialTransaction.create({
          data: {
            usuario_id: userId,
            business_area_id: novaVenda.business_area_id,
            type: 'income',
            category_id: categoryId,
            source_type: 'sale',
            source_id: novaVenda.id,
            description: `Venda ${(novaVenda as { sale_code?: string }).sale_code ?? novaVenda.id.slice(0, 8)}`,
            value: Number(novaVenda.total),
            status: 'confirmed',
            date: dateOnly
          }
        });
      }

      return novaVenda;
    });

    const body = JSON.parse(JSON.stringify(venda));
    if (keyTrimmed) {
      idempotencyCache.set(`${userId}:${keyTrimmed}`, {
        statusCode: 201,
        body,
        createdAt: Date.now()
      });
    }
    res.status(201).json(body);

    // invalida cache de dashboard para este usuário (faturamento, KPIs, gráfico)
    invalidatePrefix(`dashboard:summary:${userId}:`);
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    if (error.name === 'ZodError') {
      const firstError = error.errors?.[0];
      throw new AppError(firstError?.message || 'Dados inválidos', 400);
    }
    console.error('Erro ao criar venda:', error?.message);
    const detail = process.env.NODE_ENV !== 'production' && error?.message ? `: ${error.message}` : '';
    throw new AppError(`Não foi possível registrar a venda. Tente novamente.${detail}`, 500);
  }
};

const vendaUpdateSchema = z.object({
  cliente_id: z.string().uuid('ID do cliente inválido').optional(),
  client_extra_item_id: z.string().uuid().nullable().optional(),
  business_area_id: z.string().uuid().nullable().optional(),
  itens: z.array(itemVendaSchema).optional(),
  servicos: z.array(itemServicoSchema).optional(),
  desconto_percentual: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val))
    .pipe(z.number().min(-100).max(100))
    .optional(),
  forma_pagamento: z.string().min(1).nullable().optional(),
  status: z.enum(['PAGO', 'PENDENTE', 'PARCIAL', 'ORCAMENTO', 'CANCELADO']).optional(),
  os_status: z.enum(['ABERTA', 'EM_EXECUCAO', 'CONCLUIDA']).optional(),
  problema_relatado: z.string().max(10000).nullable().optional(),
  observacoes_tecnicas: z.string().max(10000).nullable().optional(),
  texto_garantia: z.string().max(2000).nullable().optional(),
  os_agradecimento: z.string().max(2000).nullable().optional(),
  aceite_por: z.string().max(200).nullable().optional()
});

/** Atualiza venda: reverte impacto anterior no estoque e aplica novo. Transação atômica. */
export const atualizarVenda = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const body = vendaUpdateSchema.parse(req.body);

  const vendaExistente = await prisma.venda.findFirst({
    where: { id, usuario_id: userId },
    include: { itens: true, servicos: true }
  });

  if (!vendaExistente) {
    throw new AppError('Venda não encontrada', 404);
  }

  if (vendaExistente.status === 'FECHADA') {
    throw new AppError('Venda fechada não pode ser editada.', 400);
  }
  if (vendaExistente.tipo === 'quote' && vendaExistente.status === 'CANCELADO') {
    throw new AppError('Orçamento cancelado não pode ser editado.', 400);
  }
  const isOs = vendaExistente.tipo === 'service_order';
  if (isOs && (vendaExistente.os_status === 'CANCELADA' || vendaExistente.os_status === 'CONVERTIDA_EM_VENDA')) {
    throw new AppError('Esta ordem de serviço não pode ser editada.', 400);
  }

  type ItemVendaShape = { produto_id: string; quantidade: number; preco_unitario: number };
  type ServicoShape = { produto_id?: string | null; descricao: string; quantidade: number; valor_unitario: number };
  const itensNovos: ItemVendaShape[] = body.itens ?? vendaExistente.itens.map((i: { produto_id: string; quantidade: number; preco_unitario: unknown }) => ({
    produto_id: i.produto_id,
    quantidade: i.quantidade,
    preco_unitario: Number(i.preco_unitario)
  }));
  const servicosExistentes = (vendaExistente as { servicos?: { produto_id?: string | null; descricao: string; quantidade: number; valor_unitario: unknown }[] }).servicos ?? [];
  const servicosNovos: ServicoShape[] = body.servicos !== undefined
    ? body.servicos
    : servicosExistentes.map((s: { produto_id?: string | null; descricao: string; quantidade: number; valor_unitario: unknown }) => ({
        produto_id: s.produto_id ?? null,
        descricao: s.descricao,
        quantidade: s.quantidade,
        valor_unitario: Number(s.valor_unitario)
      }));
  if (isOs && itensNovos.length === 0 && servicosNovos.length === 0) {
    throw new AppError('Ordem de serviço deve ter pelo menos um item (peça) ou um serviço.', 400);
  }
  const subtotalItens = itensNovos.reduce(
    (acc: number, item: ItemVendaShape) => acc + Number(item.preco_unitario) * Number(item.quantidade),
    0
  );
  const subtotalServicos = servicosNovos.reduce(
    (acc: number, s: ServicoShape) => acc + Number(s.valor_unitario) * Number(s.quantidade),
    0
  );
  const subtotalCalc = subtotalItens + subtotalServicos;
  const percentualDesconto =
    body.desconto_percentual !== undefined
      ? Math.min(100, Math.max(-100, body.desconto_percentual))
      : null;
  const valorDesconto =
    percentualDesconto !== null
      ? subtotalCalc * (percentualDesconto / 100)
      : Number(vendaExistente.desconto);
  const isQuote = vendaExistente.tipo === 'quote';
  const forma_pagamento = body.forma_pagamento !== undefined ? body.forma_pagamento : vendaExistente.forma_pagamento;
  let statusNovo = body.status ?? vendaExistente.status;
  if (isQuote) {
    const statusStr = String(statusNovo);
    if (statusStr === 'PAGO' || statusStr === 'PENDENTE' || statusStr === 'FECHADA') {
      statusNovo = vendaExistente.status;
    }
  }
  const cliente_id = body.cliente_id ?? vendaExistente.cliente_id;
  let client_extra_item_id: string | null = body.client_extra_item_id !== undefined
    ? (body.client_extra_item_id || null)
    : vendaExistente.client_extra_item_id;

  // Validar cliente se informado (ownership)
  if (body.cliente_id) {
    const cliente = await prisma.cliente.findFirst({ where: { id: body.cliente_id, usuario_id: userId } });
    if (!cliente) throw new AppError('Cliente não encontrado', 404);
  }

  // Validar client_extra_item_id se informado (deve ser do mesmo cliente)
  if (client_extra_item_id) {
    const extraItem = await prisma.clientExtraItem.findFirst({
      where: { id: client_extra_item_id, client_id: cliente_id }
    });
    if (!extraItem) client_extra_item_id = null;
  }

  let business_area_id: string | null = body.business_area_id !== undefined
    ? (body.business_area_id || null)
    : vendaExistente.business_area_id;
  if (business_area_id) {
    const area = await prisma.businessArea.findFirst({
      where: { id: business_area_id, usuario_id: userId, is_active: true }
    });
    if (!area) business_area_id = null;
  }

  // Validar produtos para os novos itens
  for (const item of itensNovos) {
    const produto = await prisma.produto.findUnique({ where: { id: item.produto_id } });
    if (!produto) throw new AppError(`Produto ${item.produto_id} não encontrado`, 404);
  }

  const total = Math.round((subtotalCalc - valorDesconto) * 100) / 100;

  const vendaAtualizada = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const statusAntigo = vendaExistente.status as 'PAGO' | 'PENDENTE' | 'PARCIAL' | 'FECHADA' | 'ORCAMENTO' | 'CANCELADO';
    const isSale = vendaExistente.tipo === 'sale';

    // 1) Reverter estoque dos itens antigos (apenas venda PAGA)
    if (isSale && statusAntigo === 'PAGO') {
      for (const item of vendaExistente.itens) {
        await tx.produto.update({
          where: { id: item.produto_id },
          data: { estoque_atual: { increment: item.quantidade } }
        });
      }
    }

    // 2) Remover itens antigos (evita duplicados)
    await tx.itemVenda.deleteMany({ where: { venda_id: id } });

    // 3) Criar novos itens (peças)
    if (itensNovos.length > 0) {
      await tx.itemVenda.createMany({
        data: itensNovos.map((item: ItemVendaShape) => ({
          venda_id: id,
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario
        }))
      });
    }

    // 3b) Ordem de Serviço: substituir serviços
    if (isOs) {
      await tx.itemServicoOrdem.deleteMany({ where: { venda_id: id } });
      if (servicosNovos.length > 0) {
        await tx.itemServicoOrdem.createMany({
          data: servicosNovos.map((s: ServicoShape) => ({
            venda_id: id,
            produto_id: s.produto_id ?? null,
            descricao: s.descricao,
            quantidade: s.quantidade,
            valor_unitario: s.valor_unitario
          }))
        });
      }
    }

    // 4) Se venda (não OS) e nova status for PAGO, validar estoque e decrementar
    if (isSale && statusNovo === 'PAGO') {
      for (const item of itensNovos) {
        const prod = await tx.produto.findUnique({ where: { id: item.produto_id } });
        if (!prod || prod.estoque_atual < item.quantidade) {
          throw new AppError(
            `Estoque insuficiente para o produto ${prod?.nome ?? item.produto_id}. Disponível: ${prod?.estoque_atual ?? 0}`,
            400
          );
        }
        await tx.produto.update({
          where: { id: item.produto_id },
          data: { estoque_atual: { decrement: item.quantidade } }
        });
      }
    }

    // 5) Atualizar cabeçalho da venda
    const updateData: Prisma.VendaUpdateInput = {
      cliente: { connect: { id: cliente_id } },
      ...(client_extra_item_id ? { client_extra_item: { connect: { id: client_extra_item_id } } } : { client_extra_item: { disconnect: true } }),
      ...(business_area_id ? { business_area: { connect: { id: business_area_id } } } : { business_area: { disconnect: true } }),
      total,
      desconto: valorDesconto,
      forma_pagamento,
      status: statusNovo
    };
    if (isOs) {
      if (body.os_status !== undefined) updateData.os_status = body.os_status;
      if (body.problema_relatado !== undefined) updateData.problema_relatado = body.problema_relatado;
      if (body.observacoes_tecnicas !== undefined) updateData.observacoes_tecnicas = body.observacoes_tecnicas;
      if (body.texto_garantia !== undefined) updateData.texto_garantia = body.texto_garantia;
      if (body.os_agradecimento !== undefined) updateData.os_agradecimento = body.os_agradecimento;
      if (body.aceite_por !== undefined) updateData.aceite_por = body.aceite_por;
    }
    await tx.venda.update({
      where: { id },
      data: updateData
    });

    if (isSale && statusAntigo === 'PAGO' && statusNovo !== 'PAGO') {
      await tx.financialTransaction.updateMany({
        where: { usuario_id: userId, source_type: 'sale', source_id: id },
        data: { status: 'cancelled' }
      });
    }
    if (isSale && statusAntigo !== 'PAGO' && statusNovo === 'PAGO') {
      const categoryId = await getOrCreateVendasCategory(tx, userId);
      const vendaRow = await tx.venda.findUnique({
        where: { id },
        select: { sale_code: true, os_code: true, total: true, business_area_id: true }
      });
      const dateOnly = new Date();
      dateOnly.setHours(0, 0, 0, 0);
      const descCode = vendaRow?.sale_code ?? vendaRow?.os_code ?? id.slice(0, 8);
      await tx.financialTransaction.create({
        data: {
          usuario_id: userId,
          type: 'income',
          category_id: categoryId,
          source_type: 'sale',
          source_id: id,
          description: `Venda ${descCode}`,
          value: Number(total),
          status: 'confirmed',
          date: dateOnly,
          business_area_id: vendaRow?.business_area_id ?? null
        }
      });
    }

    return tx.venda.findUnique({
      where: { id },
      include: {
        cliente: true,
        client_extra_item: true,
        itens: { include: { produto: true } },
        servicos: true
      }
    });
  });

  res.json(vendaAtualizada);

  invalidatePrefix(`dashboard:summary:${userId}:`);
};

/** PATCH /vendas/:id/converter-em-venda — Converte orçamento em venda (tipo=sale, status=PENDENTE). */
export const converterOrcamentoEmVenda = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;

  const venda = await prisma.venda.findFirst({
    where: { id, usuario_id: userId },
    include: { itens: true, cliente: true, client_extra_item: true }
  });

  if (!venda) throw new AppError('Orçamento não encontrado', 404);
  if (venda.tipo !== 'quote') throw new AppError('Apenas orçamentos podem ser convertidos em venda.', 400);
  if (venda.status !== 'ORCAMENTO') throw new AppError('Apenas orçamentos ativos podem ser convertidos. Cancele ou edite o registro.', 400);

  const atualizada = await prisma.venda.update({
    where: { id },
    data: { tipo: 'sale', status: 'PENDENTE', forma_pagamento: 'A definir' },
    include: {
      cliente: true,
      client_extra_item: true,
      itens: { include: { produto: true } }
    }
  });

  invalidatePrefix(`dashboard:summary:${userId}:`);
  res.json(atualizada);
};

/** PATCH /vendas/:id/cancelar-orcamento — Marca orçamento como CANCELADO. */
export const cancelarOrcamento = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;

  const venda = await prisma.venda.findFirst({
    where: { id, usuario_id: userId }
  });

  if (!venda) throw new AppError('Orçamento não encontrado', 404);
  if (venda.tipo !== 'quote') throw new AppError('Apenas orçamentos podem ser cancelados.', 400);
  if (venda.status !== 'ORCAMENTO') throw new AppError('Este orçamento já está cancelado.', 400);

  const atualizada = await prisma.venda.update({
    where: { id },
    data: { status: 'CANCELADO' },
    include: { cliente: true, itens: { include: { produto: true } } }
  });

  res.json(atualizada);
};

const converterOsEmVendaBodySchema = z.object({
  marcar_como_pago: z.boolean().optional(),
  forma_pagamento: z.string().min(1).optional()
}).optional();

/** PATCH /vendas/:id/converter-os-em-venda — Converte Ordem de Serviço em venda (tipo=sale, status=PENDENTE ou PAGO, os_status=CONVERTIDA_EM_VENDA). Se marcar_como_pago: true, cria lançamento no financeiro. */
export const converterOsEmVenda = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const body = converterOsEmVendaBodySchema.safeParse(req.body);
  const marcarComoPago = body.success && body.data?.marcar_como_pago === true;
  const formaPagamento = body.success && body.data?.forma_pagamento ? body.data.forma_pagamento : 'A definir';

  const venda = await prisma.venda.findFirst({
    where: { id, usuario_id: userId },
    include: { itens: true, servicos: true, cliente: true, client_extra_item: true }
  });

  if (!venda) throw new AppError('Ordem de serviço não encontrada', 404);
  if (venda.tipo !== 'service_order') throw new AppError('Apenas ordens de serviço podem ser convertidas em venda.', 400);
  if (venda.os_status === 'CANCELADA') throw new AppError('OS cancelada não pode ser convertida.', 400);
  if (venda.os_status === 'CONVERTIDA_EM_VENDA') throw new AppError('Esta OS já foi convertida em venda.', 400);

  // Mantém o mesmo "código exibido" após converter OS->Venda:
  // no frontend o código da OS é `os_code`, e depois da conversão passa a ser `sale_code`.
  // Se a OS já tinha `os_code`, reaproveitamos ele como `sale_code` para não "trocar o código".
  const saleCode = venda.os_code ?? generateSaleCode();
  const statusAposConversao = marcarComoPago ? 'PAGO' : 'PENDENTE';

  const atualizada = await prisma.$transaction(async (tx) => {
    const updated = await tx.venda.update({
      where: { id },
      data: {
        tipo: 'sale',
        status: statusAposConversao,
        forma_pagamento: formaPagamento,
        sale_code: saleCode,
        os_code: null,
        os_status: 'CONVERTIDA_EM_VENDA'
      },
      include: {
        cliente: true,
        client_extra_item: true,
        itens: { include: { produto: true } },
        servicos: true
      }
    });

    if (marcarComoPago) {
      const categoryId = await getOrCreateVendasCategory(tx, userId);
      const dateOnly = new Date();
      dateOnly.setHours(0, 0, 0, 0);
      const descCode = updated.sale_code ?? id.slice(0, 8);
      await tx.financialTransaction.create({
        data: {
          usuario_id: userId,
          type: 'income',
          category_id: categoryId,
          source_type: 'sale',
          source_id: id,
          description: `Venda ${descCode}`,
          value: Number(updated.total),
          status: 'confirmed',
          date: dateOnly,
          business_area_id: updated.business_area_id ?? null
        }
      });
    }
    return updated;
  });

  invalidatePrefix(`dashboard:summary:${userId}:`);
  res.json(atualizada);
};

/** PATCH /vendas/:id/cancelar-os — Marca Ordem de Serviço como CANCELADA. */
export const cancelarOs = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;

  const venda = await prisma.venda.findFirst({
    where: { id, usuario_id: userId }
  });

  if (!venda) throw new AppError('Ordem de serviço não encontrada', 404);
  if (venda.tipo !== 'service_order') throw new AppError('Apenas ordens de serviço podem ser canceladas.', 400);
  if (venda.os_status === 'CANCELADA') throw new AppError('Esta OS já está cancelada.', 400);
  if (venda.os_status === 'CONVERTIDA_EM_VENDA') throw new AppError('OS já convertida em venda não pode ser cancelada.', 400);

  const atualizada = await prisma.venda.update({
    where: { id },
    data: { os_status: 'CANCELADA' },
    include: { cliente: true, itens: { include: { produto: true } }, servicos: true }
  });

  res.json(atualizada);
};

/** PATCH /vendas/:id/fechar — Marca venda como FECHADA (não editável). Apenas para tipo=sale. */
export const marcarComoFechada = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;

  const venda = await prisma.venda.findFirst({
    where: { id, usuario_id: userId }
  });

  if (!venda) {
    throw new AppError('Venda não encontrada', 404);
  }
  if (venda.tipo === 'quote') {
    throw new AppError('Orçamento não pode ser fechado. Use "Converter em venda" ou "Cancelar orçamento".', 400);
  }
  if (venda.tipo === 'service_order') {
    throw new AppError('Ordem de serviço não pode ser fechada. Use "Converter em venda" ou "Cancelar OS".', 400);
  }
  if (venda.status === 'FECHADA') {
    throw new AppError('Esta venda já está fechada.', 400);
  }

  const atualizada = await prisma.venda.update({
    where: { id },
    data: { status: 'FECHADA' },
    include: {
      cliente: true,
      itens: { include: { produto: true } }
    }
  });

  res.json(atualizada);

  invalidatePrefix(`dashboard:summary:${userId}:`);
};

const faturarLoteSchema = z.object({
  saleIds: z.array(z.string().min(1, 'ID inválido')).min(1, 'Informe ao menos um pedido').max(100, 'Máximo 100 por vez')
});

/** POST /vendas/faturar-lote — Fatura (marca FECHADA) vários pedidos PENDENTES ou PAGOS. Body: { saleIds: string[] }. */
export const faturarLote = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const parsed = faturarLoteSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? 'Dados inválidos', 400);
  }
  const saleIds = parsed.data.saleIds;

  const successIds: string[] = [];
  const failed: Array<{ id: string; motivo: string }> = [];

  for (const id of saleIds) {
    const venda = await prisma.venda.findFirst({
      where: { id, usuario_id: userId }
    });
    if (!venda) {
      failed.push({ id, motivo: 'não encontrado' });
      continue;
    }
    if (venda.status === 'FECHADA') {
      failed.push({ id, motivo: 'já faturado' });
      continue;
    }
    if (venda.tipo === 'quote') {
      failed.push({ id, motivo: 'orçamento não pode ser faturado em lote; converta em venda antes' });
      continue;
    }
    if (venda.tipo === 'service_order') {
      failed.push({ id, motivo: 'ordem de serviço não pode ser faturada em lote; converta em venda antes' });
      continue;
    }
    if (venda.status !== 'PENDENTE' && venda.status !== 'PAGO') {
      failed.push({ id, motivo: 'status inválido (apenas pendentes ou pagos)' });
      continue;
    }
    try {
      await prisma.venda.update({
        where: { id },
        data: { status: 'FECHADA' }
      });
      successIds.push(id);
    } catch {
      failed.push({ id, motivo: 'erro ao atualizar' });
    }
  }

  if (successIds.length > 0) {
    invalidatePrefix(`dashboard:summary:${userId}:`);
  }

  res.json({ successIds, failed });
};

const excluirLoteSchema = z.object({
  saleIds: z.array(z.string().min(1, 'ID inválido')).min(1, 'Informe ao menos um pedido').max(100, 'Máximo 100 por vez')
});

/** POST /vendas/excluir-lote — Exclui vários pedidos (apenas tipo=sale). Reverte estoque/financeiro quando necessário. */
export const excluirLote = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const parsed = excluirLoteSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(parsed.error.errors[0]?.message ?? 'Dados inválidos', 400);
  }
  const saleIds = parsed.data.saleIds;

  const successIds: string[] = [];
  const failed: Array<{ id: string; motivo: string }> = [];

  for (const id of saleIds) {
    const venda = await prisma.venda.findFirst({
      where: { id, usuario_id: userId },
      include: { itens: true }
    });
    if (!venda) {
      failed.push({ id, motivo: 'não encontrado' });
      continue;
    }
    if (venda.tipo !== 'sale') {
      failed.push({ id, motivo: 'apenas vendas (pedido) podem ser excluídas em lote' });
      continue;
    }
    if (venda.status === 'FECHADA') {
      failed.push({ id, motivo: 'pedido faturado/fechado não pode ser excluído em lote' });
      continue;
    }

    try {
      const isPago = venda.status === 'PAGO';
      await prisma.$transaction(async (tx) => {
        if (isPago && venda.itens.length > 0) {
          for (const item of venda.itens) {
            await tx.produto.update({
              where: { id: item.produto_id },
              data: { estoque_atual: { increment: item.quantidade } }
            });
          }
          await tx.financialTransaction.deleteMany({
            where: { usuario_id: userId, source_type: 'sale', source_id: id }
          });
        }
        await tx.venda.delete({ where: { id } });
      });
      successIds.push(id);
    } catch {
      failed.push({ id, motivo: 'erro ao excluir' });
    }
  }

  if (successIds.length > 0) {
    invalidatePrefix(`dashboard:summary:${userId}:`);
  }

  res.json({ successIds, failed });
};

// --- Anexos da venda ---
const ANEXOS_ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];
const ANEXOS_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

/** DELETE /vendas/:id — Exclui venda, orçamento ou ordem de serviço (reverte estoque se venda PAGA, remove lançamento financeiro). */
export const excluirVenda = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const venda = await prisma.venda.findFirst({
    where: { id, usuario_id: userId },
    include: { itens: true }
  });
  if (!venda) throw new AppError('Venda não encontrada', 404);

  const isSale = venda.tipo === 'sale';
  const isPago = venda.status === 'PAGO';

  await prisma.$transaction(async (tx) => {
    if (isSale && isPago && venda.itens.length > 0) {
      for (const item of venda.itens) {
        await tx.produto.update({
          where: { id: item.produto_id },
          data: { estoque_atual: { increment: item.quantidade } }
        });
      }
      await tx.financialTransaction.deleteMany({
        where: { usuario_id: userId, source_type: 'sale', source_id: id }
      });
    }
    await tx.venda.delete({ where: { id } });
  });

  invalidatePrefix(`dashboard:summary:${userId}:`);
  res.status(204).send();
};

export const listarAnexosVenda = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const venda = await prisma.venda.findFirst({
    where: { id, usuario_id: userId },
    select: { id: true }
  });
  if (!venda) throw new AppError('Venda não encontrada', 404);
  try {
    const anexos = await prisma.vendaAnexo.findMany({
      where: { venda_id: id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(anexos);
  } catch (e: any) {
    // Bancos legados podem não ter a tabela venda_anexos ainda
    const msg = String(e?.message ?? e ?? '');
    if (/venda_anexos|does not exist|relation .* does not exist/i.test(msg)) {
      return res.json([]);
    }
    throw e;
  }
};

export const uploadAnexoVenda = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const file = (req as any).file;
  if (!file) throw new AppError('Nenhum arquivo enviado', 400);
  if (!ANEXOS_ALLOWED_MIMES.includes(file.mimetype)) {
    throw new AppError('Tipo de arquivo não permitido. Use PDF, JPG, PNG ou WEBP.', 400);
  }
  if (file.size > ANEXOS_MAX_SIZE) {
    throw new AppError('Arquivo muito grande. Máximo 10 MB.', 400);
  }
  const venda = await prisma.venda.findFirst({
    where: { id, usuario_id: userId },
    select: { id: true }
  });
  if (!venda) throw new AppError('Venda não encontrada', 404);

  const pathRelativo = (file as any).pathRelative ?? `vendas/${id}/${file.filename}`;
  const tryCreate = async () => {
    return prisma.vendaAnexo.create({
      data: {
        venda_id: id,
        nome_original: file.originalname,
        path: pathRelativo,
        mime_type: file.mimetype,
        tamanho: file.size
      }
    });
  };

  try {
    const anexo = await tryCreate();
    res.status(201).json(anexo);
  } catch (e: any) {
    const msg = String(e?.message ?? e ?? '');
    if (/venda_anexos|does not exist/i.test(msg)) {
      // Alguns bancos legados podem não ter a tabela criada.
      // Tentamos criar de forma defensiva; se falhar, retornamos uma mensagem acionável.
      try {
        // Importante: no banco da produção, `vendas.id` está como TEXT (não UUID).
        // Então criamos `venda_anexos` com tipos TEXT também para evitar erro de FK incompatível.
        await prisma.$executeRawUnsafe(`
          CREATE EXTENSION IF NOT EXISTS pgcrypto;
          CREATE TABLE IF NOT EXISTS venda_anexos (
            id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
            venda_id text NOT NULL,
            nome_original varchar(255) NOT NULL,
            path varchar(500) NOT NULL,
            mime_type varchar(100),
            tamanho integer,
            "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
            CONSTRAINT venda_anexos_venda_id_fkey
              FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS venda_anexos_venda_id_idx ON venda_anexos(venda_id);
        `);
        const anexo = await tryCreate();
        res.status(201).json(anexo);
        return;
      } catch (e2: any) {
        throw new AppError(
          'Falha ao anexar: a tabela `venda_anexos` não existe/está inacessível no banco. Rode a migração da tabela e tente novamente.',
          500
        );
      }
    }
    throw e;
  }
};

export const deletarAnexoVenda = async (req: AuthRequest, res: Response) => {
  const { id, anexoId } = req.params;
  const userId = req.userId!;
  const venda = await prisma.venda.findFirst({
    where: { id, usuario_id: userId },
    select: { id: true }
  });
  if (!venda) throw new AppError('Venda não encontrada', 404);
  const anexo = await prisma.vendaAnexo.findFirst({
    where: { id: anexoId, venda_id: id }
  });
  if (!anexo) throw new AppError('Anexo não encontrado', 404);
  const fs = await import('fs');
  const path = await import('path');
  const fullPath = path.join(getUploadsRootDir(), anexo.path);
  if (fs.existsSync(fullPath)) {
    try { fs.unlinkSync(fullPath); } catch {}
  }
  await prisma.vendaAnexo.delete({ where: { id: anexoId } });
  res.status(204).send();
};

export const downloadAnexoVenda = async (req: AuthRequest, res: Response) => {
  const { id, anexoId } = req.params;
  const userId = req.userId!;
  const venda = await prisma.venda.findFirst({
    where: { id, usuario_id: userId },
    select: { id: true }
  });
  if (!venda) throw new AppError('Venda não encontrada', 404);
  const anexo = await prisma.vendaAnexo.findFirst({
    where: { id: anexoId, venda_id: id }
  });
  if (!anexo) throw new AppError('Anexo não encontrado', 404);
  const path = await import('path');
  const fs = await import('fs');
  const fullPath = path.join(getUploadsRootDir(), anexo.path);
  if (!fs.existsSync(fullPath)) throw new AppError('Arquivo não encontrado no servidor', 404);
  res.download(fullPath, anexo.nome_original, (err) => {
    if (err && !res.headersSent) res.status(500).json({ error: 'Erro ao enviar arquivo' });
  });
};

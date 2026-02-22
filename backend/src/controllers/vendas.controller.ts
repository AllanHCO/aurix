import { Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

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

const vendaSchema = z.object({
  cliente_id: z.string().uuid('ID do cliente inválido'),
  itens: z.array(itemVendaSchema).min(1, 'Venda deve ter pelo menos um item'),
  desconto_percentual: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val))
    .pipe(
      z
        .number()
        .min(0, 'Desconto não pode ser negativo')
        .max(100, 'Desconto não pode ser maior que 100%')
    )
    .default(0),
  forma_pagamento: z.string().min(1, 'Forma de pagamento é obrigatória'),
  status: z.enum(['PAGO', 'PENDENTE']).default('PENDENTE')
});

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

export const listarVendas = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const vendas = await prisma.venda.findMany({
    where: {
      usuario_id: userId
    },
    include: {
      cliente: {
        select: {
          nome: true
        }
      },
      itens: {
        include: {
          produto: {
            select: {
              nome: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  res.json(vendas);
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
      itens: {
        include: {
          produto: true
        }
      }
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
  if (idempotencyKey && idempotencyKey.trim() !== '') {
    const cached = idempotencyCache.get(idempotencyKey.trim());
    if (cached && Date.now() - cached.createdAt <= IDEMPOTENCY_TTL_MS) {
      return res.status(cached.statusCode).json(cached.body);
    }
  }

  try {
    const parsed = vendaSchema.parse(req.body);
    const data = {
      ...parsed,
      itens: consolidarItens(parsed.itens)
    };

    if (data.itens.length === 0) {
      throw new AppError('Venda deve ter pelo menos um item após consolidar itens', 400);
    }

    const venda = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const cliente = await tx.cliente.findFirst({ where: { id: data.cliente_id } });
      if (!cliente) throw new AppError('Cliente não encontrado', 404);

      for (const item of data.itens) {
        const produto = await tx.produto.findUnique({ where: { id: item.produto_id } });
        if (!produto) throw new AppError(`Produto não encontrado`, 404);
        if (data.status === 'PAGO' && produto.estoque_atual < item.quantidade) {
          throw new AppError(
            `Estoque insuficiente para o produto ${produto.nome}. Disponível: ${produto.estoque_atual}`,
            400
          );
        }
      }

      const subtotal = data.itens.reduce(
        (acc, item) => acc + Number(item.preco_unitario) * Number(item.quantidade),
        0
      );
      const percentual = Math.min(100, Math.max(0, Number(data.desconto_percentual) ?? 0));
      const valorDesconto = subtotal * (percentual / 100);
      const total = subtotal - valorDesconto;

      const novaVenda = await tx.venda.create({
        data: {
          cliente_id: data.cliente_id,
          usuario_id: userId,
          total,
          desconto: valorDesconto,
          forma_pagamento: data.forma_pagamento,
          status: data.status,
          itens: {
            create: data.itens.map(item => ({
              produto_id: item.produto_id,
              quantidade: item.quantidade,
              preco_unitario: item.preco_unitario
            }))
          }
        },
        include: {
          cliente: true,
          itens: { include: { produto: true } }
        }
      });

      if (data.status === 'PAGO') {
        for (const item of data.itens) {
          await tx.produto.update({
            where: { id: item.produto_id },
            data: { estoque_atual: { decrement: item.quantidade } }
          });
        }
      }

      return novaVenda;
    });

    const body = JSON.parse(JSON.stringify(venda));
    if (idempotencyKey && idempotencyKey.trim() !== '') {
      idempotencyCache.set(idempotencyKey.trim(), {
        statusCode: 201,
        body,
        createdAt: Date.now()
      });
    }
    res.status(201).json(body);
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    if (error.name === 'ZodError') {
      const firstError = error.errors[0];
      throw new AppError(firstError.message || 'Dados inválidos', 400);
    }
    console.error('=== ERRO AO CRIAR VENDA ===', error?.message, error?.stack);
    throw error;
  }
};

const vendaUpdateSchema = z.object({
  cliente_id: z.string().uuid('ID do cliente inválido').optional(),
  itens: z.array(itemVendaSchema).min(1, 'Venda deve ter pelo menos um item').optional(),
  desconto_percentual: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val))
    .pipe(z.number().min(0).max(100))
    .optional(),
  forma_pagamento: z.string().min(1).optional(),
  status: z.enum(['PAGO', 'PENDENTE']).optional()
});

/** Atualiza venda: reverte impacto anterior no estoque e aplica novo. Transação atômica. */
export const atualizarVenda = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const body = vendaUpdateSchema.parse(req.body);

  const vendaExistente = await prisma.venda.findFirst({
    where: { id, usuario_id: userId },
    include: { itens: true }
  });

  if (!vendaExistente) {
    throw new AppError('Venda não encontrada', 404);
  }

  type ItemVendaShape = { produto_id: string; quantidade: number; preco_unitario: number };
  const itensNovos: ItemVendaShape[] = body.itens ?? vendaExistente.itens.map((i: { produto_id: string; quantidade: number; preco_unitario: unknown }) => ({
    produto_id: i.produto_id,
    quantidade: i.quantidade,
    preco_unitario: Number(i.preco_unitario)
  }));
  const subtotalCalc = itensNovos.reduce(
    (acc: number, item: ItemVendaShape) => acc + Number(item.preco_unitario) * Number(item.quantidade),
    0
  );
  const percentualDesconto =
    body.desconto_percentual !== undefined
      ? Math.min(100, Math.max(0, body.desconto_percentual))
      : null;
  const valorDesconto =
    percentualDesconto !== null
      ? subtotalCalc * (percentualDesconto / 100)
      : Number(vendaExistente.desconto);
  const forma_pagamento = body.forma_pagamento ?? vendaExistente.forma_pagamento;
  const statusNovo = body.status ?? vendaExistente.status;
  const cliente_id = body.cliente_id ?? vendaExistente.cliente_id;

  // Validar cliente se informado
  if (body.cliente_id) {
    const cliente = await prisma.cliente.findFirst({ where: { id: body.cliente_id } });
    if (!cliente) throw new AppError('Cliente não encontrado', 404);
  }

  // Validar produtos e estoque para os novos itens (será revalidado na tx após reverter estoque)
  for (const item of itensNovos) {
    const produto = await prisma.produto.findUnique({ where: { id: item.produto_id } });
    if (!produto) throw new AppError(`Produto ${item.produto_id} não encontrado`, 404);
  }

  const total = subtotalCalc - valorDesconto;

  const vendaAtualizada = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const statusAntigo = vendaExistente.status as 'PAGO' | 'PENDENTE';

    // 1) Reverter estoque dos itens antigos (se a venda estava PAGA)
    if (statusAntigo === 'PAGO') {
      for (const item of vendaExistente.itens) {
        await tx.produto.update({
          where: { id: item.produto_id },
          data: { estoque_atual: { increment: item.quantidade } }
        });
      }
    }

    // 2) Remover itens antigos (evita duplicados)
    await tx.itemVenda.deleteMany({ where: { venda_id: id } });

    // 3) Criar novos itens
    await tx.itemVenda.createMany({
      data: itensNovos.map((item: ItemVendaShape) => ({
        venda_id: id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario
      }))
    });

    // 4) Se nova status for PAGO, validar estoque e decrementar
    if (statusNovo === 'PAGO') {
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
    await tx.venda.update({
      where: { id },
      data: {
        cliente_id,
        total,
        desconto: valorDesconto,
        forma_pagamento,
        status: statusNovo
      }
    });

    return tx.venda.findUnique({
      where: { id },
      include: {
        cliente: true,
        itens: { include: { produto: true } }
      }
    });
  });

  res.json(vendaAtualizada);
};

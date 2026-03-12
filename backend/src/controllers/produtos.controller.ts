import { Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { invalidatePrefix } from '../services/cache.service';
import { getCurrentOrganizationId, organizationFilter, assertRecordOwnership } from '../lib/tenant';

const prisma = new PrismaClient();

/** Janela em segundos para considerar duplicata (mesmo nome + categoria). */
const DUPLICIDADE_JANELA_SEGUNDOS = 30;

/** Cache de idempotência para POST /produtos: chave -> { statusCode, body, createdAt }. TTL 60s. */
const IDEMPOTENCY_TTL_MS = 60_000;
const produtoIdempotencyCache = new Map<string, { statusCode: number; body: unknown; createdAt: number }>();

function purgeExpiredProdutoIdempotency() {
  const now = Date.now();
  for (const [key, entry] of produtoIdempotencyCache.entries()) {
    if (now - entry.createdAt > IDEMPOTENCY_TTL_MS) produtoIdempotencyCache.delete(key);
  }
}
/** Acesso a sql/empty/join (tipos podem não estar exportados em algumas versões do @prisma/client) */
const PrismaRaw = Prisma as typeof Prisma & {
  sql: (t: TemplateStringsArray, ...v: unknown[]) => unknown;
  empty: unknown;
  join: (arr: string[]) => unknown;
};

const itemTypeSchema = z.enum(['product', 'service']).optional().default('product');
const pricingTypeSchema = z.enum(['fixed', 'manual', 'percentage']).optional().nullable();
const percentageBaseSchema = z.enum(['over_parts_total', 'over_sale_total', 'over_previous_subtotal']).optional().nullable();

const produtoSchemaBase = z.object({
  item_type: itemTypeSchema,
  nome: z.string().min(1, 'Nome é obrigatório').max(200),
  preco: z.number().nonnegative('Preço não pode ser negativo'),
  custo: z.number().nonnegative('Custo não pode ser negativo'),
  estoque_atual: z.number().int().nonnegative('Estoque atual não pode ser negativo').optional(),
  estoque_minimo: z.number().int().nonnegative('Estoque mínimo não pode ser negativo').optional(),
  categoria_id: z.string().uuid('Categoria é obrigatória'),
  supplier_id: z.string().uuid().optional().nullable(),
  linha: z.string().max(100).optional().nullable(),
  business_area_id: z.string().uuid().optional().nullable(),
  // Serviço
  pricing_type: pricingTypeSchema,
  percentage_value: z.number().min(0).max(100).optional().nullable(),
  percentage_base: percentageBaseSchema,
  observacao: z.string().max(2000).optional().nullable()
});

const produtoSchema = produtoSchemaBase.refine((data) => {
  if (data.item_type === 'service') {
    if (data.pricing_type === 'percentage' && (data.percentage_value == null || data.percentage_base == null)) return false;
    return true;
  }
  return true;
}, { message: 'Serviço percentual exige percentual e base do cálculo', path: ['percentage_value'] });

/** Schema para atualização parcial (ZodObject.partial(); .refine() retorna ZodEffects que não tem .partial()) */
const produtoUpdateSchema = produtoSchemaBase.partial();

type FiltroDesempenho = 'todos' | 'mais_vendidos' | 'menos_vendidos' | 'estoque_baixo';
type PeriodoDesempenho = 'este_mes' | 'ultimos_3_meses';

/** Início e fim do período (UTC) para filtrar vendas PAGO */
function getPeriodoRange(periodo: PeriodoDesempenho): { inicio: Date; fim: Date } {
  const now = new Date();
  const fim = new Date();
  if (periodo === 'este_mes') {
    const inicio = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    return { inicio, fim };
  }
  // ultimos_3_meses: de (hoje - 3 meses) até agora
  const inicio = new Date(now);
  inicio.setUTCMonth(inicio.getUTCMonth() - 3);
  inicio.setUTCHours(0, 0, 0, 0);
  return { inicio, fim };
}

function parseCategoriaIds(query: any): string[] {
  const v = query.categoria_ids;
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [v];
}

export const listarProdutos = async (req: AuthRequest, res: Response) => {
  const userId = getCurrentOrganizationId(req);
  const filtro = (req.query.filtro as FiltroDesempenho) || 'todos';
  const periodo = (req.query.periodo as PeriodoDesempenho) || 'este_mes';
  const categoriaIds = parseCategoriaIds(req.query);
  const nome = (req.query.nome as string)?.trim() || '';
  const itemTypeParam = (req.query.item_type as string)?.toLowerCase();
  const itemTypeFilter = itemTypeParam === 'service' ? 'service' : itemTypeParam === 'product' ? 'product' : null;
  const businessAreaId = (req.query.business_area_id as string)?.trim() || null;
  const validFiltros: FiltroDesempenho[] = ['todos', 'mais_vendidos', 'menos_vendidos', 'estoque_baixo'];
  const validPeriodos: PeriodoDesempenho[] = ['este_mes', 'ultimos_3_meses'];
  const filtroSafe = validFiltros.includes(filtro) ? filtro : 'todos';
  const periodoSafe = validPeriodos.includes(periodo) ? periodo : 'este_mes';

  const { inicio, fim } = getPeriodoRange(periodoSafe);

  const whereUsuarioId = PrismaRaw.sql`AND p.usuario_id = ${userId}`;
  const whereCategoria = categoriaIds.length > 0
    ? PrismaRaw.sql`AND p.categoria_id IN (${PrismaRaw.join(categoriaIds)})`
    : PrismaRaw.empty;
  const whereNome = nome
    ? PrismaRaw.sql`AND p.nome ILIKE ${'%' + nome + '%'}`
    : PrismaRaw.empty;
  const whereEstoqueBaixo = filtroSafe === 'estoque_baixo'
    ? PrismaRaw.sql`AND p.item_type = 'product' AND p.estoque_atual <= p.estoque_minimo`
    : PrismaRaw.empty;
  const whereItemType =
    itemTypeFilter === 'service'
      ? PrismaRaw.sql`AND p.item_type = 'service'`
      : itemTypeFilter === 'product'
        ? PrismaRaw.sql`AND p.item_type = 'product'`
        : PrismaRaw.empty;
  const whereBusinessArea = businessAreaId
    ? PrismaRaw.sql`AND p.business_area_id = ${businessAreaId}`
    : PrismaRaw.empty;

  type Row = {
    id: string;
    item_type: string;
    nome: string;
    preco: unknown;
    custo: unknown;
    estoque_atual: number;
    estoque_minimo: number;
    categoria_id: string;
    categoria_nome: string | null;
    supplier_id: string | null;
    supplier_nome: string | null;
    linha: string | null;
    business_area_id: string | null;
    pricing_type: string | null;
    percentage_value: unknown;
    percentage_base: string | null;
    observacao: string | null;
    createdAt: Date;
    updatedAt: Date;
    total_sold: bigint;
  };

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT p.id, p.item_type, p.nome, p.preco, p.custo, p.estoque_atual, p.estoque_minimo, p.categoria_id, c.nome AS categoria_nome,
      p.supplier_id, s.name AS supplier_nome, p.linha, p.business_area_id, p.pricing_type, p.percentage_value, p.percentage_base, p.observacao,
      p."createdAt", p."updatedAt", COALESCE(SUM(iv.quantidade), 0)::bigint AS total_sold
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN itens_venda iv ON iv.produto_id = p.id
    LEFT JOIN vendas v ON v.id = iv.venda_id AND v.status = 'PAGO' AND v."createdAt" >= ${inicio} AND v."createdAt" <= ${fim}
    WHERE 1=1
    ${whereUsuarioId}
    ${whereCategoria}
    ${whereNome}
    ${whereEstoqueBaixo}
    ${whereItemType}
    ${whereBusinessArea}
    GROUP BY p.id, p.item_type, p.nome, p.preco, p.custo, p.estoque_atual, p.estoque_minimo, p.categoria_id, c.nome, p.supplier_id, s.name, p.linha, p.business_area_id, p.pricing_type, p.percentage_value, p.percentage_base, p.observacao, p."createdAt", p."updatedAt"
    ORDER BY p."createdAt" DESC
  `;

  const produtos = rows.map((r: Row) => ({
    id: r.id,
    item_type: r.item_type ?? 'product',
    nome: r.nome,
    preco: Number(r.preco),
    custo: Number(r.custo),
    estoque_atual: r.estoque_atual,
    estoque_minimo: r.estoque_minimo,
    categoria_id: r.categoria_id,
    categoria_nome: r.categoria_nome ?? undefined,
    supplier_id: r.supplier_id ?? undefined,
    supplier_nome: r.supplier_nome ?? undefined,
    linha: r.linha ?? undefined,
    business_area_id: r.business_area_id ?? undefined,
    pricing_type: r.pricing_type ?? undefined,
    percentage_value: r.percentage_value != null ? Number(r.percentage_value) : undefined,
    percentage_base: r.percentage_base ?? undefined,
    observacao: r.observacao ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    qtdVendidaMesAtual: Number(r.total_sold)
  }));

  type ProdutoListItem = { qtdVendidaMesAtual: number };
  if (filtroSafe === 'mais_vendidos') {
    produtos.sort((a: ProdutoListItem, b: ProdutoListItem) => b.qtdVendidaMesAtual - a.qtdVendidaMesAtual);
  } else if (filtroSafe === 'menos_vendidos') {
    produtos.sort((a: ProdutoListItem, b: ProdutoListItem) => a.qtdVendidaMesAtual - b.qtdVendidaMesAtual);
  }

  res.json(produtos);
};

export const obterProduto = async (req: AuthRequest, res: Response) => {
  const userId = getCurrentOrganizationId(req);
  const { id } = req.params;

  const produto = await prisma.produto.findFirst({
    where: { id, ...organizationFilter(userId) },
    include: { categoria: true }
  });

  if (!produto) {
    throw new AppError('Produto não encontrado', 404);
  }

  res.json(produto);
};

/** GET /produtos/historico-compras — listagem consolidada de compras (filtros + cards) */
export const listHistoricoCompras = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const period = (req.query.period as string) || '30';
  const startDate = (req.query.start_date as string)?.trim();
  const endDate = (req.query.end_date as string)?.trim();
  const productId = (req.query.product_id as string)?.trim();
  const supplierId = (req.query.supplier_id as string)?.trim();
  const businessAreaId = (req.query.business_area_id as string)?.trim() || null;
  const search = (req.query.search as string)?.trim();

  let dateFrom: Date;
  let dateTo: Date;
  if (period === 'custom' && startDate && endDate) {
    dateFrom = new Date(startDate);
    dateTo = new Date(endDate);
  } else {
    const days = period === '7' ? 6 : period === '90' ? 89 : 29;
    dateTo = new Date();
    dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
  }
  dateFrom.setHours(0, 0, 0, 0);
  dateTo.setHours(23, 59, 59, 999);

  const where: Record<string, unknown> = {
    usuario_id: userId,
    created_at: { gte: dateFrom, lte: dateTo }
  };
  if (productId) where.product_id = productId;
  if (supplierId) where.supplier_id = supplierId;
  if (businessAreaId) where.business_area_id = businessAreaId;
  if (search) {
    where.product = { nome: { contains: search, mode: 'insensitive' } };
  }

  const [items, allForSummary] = await Promise.all([
    prisma.productPurchaseHistory.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        product: { select: { id: true, nome: true } },
        supplier: { select: { id: true, name: true } },
        business_area: { select: { id: true, name: true } },
        financial_transaction: { select: { notes: true, description: true } }
      }
    }),
    prisma.productPurchaseHistory.findMany({
      where: { usuario_id: userId, created_at: { gte: dateFrom, lte: dateTo }, ...(businessAreaId ? { business_area_id: businessAreaId } : {}) },
      include: { product: { select: { id: true, nome: true } }, supplier: { select: { id: true, name: true } } }
    })
  ]);

  const totalComprado = allForSummary.reduce((acc, h) => acc + Number(h.total_cost), 0);
  const quantidadeCompras = allForSummary.length;
  const byProduct = new Map<string, { nome: string; qty: number }>();
  const bySupplier = new Map<string, { name: string; count: number }>();
  let ultimoFornecedor: { id: string; name: string } | null = null;
  let lastDate: Date | null = null;
  for (const h of allForSummary) {
    const p = byProduct.get(h.product_id);
    const nome = h.product.nome;
    if (p) {
      p.qty += h.quantity;
    } else {
      byProduct.set(h.product_id, { nome, qty: h.quantity });
    }
    if (h.supplier_id && h.supplier) {
      const s = bySupplier.get(h.supplier_id);
      if (s) s.count += 1;
      else bySupplier.set(h.supplier_id, { name: h.supplier.name, count: 1 });
      if (!lastDate || h.created_at > lastDate) {
        lastDate = h.created_at;
        ultimoFornecedor = { id: h.supplier_id, name: h.supplier.name };
      }
    }
  }
  const produtoMaisComprado = byProduct.size
    ? [...byProduct.entries()].sort((a, b) => b[1].qty - a[1].qty)[0]
    : null;
  const fornecedorMaisUtilizado = bySupplier.size
    ? [...bySupplier.entries()].sort((a, b) => b[1].count - a[1].count)[0]
    : null;

  res.json({
    items: items.map((h) => ({
      id: h.id,
      date: h.created_at.toISOString().slice(0, 10),
      product_id: h.product_id,
      product_name: h.product.nome,
      supplier_id: h.supplier_id,
      supplier_name: h.supplier?.name ?? null,
      quantity: h.quantity,
      unit_cost: Number(h.unit_cost),
      total: Number(h.total_cost),
      area_id: h.business_area_id,
      area_name: h.business_area?.name ?? null,
      explicacao: h.financial_transaction?.notes ?? h.financial_transaction?.description ?? null
    })),
    summary: {
      totalComprado,
      quantidadeCompras,
      ultimoFornecedor,
      produtoMaisComprado: produtoMaisComprado
        ? { product_id: produtoMaisComprado[0], nome: produtoMaisComprado[1].nome, quantidade: produtoMaisComprado[1].qty }
        : null,
      fornecedorMaisUtilizado: fornecedorMaisUtilizado
        ? { supplier_id: fornecedorMaisUtilizado[0], name: fornecedorMaisUtilizado[1].name, compras: fornecedorMaisUtilizado[1].count }
        : null
    }
  });
};

/** GET /produtos/:id/purchase-history — histórico de compras do produto (do usuário) */
export const historicoCompras = async (req: AuthRequest, res: Response) => {
  const userId = getCurrentOrganizationId(req);
  const { id } = req.params;
  const produto = await prisma.produto.findFirst({ where: { id, ...organizationFilter(userId) } });
  if (!produto) throw new AppError('Produto não encontrado', 404);

  const list = await prisma.productPurchaseHistory.findMany({
    where: { product_id: id, usuario_id: userId },
    orderBy: { created_at: 'desc' },
    take: 100,
    include: { supplier: { select: { id: true, name: true } } }
  });

  res.json(
    list.map((h) => ({
      id: h.id,
      date: h.created_at.toISOString().slice(0, 10),
      supplier_id: h.supplier_id,
      supplier_name: h.supplier?.name ?? null,
      quantity: h.quantity,
      unit_cost: Number(h.unit_cost),
      total_cost: Number(h.total_cost)
    }))
  );
};

export const criarProduto = async (req: AuthRequest, res: Response) => {
  const idempotencyKey = (req.headers['idempotency-key'] ?? req.headers['x-idempotency-key']) as string | undefined;

  purgeExpiredProdutoIdempotency();
  if (idempotencyKey?.trim()) {
    const cached = produtoIdempotencyCache.get(idempotencyKey.trim());
    if (cached && Date.now() - cached.createdAt <= IDEMPOTENCY_TTL_MS) {
      return res.status(cached.statusCode).json(cached.body);
    }
  }

  const usuarioId = getCurrentOrganizationId(req);
  try {
    const data = produtoSchema.parse(req.body);

    const produto = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const categoria = await tx.categoria.findFirst({ where: { id: data.categoria_id, usuario_id: usuarioId } });
      if (!categoria) throw new AppError('Categoria não encontrada', 400);

      const desde = new Date(Date.now() - DUPLICIDADE_JANELA_SEGUNDOS * 1000);
      const duplicata = await tx.produto.findFirst({
        where: {
          usuario_id: usuarioId,
          categoria_id: data.categoria_id,
          item_type: data.item_type,
          nome: { equals: data.nome.trim(), mode: 'insensitive' },
          createdAt: { gte: desde }
        }
      });
      if (duplicata) {
        throw new AppError(
          'Já existe um produto com o mesmo nome nesta categoria criado há pouco. Aguarde alguns segundos ou use outro nome.',
          409
        );
      }

      const created = await tx.produto.create({
        data: {
          usuario_id: usuarioId,
          item_type: data.item_type,
          nome: data.nome.trim(),
          preco: data.preco,
          custo: data.custo,
          estoque_atual: data.item_type === 'service' ? 0 : (data.estoque_atual ?? 0),
          estoque_minimo: data.item_type === 'service' ? 0 : (data.estoque_minimo ?? 0),
          categoria_id: data.categoria_id,
          ...(data.item_type === 'product' && data.supplier_id != null && data.supplier_id.trim() !== '' && { supplier_id: data.supplier_id }),
          ...(data.item_type === 'product' && data.linha != null && data.linha.trim() !== '' && { linha: data.linha.trim() }),
          ...(data.business_area_id != null && data.business_area_id.trim() !== '' && { business_area_id: data.business_area_id }),
          ...(data.item_type === 'service' && {
            pricing_type: data.pricing_type ?? undefined,
            percentage_value: data.percentage_value ?? undefined,
            percentage_base: data.percentage_base ?? undefined,
            observacao: data.observacao?.trim() || null
          })
        },
        include: { categoria: true, supplier: { select: { id: true, name: true } }, business_area: { select: { id: true, name: true } } }
      });
      return created;
    });

    const body = JSON.parse(JSON.stringify(produto));
    if (idempotencyKey?.trim()) {
      produtoIdempotencyCache.set(idempotencyKey.trim(), {
        statusCode: 201,
        body,
        createdAt: Date.now()
      });
    }
    res.status(201).json(body);

    // invalida cache de dashboard para este usuário (estoque baixo / totais)
    invalidatePrefix(`dashboard:summary:${req.userId}:`);
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    if (error.code === 'P2002') {
      throw new AppError(
        'Já existe um produto com o mesmo nome nesta categoria. Não é possível duplicar.',
        409
      );
    }
    throw error;
  }
};

export const atualizarProduto = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
  const { id } = req.params;
  const data = produtoUpdateSchema.parse(req.body);

  const produtoExistente = await prisma.produto.findFirst({
    where: { id, ...organizationFilter(usuarioId) }
  });

  assertRecordOwnership(produtoExistente, usuarioId, (p) => p?.usuario_id ?? undefined, 'Produto');

  // Validar estoque não negativo
  if (data.estoque_atual !== undefined && data.estoque_atual < 0) {
    throw new AppError('Estoque não pode ser negativo', 400);
  }

  if (data.categoria_id) {
    const categoria = await prisma.categoria.findFirst({ where: { id: data.categoria_id, usuario_id: usuarioId } });
    if (!categoria) throw new AppError('Categoria não encontrada', 400);
  }
  if (data.supplier_id !== undefined && data.supplier_id) {
    const supplier = await prisma.supplier.findFirst({ where: { id: data.supplier_id, usuario_id: usuarioId } });
    if (!supplier) throw new AppError('Fornecedor não encontrado', 400);
  }

  const updateData = { ...data } as Record<string, unknown>;
  if ('linha' in updateData && updateData.linha !== undefined) {
    updateData.linha = updateData.linha && typeof updateData.linha === 'string' && (updateData.linha as string).trim() !== '' ? (updateData.linha as string).trim() : null;
  }
  if (data.supplier_id === null || data.supplier_id === '') {
    updateData.supplier_id = null;
  }
  if (data.item_type === 'service') {
    updateData.supplier_id = null;
    updateData.linha = null;
    if (updateData.estoque_atual === undefined) updateData.estoque_atual = 0;
    if (updateData.estoque_minimo === undefined) updateData.estoque_minimo = 0;
  }
  if (data.business_area_id === null || data.business_area_id === '') {
    updateData.business_area_id = null;
  }

  const produto = await prisma.produto.update({
    where: { id },
    data: updateData,
    include: { categoria: true, supplier: { select: { id: true, name: true } }, business_area: { select: { id: true, name: true } } }
  });

  res.json(produto);

  // invalida cache de dashboard para este usuário (estoque / desempenho)
  invalidatePrefix(`dashboard:summary:${req.userId}:`);
};

export const excluirProduto = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
  const { id } = req.params;

  const produto = await prisma.produto.findFirst({
    where: { id, ...organizationFilter(usuarioId) }
  });

  assertRecordOwnership(produto, usuarioId, (p) => p?.usuario_id ?? undefined, 'Produto');

  const itemVenda = await prisma.itemVenda.findFirst({
    where: { produto_id: id }
  });

  if (itemVenda) {
    throw new AppError('Não é possível excluir produto que já foi vendido', 400);
  }

  await prisma.produto.delete({
    where: { id }
  });

  res.status(204).send();

  invalidatePrefix(`dashboard:summary:${req.userId}:`);
};

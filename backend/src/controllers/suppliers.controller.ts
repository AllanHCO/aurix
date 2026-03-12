import { Response } from 'express';
import { z } from 'zod';
import { FinancialTransactionStatus } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const supplierBodySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  phone: z.string().max(20).nullable().optional(),
  whatsapp: z.string().max(20).nullable().optional(),
  email: z.string().email().max(255).nullable().optional().or(z.literal('')),
  cpf_cnpj: z.string().max(18).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  business_area_id: z.string().uuid().nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  address: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  is_active: z.boolean().optional()
});

const normalizeSupplierBody = (d: z.infer<typeof supplierBodySchema>) => ({
  ...d,
  email: d.email === '' ? null : d.email,
  phone: d.phone ?? null,
  whatsapp: d.whatsapp ?? null,
  cpf_cnpj: d.cpf_cnpj ?? null,
  category_id: d.category_id ?? null,
  business_area_id: d.business_area_id ?? null,
  city: d.city ?? null,
  address: d.address ?? null,
  notes: d.notes ?? null,
  is_active: d.is_active ?? true
});

const createBodySchema = supplierBodySchema.transform(normalizeSupplierBody);
const updateBodySchema = supplierBodySchema.partial().transform((d) => ({
  ...d,
  email: d.email === '' ? null : d.email ?? undefined,
  phone: d.phone ?? undefined,
  whatsapp: d.whatsapp ?? undefined,
  cpf_cnpj: d.cpf_cnpj ?? undefined,
  category_id: d.category_id ?? undefined,
  city: d.city ?? undefined,
  address: d.address ?? undefined,
  notes: d.notes ?? undefined,
  is_active: d.is_active ?? undefined
}));

/** GET /fornecedores?search=&category_id=&city=&is_active= */
export const listar = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const search = (req.query.search as string)?.trim();
  const category_id = req.query.category_id as string | undefined;
  const business_area_id = (req.query.business_area_id ?? req.query.areaId) as string | undefined;
  const city = (req.query.city as string)?.trim();
  const is_active = req.query.is_active as string | undefined;

  const where: { usuario_id: string; name?: { contains: string; mode: 'insensitive' }; category_id?: string; business_area_id?: string | null; city?: { equals: string; mode: 'insensitive' }; is_active?: boolean } = { usuario_id: userId };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (category_id) where.category_id = category_id;
  if (business_area_id?.trim()) where.business_area_id = business_area_id.trim();
  if (city) where.city = { equals: city, mode: 'insensitive' };
  if (is_active === 'true') where.is_active = true;
  if (is_active === 'false') where.is_active = false;

  let suppliers: Awaited<ReturnType<typeof prisma.supplier.findMany>>;
  try {
    suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { produtos: true, transactions: true } }
      }
    });
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
    if (msg.includes('Unknown argument') && msg.includes('business_area_id')) {
      const whereFallback = { ...where };
      delete (whereFallback as { business_area_id?: string | null }).business_area_id;
      suppliers = await prisma.supplier.findMany({
        where: whereFallback,
        orderBy: { name: 'asc' },
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { produtos: true, transactions: true } }
        }
      });
    } else {
      throw err;
    }
  }

  const ids = suppliers.map((s) => s.id).filter(Boolean) as string[];
  const lastBySupplier = new Map<string, string>();
  const totalBySupplier = new Map<string, number>();

  if (ids.length > 0) {
    const whereTx = {
      usuario_id: userId,
      supplier_id: { in: ids },
      type: 'expense' as const,
      status: { not: FinancialTransactionStatus.cancelled }
    };
    const [totals, lastDates] = await Promise.all([
      prisma.financialTransaction.groupBy({
        by: ['supplier_id'],
        where: whereTx,
        _sum: { value: true }
      }),
      prisma.financialTransaction.findMany({
        where: whereTx,
        select: { supplier_id: true, date: true },
        orderBy: { date: 'desc' }
      })
    ]);
    for (const r of lastDates) {
      if (r.supplier_id && !lastBySupplier.has(r.supplier_id)) lastBySupplier.set(r.supplier_id, r.date.toISOString().slice(0, 10));
    }
    for (const t of totals) {
      if (t.supplier_id) totalBySupplier.set(t.supplier_id, Number(t._sum.value ?? 0));
    }
  }

  res.json(
    suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      whatsapp: s.whatsapp,
      email: s.email,
      cpf_cnpj: s.cpf_cnpj,
      category_id: s.category_id,
      business_area_id: s.business_area_id,
      category: s.category,
      city: s.city,
      address: s.address,
      notes: s.notes,
      is_active: s.is_active,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      produtosCount: s._count.produtos,
      transactionsCount: s._count.transactions,
      totalGasto: totalBySupplier.get(s.id) ?? 0,
      ultimaCompra: lastBySupplier.get(s.id) ?? null
    }))
  );
};

/** GET /fornecedores/:id — detalhe com movimentações, produtos (custo, preço, estoque, última venda), ticket médio */
export const obterPorId = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const supplier = await prisma.supplier.findFirst({
    where: { id, usuario_id: userId },
    include: {
      category: { select: { id: true, name: true } },
      produtos: { select: { id: true, nome: true, preco: true, custo: true, estoque_atual: true } }
    }
  });
  if (!supplier) throw new AppError('Fornecedor não encontrado', 404);

  const whereTx = {
    usuario_id: userId,
    supplier_id: id,
    type: 'expense' as const,
    status: { not: FinancialTransactionStatus.cancelled }
  };
  const [totals, lastTx, movimentacoes, lastSaleByProduto, comprasRealizadas] = await Promise.all([
    prisma.financialTransaction.aggregate({
      where: whereTx,
      _sum: { value: true },
      _count: true
    }),
    prisma.financialTransaction.findFirst({
      where: whereTx,
      orderBy: { date: 'desc' },
      select: { date: true, value: true, description: true }
    }),
    prisma.financialTransaction.findMany({
      where: whereTx,
      orderBy: { date: 'desc' },
      take: 50,
      include: { category: { select: { id: true, name: true } } }
    }),
    supplier.produtos.length > 0
      ? prisma.itemVenda.findMany({
          where: { produto_id: { in: supplier.produtos.map((p) => p.id) } },
          select: { produto_id: true, venda: { select: { createdAt: true } } }
        })
      : Promise.resolve([]),
    prisma.productPurchaseHistory.findMany({
      where: { supplier_id: id, usuario_id: userId },
      orderBy: { created_at: 'desc' },
      take: 50,
      include: { product: { select: { id: true, nome: true } } }
    })
  ]);

  const ultimaVendaByProduto = new Map<string, string>();
  const byProduto = new Map<string, Date>();
  for (const iv of lastSaleByProduto) {
    if (iv.venda?.createdAt) {
      const cur = byProduto.get(iv.produto_id);
      if (!cur || iv.venda.createdAt > cur) byProduto.set(iv.produto_id, iv.venda.createdAt);
    }
  }
  byProduto.forEach((d, pid) => ultimaVendaByProduto.set(pid, d.toISOString().slice(0, 10)));

  const totalGasto = Number(totals._sum.value ?? 0);
  const transactionsCount = totals._count;
  const ticketMedio = transactionsCount > 0 ? totalGasto / transactionsCount : 0;

  const produtos = supplier.produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    custo: Number(p.custo),
    preco: Number(p.preco),
    estoque_atual: p.estoque_atual,
    ultimaVenda: ultimaVendaByProduto.get(p.id) ?? null
  }));

  const movimentacoesFormatted = movimentacoes.map((t) => ({
    id: t.id,
    date: t.date.toISOString().slice(0, 10),
    description: t.description,
    category: t.category?.name ?? '—',
    value: Number(t.value),
    status: t.status,
    source_type: t.source_type
  }));

  const comprasFormatted = comprasRealizadas.map((c) => ({
    id: c.id,
    product_id: c.product_id,
    product_name: c.product.nome,
    quantity: c.quantity,
    total_cost: Number(c.total_cost),
    date: c.created_at.toISOString().slice(0, 10)
  }));

  res.json({
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    whatsapp: supplier.whatsapp,
    email: supplier.email,
    cpf_cnpj: supplier.cpf_cnpj,
    category_id: supplier.category_id,
    category: supplier.category,
    city: supplier.city,
    address: supplier.address,
    notes: supplier.notes,
    is_active: supplier.is_active,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
    totalGasto,
    transactionsCount,
    ticketMedio,
    ultimaCompra: lastTx ? { date: lastTx.date.toISOString().slice(0, 10), value: Number(lastTx.value), description: lastTx.description } : null,
    movimentacoes: movimentacoesFormatted,
    compras: comprasFormatted,
    produtos,
    alertaSemMovimentacoes: transactionsCount === 0
  });
};

/** POST /fornecedores */
export const criar = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const body = createBodySchema.parse(req.body);
  if (body.category_id) {
    const cat = await prisma.supplierCategory.findFirst({ where: { id: body.category_id, usuario_id: userId } });
    if (!cat) throw new AppError('Categoria não encontrada', 404);
  }
  let business_area_id: string | null = body.business_area_id ?? null;
  if (business_area_id) {
    const area = await prisma.businessArea.findFirst({ where: { id: business_area_id, usuario_id: userId, is_active: true } });
    if (!area) business_area_id = null;
  }
  const supplier = await prisma.supplier.create({
    data: {
      usuario_id: userId,
      name: body.name,
      phone: body.phone,
      whatsapp: body.whatsapp,
      email: body.email,
      cpf_cnpj: body.cpf_cnpj,
      category_id: body.category_id,
      business_area_id,
      city: body.city,
      address: body.address,
      notes: body.notes,
      is_active: body.is_active
    },
    include: { category: { select: { id: true, name: true } } }
  });
  res.status(201).json(supplier);
};

/** PUT /fornecedores/:id */
export const atualizar = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const body = updateBodySchema.parse(req.body);
  const existing = await prisma.supplier.findFirst({ where: { id, usuario_id: userId } });
  if (!existing) throw new AppError('Fornecedor não encontrado', 404);
  if (body.category_id !== undefined && body.category_id) {
    const cat = await prisma.supplierCategory.findFirst({ where: { id: body.category_id, usuario_id: userId } });
    if (!cat) throw new AppError('Categoria não encontrada', 404);
  }
  let business_area_id: string | null | undefined = body.business_area_id;
  if (business_area_id !== undefined && business_area_id != null) {
    const area = await prisma.businessArea.findFirst({ where: { id: business_area_id, usuario_id: userId, is_active: true } });
    business_area_id = area?.id ?? null;
  }
  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      phone: body.phone ?? undefined,
      whatsapp: body.whatsapp ?? undefined,
      email: body.email ?? undefined,
      cpf_cnpj: body.cpf_cnpj ?? undefined,
      category_id: body.category_id ?? undefined,
      ...(business_area_id !== undefined && { business_area_id }),
      city: body.city ?? undefined,
      address: body.address ?? undefined,
      notes: body.notes ?? undefined,
      is_active: body.is_active ?? undefined
    },
    include: { category: { select: { id: true, name: true } } }
  });
  res.json(supplier);
};

/** DELETE /fornecedores/:id */
export const excluir = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const existing = await prisma.supplier.findFirst({
    where: { id, usuario_id: userId },
    include: { _count: { select: { produtos: true, transactions: true } } }
  });
  if (!existing) throw new AppError('Fornecedor não encontrado', 404);
  if (existing._count.produtos > 0 || existing._count.transactions > 0) {
    throw new AppError('Fornecedor vinculado a produtos ou movimentações. Desvincule antes de excluir.', 400);
  }
  await prisma.supplier.delete({ where: { id } });
  res.status(204).send();
};

/** GET /fornecedores/analysis?startDate=&endDate= */
export const analysis = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const startDate = (req.query.startDate as string) || undefined;
  const endDate = (req.query.endDate as string) || undefined;

  const now = new Date();
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = startDate
    ? new Date(startDate)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 364, 0, 0, 0, 0);

  const where = {
    usuario_id: userId,
    type: 'expense' as const,
    status: { not: FinancialTransactionStatus.cancelled },
    supplier_id: { not: null },
    date: { gte: start, lte: end }
  };

  const bySupplier = await prisma.financialTransaction.groupBy({
    by: ['supplier_id'],
    where,
    _sum: { value: true },
    _count: true
  });

  // Ordenar por total gasto (desc) em memória para compatibilidade com todas as versões do Prisma
  bySupplier.sort((a, b) => Number(b._sum.value ?? 0) - Number(a._sum.value ?? 0));

  const supplierIds = (bySupplier.map((r) => r.supplier_id).filter(Boolean) as string[]);
  const suppliers = supplierIds.length
    ? await prisma.supplier.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, name: true }
      })
    : [];
  const nameMap = new Map(suppliers.map((s) => [s.id, s.name]));

  const totalGeral = bySupplier.reduce((acc, r) => acc + Number(r._sum.value ?? 0), 0);

  const topFornecedores = bySupplier.map((r) => ({
    supplier_id: r.supplier_id,
    supplier_name: nameMap.get(r.supplier_id!) ?? '—',
    totalGasto: Number(r._sum.value ?? 0),
    quantidadeCompras: r._count
  }));

  const totalTransacoes = bySupplier.reduce((acc, r) => acc + r._count, 0);
  const ticketMedio = totalTransacoes > 0 ? totalGeral / totalTransacoes : 0;
  const qtdFornecedoresAtivos = bySupplier.length;

  res.json({
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    totalGeral,
    topFornecedores,
    dependenciaPercentual: totalGeral > 0 && topFornecedores[0]
      ? (Number(topFornecedores[0].totalGasto) / totalGeral) * 100
      : null,
    qtdFornecedoresAtivos,
    ticketMedio,
    totalTransacoes
  });
};

/** GET /fornecedores/stats — totais para indicadores no topo (total fornecedores, ativos, gasto total) */
export const stats = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [total, ativos, gastoResult] = await Promise.all([
    prisma.supplier.count({ where: { usuario_id: userId } }),
    prisma.supplier.count({ where: { usuario_id: userId, is_active: true } }),
    prisma.financialTransaction.aggregate({
      where: {
        usuario_id: userId,
        type: 'expense',
        status: { not: FinancialTransactionStatus.cancelled },
        supplier_id: { not: null }
      },
      _sum: { value: true }
    })
  ]);
  res.json({
    total,
    ativos,
    gastoTotal: Number(gastoResult._sum.value ?? 0)
  });
};

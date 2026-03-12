import { Response } from 'express';
import { z } from 'zod';
import { FinancialTransactionStatus } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const typeSchema = z.enum(['income', 'expense']);
const sourceSchema = z.enum(['sale', 'manual', 'adjustment', 'service_order']);
const statusSchema = z.enum(['confirmed', 'pending', 'cancelled']);

const createBodySchema = z.object({
  type: typeSchema,
  category_id: z.string().uuid(),
  business_area_id: z.string().uuid().nullable().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  description: z.string().min(1, 'Descrição é obrigatória').max(500),
  value: z.number().positive('Valor deve ser positivo'),
  status: statusSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(5000).nullable().optional()
});

const updateBodySchema = z.object({
  category_id: z.string().uuid().optional(),
  business_area_id: z.string().uuid().nullable().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(500).optional(),
  value: z.number().positive().optional(),
  status: statusSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(5000).nullable().optional()
});

/** GET /financeiro/transactions — listagem com filtros (period, type, status, category_id, search, page, limit) */
export const listarTransacoes = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const type = req.query.type as string | undefined;
  const status = req.query.status as string | undefined;
  const category_id = req.query.category_id as string | undefined;
  const business_area_id = (req.query.business_area_id ?? req.query.areaId) as string | undefined;
  const search = (req.query.search as string)?.trim();
  const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 20));

  const where: {
    usuario_id: string;
    date?: { gte?: Date; lte?: Date };
    type?: 'income' | 'expense';
    status?: 'confirmed' | 'pending' | 'cancelled';
    category_id?: string;
    business_area_id?: string | null;
    description?: { contains: string; mode: 'insensitive' };
  } = { usuario_id: userId };

  if (startDate) where.date = { ...where.date, gte: new Date(startDate) };
  if (endDate) where.date = { ...where.date, lte: new Date(endDate) };
  if (type === 'income' || type === 'expense') where.type = type;
  if (status === 'confirmed' || status === 'pending' || status === 'cancelled') where.status = status;
  if (category_id) where.category_id = category_id;
  if (business_area_id && business_area_id.length > 0) where.business_area_id = business_area_id;
  if (search) where.description = { contains: search, mode: 'insensitive' };

  const [items, total] = await Promise.all([
    prisma.financialTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: { select: { id: true, name: true, type: true } },
        business_area: { select: { id: true, name: true, color: true } }
      }
    }),
    prisma.financialTransaction.count({ where })
  ]);

  res.json({
    items: items.map((t) => ({
      id: t.id,
      type: t.type,
      category_id: t.category_id,
      category: t.category,
      business_area_id: t.business_area_id,
      business_area: t.business_area,
      supplier_id: t.supplier_id,
      source_type: t.source_type,
      source_id: t.source_id,
      description: t.description,
      value: Number(t.value),
      status: t.status,
      date: t.date.toISOString().slice(0, 10),
      notes: t.notes,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    })),
    totalItems: total,
    totalPages: Math.ceil(total / limit),
    page,
    pageSize: limit
  });
};

/** POST /financeiro/transactions */
export const criarTransacao = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const body = createBodySchema.parse(req.body);
  const category = await prisma.financialCategory.findFirst({
    where: { id: body.category_id, usuario_id: userId }
  });
  if (!category) throw new AppError('Categoria não encontrada', 404);
  if (category.type !== body.type) throw new AppError('Categoria não corresponde ao tipo da movimentação', 400);

  let business_area_id: string | null = null;
  if (body.business_area_id) {
    const area = await prisma.businessArea.findFirst({
      where: { id: body.business_area_id, usuario_id: userId, is_active: true }
    });
    if (area) business_area_id = area.id;
  }

  const transaction = await prisma.financialTransaction.create({
    data: {
      usuario_id: userId,
      business_area_id,
      type: body.type as 'income' | 'expense',
      category_id: body.category_id,
      supplier_id: body.supplier_id ?? undefined,
      source_type: 'manual',
      description: body.description,
      value: body.value,
      status: (body.status as 'confirmed' | 'pending' | 'cancelled') ?? 'confirmed',
      date: new Date(body.date),
      notes: body.notes ?? undefined
    },
    include: {
      category: { select: { id: true, name: true, type: true } },
      business_area: { select: { id: true, name: true, color: true } }
    }
  });
  res.status(201).json({
    id: transaction.id,
    type: transaction.type,
    category_id: transaction.category_id,
    category: transaction.category,
    supplier_id: transaction.supplier_id,
    source_type: transaction.source_type,
    source_id: transaction.source_id,
    description: transaction.description,
    value: Number(transaction.value),
    status: transaction.status,
    date: transaction.date.toISOString().slice(0, 10),
    notes: transaction.notes,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt
  });
};

/** PUT /financeiro/transactions/:id */
export const atualizarTransacao = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const body = updateBodySchema.parse(req.body);
  const existing = await prisma.financialTransaction.findFirst({
    where: { id, usuario_id: userId }
  });
  if (!existing) throw new AppError('Movimentação não encontrada', 404);
  if (existing.source_type === 'sale') throw new AppError('Movimentação gerada por venda não pode ser editada', 400);

  const updateData: {
    category_id?: string;
    supplier_id?: string | null;
    description?: string;
    value?: number;
    status?: 'confirmed' | 'pending' | 'cancelled';
    date?: Date;
    notes?: string | null;
  } = {};
  if (body.category_id !== undefined) updateData.category_id = body.category_id;
  if (body.supplier_id !== undefined) updateData.supplier_id = body.supplier_id;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.value !== undefined) updateData.value = body.value;
  if (body.status !== undefined) updateData.status = body.status as 'confirmed' | 'pending' | 'cancelled';
  if (body.date !== undefined) updateData.date = new Date(body.date);
  if (body.notes !== undefined) updateData.notes = body.notes;

  if (body.category_id !== undefined) {
    const cat = await prisma.financialCategory.findFirst({
      where: { id: body.category_id, usuario_id: userId }
    });
    if (!cat) throw new AppError('Categoria não encontrada', 404);
  }

  const updated = await prisma.financialTransaction.update({
    where: { id },
    data: updateData,
    include: { category: { select: { id: true, name: true, type: true } } }
  });
  res.json({
    id: updated.id,
    type: updated.type,
    category_id: updated.category_id,
    category: updated.category,
    supplier_id: updated.supplier_id,
    source_type: updated.source_type,
    source_id: updated.source_id,
    description: updated.description,
    value: Number(updated.value),
    status: updated.status,
    date: updated.date.toISOString().slice(0, 10),
    notes: updated.notes,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt
  });
};

/** DELETE /financeiro/transactions/:id */
export const excluirTransacao = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const existing = await prisma.financialTransaction.findFirst({
    where: { id, usuario_id: userId }
  });
  if (!existing) throw new AppError('Movimentação não encontrada', 404);
  if (existing.source_type === 'sale') throw new AppError('Movimentação gerada por venda não pode ser excluída', 400);

  await prisma.financialTransaction.delete({ where: { id } });
  res.status(204).send();
};

type ProfitFromSalesResult = {
  estimatedProfit: number;
  averageMargin: number | null;
  missingCostItems: number;
  byProduct: { produto_id: string; produto_nome: string; receita: number; custo_total: number; lucro_estimado: number; margem: number | null }[];
};

/** Lucro estimado e margem a partir de vendas pagas no período (entradas financeiras source_type=sale). */
async function getEstimatedProfitFromSales(
  userId: string,
  start: Date,
  end: Date,
  businessAreaId?: string | null
): Promise<ProfitFromSalesResult> {
  const paidInPeriod = await prisma.financialTransaction.findMany({
    where: {
      usuario_id: userId,
      type: 'income',
      source_type: 'sale',
      status: 'confirmed',
      date: { gte: start, lte: end },
      ...(businessAreaId && businessAreaId.trim().length > 0 ? { business_area_id: businessAreaId.trim() } : {})
    },
    select: { source_id: true }
  });
  const saleIds = (paidInPeriod.map((t) => t.source_id).filter(Boolean) as string[]);
  if (saleIds.length === 0) return { estimatedProfit: 0, averageMargin: null, missingCostItems: 0, byProduct: [] };

  const vendas = await prisma.venda.findMany({
    where: { id: { in: saleIds }, usuario_id: userId },
    include: { itens: { include: { produto: true } } }
  });

  let estimatedProfit = 0;
  let receitaComCusto = 0;
  let missingCostItems = 0;
  const byProductMap = new Map<string, { produto_nome: string; receita: number; custo_total: number; lucro_estimado: number }>();

  for (const venda of vendas) {
    for (const item of venda.itens) {
      const qty = item.quantidade;
      const precoVenda = Number(item.preco_unitario);
      const custoUnit = Number((item.produto as { custo: unknown }).custo ?? 0);
      const receitaItem = precoVenda * qty;
      const custoTotalItem = custoUnit * qty;

      if (custoUnit > 0) {
        estimatedProfit += receitaItem - custoTotalItem;
        receitaComCusto += receitaItem;
        const key = item.produto_id;
        const cur = byProductMap.get(key);
        const nome = (item.produto as { nome: string }).nome;
        if (cur) {
          cur.receita += receitaItem;
          cur.custo_total += custoTotalItem;
          cur.lucro_estimado += receitaItem - custoTotalItem;
        } else {
          byProductMap.set(key, {
            produto_nome: nome,
            receita: receitaItem,
            custo_total: custoTotalItem,
            lucro_estimado: receitaItem - custoTotalItem
          });
        }
      } else {
        missingCostItems += 1;
      }
    }
  }

  const averageMargin = receitaComCusto > 0 ? (estimatedProfit / receitaComCusto) * 100 : null;
  const byProduct = Array.from(byProductMap.entries()).map(([produto_id, p]) => ({
    produto_id,
    produto_nome: p.produto_nome,
    receita: p.receita,
    custo_total: p.custo_total,
    lucro_estimado: p.lucro_estimado,
    margem: p.receita > 0 ? (p.lucro_estimado / p.receita) * 100 : null
  }));

  return { estimatedProfit, averageMargin, missingCostItems, byProduct };
}

/** GET /financeiro/overview?startDate=&endDate= — entradas, saídas, fluxo de caixa, lucro estimado, pendências, margem */
export const overview = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const startDate = (req.query.startDate as string) || undefined;
  const endDate = (req.query.endDate as string) || undefined;
  const businessAreaId = (req.query.business_area_id ?? req.query.areaId) as string | undefined;

  const now = new Date();
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = startDate
    ? new Date(startDate)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);

  const wherePeriod: {
    usuario_id: string;
    date: { gte: Date; lte: Date };
    status: { not: FinancialTransactionStatus };
    business_area_id?: string | null;
  } = {
    usuario_id: userId,
    date: { gte: start, lte: end },
    status: { not: FinancialTransactionStatus.cancelled }
  };
  if (businessAreaId && businessAreaId.trim().length > 0) {
    wherePeriod.business_area_id = businessAreaId.trim();
  }

  const [entradasAgg, saidasAgg, pendentesAgg, transactionsForChart, profitData] = await Promise.all([
    prisma.financialTransaction.aggregate({
      where: { ...wherePeriod, type: 'income' },
      _sum: { value: true }
    }),
    prisma.financialTransaction.aggregate({
      where: { ...wherePeriod, type: 'expense' },
      _sum: { value: true }
    }),
    prisma.financialTransaction.aggregate({
      where: {
        usuario_id: userId,
        type: 'income',
        status: FinancialTransactionStatus.pending,
        date: { gte: start, lte: end }
      },
      _sum: { value: true }
    }),
    prisma.financialTransaction.findMany({
      where: { ...wherePeriod },
      select: { type: true, value: true, date: true }
    }),
    getEstimatedProfitFromSales(userId, start, end, businessAreaId)
  ]);

  const entradas = Number(entradasAgg._sum.value ?? 0);
  const saidas = Number(saidasAgg._sum.value ?? 0);
  const cashFlow = entradas - saidas;
  const pendencias = Number(pendentesAgg._sum.value ?? 0);

  const byDay = new Map<string, { entradas: number; saidas: number }>();
  for (const t of transactionsForChart as { type: string; value: unknown; date: Date }[]) {
    const key = t.date.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, { entradas: 0, saidas: 0 });
    const cur = byDay.get(key)!;
    if (t.type === 'income') cur.entradas += Number(t.value);
    else cur.saidas += Number(t.value);
  }
  const sortedDates = Array.from(byDay.keys()).sort();
  const chart = {
    labels: sortedDates,
    entradas: sortedDates.map((d) => byDay.get(d)!.entradas),
    saidas: sortedDates.map((d) => byDay.get(d)!.saidas)
  };

  res.json({
    entradas,
    saidas,
    cashFlow,
    estimatedProfit: profitData.estimatedProfit,
    pendencias,
    averageMargin: profitData.averageMargin,
    missingCostItems: profitData.missingCostItems,
    chart,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  });
};

/** GET /financeiro/analysis?startDate=&endDate= — dados para aba Análise (por categoria, etc.) */
export const analysis = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const startDate = (req.query.startDate as string) || undefined;
  const endDate = (req.query.endDate as string) || undefined;
  const businessAreaId = (req.query.business_area_id ?? req.query.areaId) as string | undefined;

  const now = new Date();
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = startDate
    ? new Date(startDate)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);

  const wherePeriod: {
    usuario_id: string;
    date: { gte: Date; lte: Date };
    status: { not: FinancialTransactionStatus };
    business_area_id?: string | null;
  } = {
    usuario_id: userId,
    date: { gte: start, lte: end },
    status: { not: FinancialTransactionStatus.cancelled }
  };
  if (businessAreaId && businessAreaId.trim().length > 0) {
    wherePeriod.business_area_id = businessAreaId.trim();
  }

  const [expensesByCategoryRaw, incomeByCategoryRaw] = await Promise.all([
    prisma.financialTransaction.groupBy({
      by: ['category_id'],
      where: { ...wherePeriod, type: 'expense' },
      _sum: { value: true }
    }),
    prisma.financialTransaction.groupBy({
      by: ['category_id'],
      where: { ...wherePeriod, type: 'income' },
      _sum: { value: true }
    })
  ]);

  const sortBySum = (a: { _sum: { value: unknown } }, b: { _sum: { value: unknown } }) => Number(b._sum.value ?? 0) - Number(a._sum.value ?? 0);
  const expensesByCategory = [...expensesByCategoryRaw].sort(sortBySum);
  const incomeByCategory = [...incomeByCategoryRaw].sort(sortBySum);

  const categoryIds = [...new Set([...expensesByCategory.map((r: { category_id: string }) => r.category_id), ...incomeByCategory.map((r: { category_id: string }) => r.category_id)])];
  const categories = categoryIds.length
    ? await prisma.financialCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, type: true }
      })
    : [];
  const catMap = new Map(categories.map((c: { id: string; name: string }) => [c.id, c.name]));

  const despesasPorCategoria = expensesByCategory.map((r: { category_id: string; _sum: { value: unknown } }) => ({
    category_id: r.category_id,
    category_name: catMap.get(r.category_id) ?? 'Sem categoria',
    total: Number(r._sum.value ?? 0)
  }));
  const entradasPorCategoria = incomeByCategory.map((r: { category_id: string; _sum: { value: unknown } }) => ({
    category_id: r.category_id,
    category_name: catMap.get(r.category_id) ?? 'Sem categoria',
    total: Number(r._sum.value ?? 0)
  }));

  const profitData = await getEstimatedProfitFromSales(userId, start, end);

  let porArea: Array<{ areaId: string | null; areaName: string; color: string | null; entradas: number; despesas: number }> = [];
  if (!businessAreaId || !businessAreaId.trim()) {
    const [incomeByAreaRaw, expenseByAreaRaw] = await Promise.all([
      prisma.financialTransaction.groupBy({
        by: ['business_area_id'],
        where: { ...wherePeriod, type: 'income' },
        _sum: { value: true }
      }),
      prisma.financialTransaction.groupBy({
        by: ['business_area_id'],
        where: { ...wherePeriod, type: 'expense' },
        _sum: { value: true }
      })
    ]);
    const areaIds = [...new Set([
      ...incomeByAreaRaw.map((r: { business_area_id: string | null }) => r.business_area_id).filter(Boolean),
      ...expenseByAreaRaw.map((r: { business_area_id: string | null }) => r.business_area_id).filter(Boolean)
    ])] as string[];
    const areas = areaIds.length
      ? await prisma.businessArea.findMany({
          where: { id: { in: areaIds }, usuario_id: userId },
          select: { id: true, name: true, color: true }
        })
      : [];
    const areaMap = new Map(areas.map((a: { id: string; name: string; color: string | null }) => [a.id, { name: a.name, color: a.color }]));
    const entradasByArea = new Map<string | null, number>();
    const despesasByArea = new Map<string | null, number>();
    for (const r of incomeByAreaRaw as Array<{ business_area_id: string | null; _sum: { value: unknown } }>) {
      entradasByArea.set(r.business_area_id, Number(r._sum.value ?? 0));
    }
    for (const r of expenseByAreaRaw as Array<{ business_area_id: string | null; _sum: { value: unknown } }>) {
      despesasByArea.set(r.business_area_id, Number(r._sum.value ?? 0));
    }
    const allAreaIds = new Set([...entradasByArea.keys(), ...despesasByArea.keys()]);
    porArea = Array.from(allAreaIds).map((aid) => ({
      areaId: aid,
      areaName: aid ? (areaMap.get(aid)?.name ?? 'Sem nome') : 'Sem área',
      color: aid ? (areaMap.get(aid)?.color ?? null) : null,
      entradas: entradasByArea.get(aid) ?? 0,
      despesas: despesasByArea.get(aid) ?? 0
    }));
    porArea.sort((a, b) => (b.entradas + b.despesas) - (a.entradas + a.despesas));
  }

  const payload: Record<string, unknown> = {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    despesasPorCategoria,
    entradasPorCategoria,
    eficiencia: {
      lucroEstimado: profitData.estimatedProfit,
      margemMedia: profitData.averageMargin,
      itensSemCusto: profitData.missingCostItems
    },
    itensPorProduto: profitData.byProduct
  };
  if (porArea.length > 0) payload.porArea = porArea;

  res.json(payload);
};

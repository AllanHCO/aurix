import { Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

const produtoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  preco: z.number().positive('Preço deve ser positivo'),
  custo: z.number().nonnegative('Custo não pode ser negativo'),
  estoque_atual: z.number().int().nonnegative('Estoque atual não pode ser negativo'),
  estoque_minimo: z.number().int().nonnegative('Estoque mínimo não pode ser negativo'),
  categoria_id: z.string().uuid('Categoria é obrigatória')
});

type FiltroDesempenho = 'todos' | 'mais_vendidos' | 'menos_vendidos';
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
  const filtro = (req.query.filtro as FiltroDesempenho) || 'todos';
  const periodo = (req.query.periodo as PeriodoDesempenho) || 'este_mes';
  const categoriaIds = parseCategoriaIds(req.query);
  const nome = (req.query.nome as string)?.trim() || '';
  const validFiltros: FiltroDesempenho[] = ['todos', 'mais_vendidos', 'menos_vendidos'];
  const validPeriodos: PeriodoDesempenho[] = ['este_mes', 'ultimos_3_meses'];
  const filtroSafe = validFiltros.includes(filtro) ? filtro : 'todos';
  const periodoSafe = validPeriodos.includes(periodo) ? periodo : 'este_mes';

  const { inicio, fim } = getPeriodoRange(periodoSafe);

  const whereCategoria = categoriaIds.length > 0
    ? Prisma.sql`AND p.categoria_id IN (${Prisma.join(categoriaIds)})`
    : Prisma.empty;
  const whereNome = nome
    ? Prisma.sql`AND p.nome ILIKE ${'%' + nome + '%'}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      nome: string;
      preco: unknown;
      custo: unknown;
      estoque_atual: number;
      estoque_minimo: number;
      categoria_id: string;
      categoria_nome: string | null;
      createdAt: Date;
      updatedAt: Date;
      total_sold: bigint;
    }>
  >`
    SELECT
      p.id,
      p.nome,
      p.preco,
      p.custo,
      p.estoque_atual,
      p.estoque_minimo,
      p.categoria_id,
      c.nome AS categoria_nome,
      p."createdAt",
      p."updatedAt",
      COALESCE(SUM(iv.quantidade), 0)::bigint AS total_sold
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN itens_venda iv ON iv.produto_id = p.id
    LEFT JOIN vendas v ON v.id = iv.venda_id
      AND v.status = 'PAGO'
      AND v."createdAt" >= ${inicio}
      AND v."createdAt" <= ${fim}
    WHERE 1=1
    ${whereCategoria}
    ${whereNome}
    GROUP BY p.id, p.nome, p.preco, p.custo, p.estoque_atual, p.estoque_minimo, p.categoria_id, c.nome, p."createdAt", p."updatedAt"
    ORDER BY p."createdAt" DESC
  `;

  const produtos = rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    preco: Number(r.preco),
    custo: Number(r.custo),
    estoque_atual: r.estoque_atual,
    estoque_minimo: r.estoque_minimo,
    categoria_id: r.categoria_id,
    categoria_nome: r.categoria_nome ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    qtdVendidaMesAtual: Number(r.total_sold)
  }));

  if (filtroSafe === 'mais_vendidos') {
    produtos.sort((a, b) => b.qtdVendidaMesAtual - a.qtdVendidaMesAtual);
  } else if (filtroSafe === 'menos_vendidos') {
    produtos.sort((a, b) => a.qtdVendidaMesAtual - b.qtdVendidaMesAtual);
  }

  res.json(produtos);
};

export const obterProduto = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const produto = await prisma.produto.findUnique({
    where: { id },
    include: { categoria: true }
  });

  if (!produto) {
    throw new AppError('Produto não encontrado', 404);
  }

  res.json(produto);
};

export const criarProduto = async (req: AuthRequest, res: Response) => {
  const data = produtoSchema.parse(req.body);
  const categoria = await prisma.categoria.findUnique({ where: { id: data.categoria_id } });
  if (!categoria) throw new AppError('Categoria não encontrada', 400);

  const produto = await prisma.produto.create({
    data,
    include: { categoria: true }
  });

  res.status(201).json(produto);
};

export const atualizarProduto = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const data = produtoSchema.partial().parse(req.body);

  // Verificar se produto existe
  const produtoExistente = await prisma.produto.findUnique({
    where: { id }
  });

  if (!produtoExistente) {
    throw new AppError('Produto não encontrado', 404);
  }

  // Validar estoque não negativo
  if (data.estoque_atual !== undefined && data.estoque_atual < 0) {
    throw new AppError('Estoque não pode ser negativo', 400);
  }

  if (data.categoria_id) {
    const categoria = await prisma.categoria.findUnique({ where: { id: data.categoria_id } });
    if (!categoria) throw new AppError('Categoria não encontrada', 400);
  }

  const produto = await prisma.produto.update({
    where: { id },
    data,
    include: { categoria: true }
  });

  res.json(produto);
};

export const excluirProduto = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Verificar se produto existe
  const produto = await prisma.produto.findUnique({
    where: { id }
  });

  if (!produto) {
    throw new AppError('Produto não encontrado', 404);
  }

  // Verificar se produto está em alguma venda
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
};

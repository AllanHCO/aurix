import { Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const typeSchema = z.enum(['income', 'expense']);
const createBodySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(120).transform((s) => s.trim()),
  type: typeSchema
});
const updateBodySchema = z.object({
  name: z.string().min(1).max(120).transform((s) => s.trim()).optional(),
  type: typeSchema.optional()
});

/** GET /financeiro/categories?type=income|expense */
export const listarCategorias = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const type = req.query.type as string | undefined;
  const where: { usuario_id: string; type?: 'income' | 'expense' } = { usuario_id: userId };
  if (type === 'income' || type === 'expense') where.type = type;

  const categories = await prisma.financialCategory.findMany({
    where,
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { transactions: true } } }
  });
  res.json(
    categories.map((c: { id: string; name: string; type: string; createdAt: Date; updatedAt: Date; _count: { transactions: number } }) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      transactionsCount: c._count.transactions
    }))
  );
};

/** POST /financeiro/categories */
export const criarCategoria = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const body = createBodySchema.parse(req.body);
  const existente = await prisma.financialCategory.findFirst({
    where: {
      usuario_id: userId,
      type: body.type as 'income' | 'expense',
      name: { equals: body.name, mode: 'insensitive' }
    }
  });
  if (existente) throw new AppError('Já existe uma categoria com este nome neste tipo', 400);

  const category = await prisma.financialCategory.create({
    data: { usuario_id: userId, name: body.name, type: body.type as 'income' | 'expense' }
  });
  res.status(201).json({
    id: category.id,
    name: category.name,
    type: category.type,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
  });
};

/** PUT /financeiro/categories/:id */
export const atualizarCategoria = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const body = updateBodySchema.parse(req.body);
  const cat = await prisma.financialCategory.findFirst({ where: { id, usuario_id: userId } });
  if (!cat) throw new AppError('Categoria não encontrada', 404);

  const updateData: { name?: string; type?: 'income' | 'expense' } = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.type !== undefined) updateData.type = body.type;
  if (Object.keys(updateData).length === 0) return res.json(cat);

  if (body.name !== undefined) {
    const existente = await prisma.financialCategory.findFirst({
      where: {
        usuario_id: userId,
        type: (body.type ?? cat.type) as 'income' | 'expense',
        name: { equals: body.name, mode: 'insensitive' },
        id: { not: id }
      }
    });
    if (existente) throw new AppError('Já existe uma categoria com este nome neste tipo', 400);
  }

  const updated = await prisma.financialCategory.update({
    where: { id },
    data: updateData
  });
  res.json(updated);
};

/** DELETE /financeiro/categories/:id */
export const excluirCategoria = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const cat = await prisma.financialCategory.findFirst({
    where: { id, usuario_id: userId },
    include: { _count: { select: { transactions: true } } }
  });
  if (!cat) throw new AppError('Categoria não encontrada', 404);
  if (cat._count.transactions > 0) throw new AppError('Não é possível excluir categoria com movimentações vinculadas', 400);

  await prisma.financialCategory.delete({ where: { id } });
  res.status(204).send();
};

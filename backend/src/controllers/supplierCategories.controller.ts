import { Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const createBodySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(120).transform((s) => s.trim())
});
const updateBodySchema = z.object({
  name: z.string().min(1).max(120).transform((s) => s.trim())
});

/** GET /fornecedores/categories */
export const listar = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const categories = await prisma.supplierCategory.findMany({
    where: { usuario_id: userId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { suppliers: true } } }
  });
  res.json(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      suppliersCount: c._count.suppliers
    }))
  );
};

/** POST /fornecedores/categories */
export const criar = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const body = createBodySchema.parse(req.body);
  const existente = await prisma.supplierCategory.findFirst({
    where: { usuario_id: userId, name: { equals: body.name, mode: 'insensitive' } }
  });
  if (existente) throw new AppError('Já existe uma categoria com este nome', 400);
  const category = await prisma.supplierCategory.create({
    data: { usuario_id: userId, name: body.name }
  });
  res.status(201).json(category);
};

/** PUT /fornecedores/categories/:id */
export const atualizar = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const body = updateBodySchema.parse(req.body);
  const cat = await prisma.supplierCategory.findFirst({ where: { id, usuario_id: userId } });
  if (!cat) throw new AppError('Categoria não encontrada', 404);
  const existente = await prisma.supplierCategory.findFirst({
    where: { usuario_id: userId, name: { equals: body.name, mode: 'insensitive' }, id: { not: id } }
  });
  if (existente) throw new AppError('Já existe uma categoria com este nome', 400);
  const updated = await prisma.supplierCategory.update({
    where: { id },
    data: { name: body.name }
  });
  res.json(updated);
};

/** DELETE /fornecedores/categories/:id */
export const excluir = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const id = req.params.id;
  const cat = await prisma.supplierCategory.findFirst({
    where: { id, usuario_id: userId },
    include: { _count: { select: { suppliers: true } } }
  });
  if (!cat) throw new AppError('Categoria não encontrada', 404);
  if (cat._count.suppliers > 0) throw new AppError('Não é possível excluir categoria com fornecedores vinculados', 400);
  await prisma.supplierCategory.delete({ where: { id } });
  res.status(204).send();
};

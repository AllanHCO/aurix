import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

const categoriaSchema = z.object({
  nome: z.string().min(1, 'Nome da categoria é obrigatório').max(100, 'Nome muito longo')
});

export const listarCategorias = async (_req: AuthRequest, res: Response) => {
  const categorias = await prisma.categoria.findMany({
    orderBy: { nome: 'asc' }
  });
  res.json(categorias);
};

export const criarCategoria = async (req: AuthRequest, res: Response) => {
  const data = categoriaSchema.parse(req.body);
  const existente = await prisma.categoria.findUnique({
    where: { nome: data.nome.trim() }
  });
  if (existente) {
    throw new AppError('Já existe uma categoria com este nome', 400);
  }
  const categoria = await prisma.categoria.create({
    data: { nome: data.nome.trim() }
  });
  res.status(201).json(categoria);
};

import { Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const categoriaSchema = z.object({
  nome: z.string().min(1, 'Nome da categoria é obrigatório').max(100, 'Nome muito longo')
});

function nomeUnicoCaseInsensitive(nome: string, excluirId?: string) {
  return prisma.categoria.findFirst({
    where: {
      nome: { equals: nome, mode: 'insensitive' },
      ...(excluirId ? { id: { not: excluirId } } : {})
    }
  });
}

export const listarCategorias = async (_req: AuthRequest, res: Response) => {
  const categorias = await prisma.categoria.findMany({
    orderBy: { nome: 'asc' },
    include: { _count: { select: { produtos: true } } }
  });
  res.json(
    categorias.map((c) => ({
      id: c.id,
      nome: c.nome,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      produtosCount: c._count.produtos
    }))
  );
};

export const criarCategoria = async (req: AuthRequest, res: Response) => {
  const data = categoriaSchema.parse(req.body);
  const existente = await nomeUnicoCaseInsensitive(data.nome.trim());
  if (existente) {
    throw new AppError('Já existe uma categoria com este nome', 400);
  }
  const categoria = await prisma.categoria.create({
    data: { nome: data.nome.trim() }
  });
  res.status(201).json(categoria);
};

export const atualizarCategoria = async (req: AuthRequest, res: Response) => {
  const id = req.params.id;
  const data = categoriaSchema.parse(req.body);
  const categoria = await prisma.categoria.findUnique({ where: { id } });
  if (!categoria) {
    throw new AppError('Categoria não encontrada', 404);
  }
  const existente = await nomeUnicoCaseInsensitive(data.nome.trim(), id);
  if (existente) {
    throw new AppError('Já existe uma categoria com este nome', 400);
  }
  const atualizada = await prisma.categoria.update({
    where: { id },
    data: { nome: data.nome.trim() }
  });
  res.json(atualizada);
};

export const excluirCategoria = async (req: AuthRequest, res: Response) => {
  const id = req.params.id;
  const categoria = await prisma.categoria.findUnique({ where: { id } });
  if (!categoria) {
    throw new AppError('Categoria não encontrada', 404);
  }
  const produtosCount = await prisma.produto.count({ where: { categoria_id: id } });
  if (produtosCount > 0) {
    throw new AppError('Existem produtos vinculados a esta categoria.', 400);
  }
  await prisma.categoria.delete({ where: { id } });
  res.status(204).send();
};

import { Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const categoriaSchema = z.object({
  nome: z.string().min(1, 'Nome da categoria é obrigatório').max(100, 'Nome muito longo').transform((s) => s.trim().replace(/\s+/g, ' '))
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

const IDEMPOTENCY_TTL_MS = 60_000;
const categoriaIdempotencyCache = new Map<string, { statusCode: number; body: unknown; createdAt: number }>();

function purgeExpiredCategoriaIdempotency() {
  const now = Date.now();
  for (const [key, entry] of categoriaIdempotencyCache.entries()) {
    if (now - entry.createdAt > IDEMPOTENCY_TTL_MS) categoriaIdempotencyCache.delete(key);
  }
}

export const criarCategoria = async (req: AuthRequest, res: Response) => {
  const idempotencyKey = (req.headers['idempotency-key'] ?? req.headers['x-idempotency-key']) as string | undefined;
  purgeExpiredCategoriaIdempotency();
  if (idempotencyKey?.trim()) {
    const cached = categoriaIdempotencyCache.get(idempotencyKey.trim());
    if (cached && Date.now() - cached.createdAt <= IDEMPOTENCY_TTL_MS) {
      return res.status(cached.statusCode).json(cached.body);
    }
  }

  const data = categoriaSchema.parse(req.body);
  const nomeSanitizado = data.nome;
  const existente = await nomeUnicoCaseInsensitive(nomeSanitizado);
  if (existente) {
    throw new AppError('Já existe uma categoria com este nome', 400);
  }
  const categoria = await prisma.categoria.create({
    data: { nome: nomeSanitizado }
  });
  const body = { id: categoria.id, nome: categoria.nome, createdAt: categoria.createdAt, updatedAt: categoria.updatedAt };
  if (idempotencyKey?.trim()) {
    categoriaIdempotencyCache.set(idempotencyKey.trim(), { statusCode: 201, body, createdAt: Date.now() });
  }
  res.status(201).json(body);
};

export const atualizarCategoria = async (req: AuthRequest, res: Response) => {
  const id = req.params.id;
  const data = categoriaSchema.parse(req.body);
  const categoria = await prisma.categoria.findUnique({ where: { id } });
  if (!categoria) {
    throw new AppError('Categoria não encontrada', 404);
  }
  const nomeSanitizado = data.nome; // já transformado pelo schema
  const existente = await nomeUnicoCaseInsensitive(nomeSanitizado, id);
  if (existente) {
    throw new AppError('Já existe uma categoria com este nome', 400);
  }
  const atualizada = await prisma.categoria.update({
    where: { id },
    data: { nome: nomeSanitizado }
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
    throw new AppError('Não é possível excluir: existem produtos associados.', 400);
  }
  await prisma.categoria.delete({ where: { id } });
  res.status(204).send();
};

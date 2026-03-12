import { Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getCurrentOrganizationId, organizationFilter, assertRecordOwnership } from '../lib/tenant';

const tipoCategoria = z.enum(['produto', 'servico']).optional().default('produto');

const categoriaSchema = z.object({
  nome: z.string().min(1, 'Nome da categoria é obrigatório').max(100, 'Nome muito longo').transform((s) => s.trim().replace(/\s+/g, ' ')),
  tipo: tipoCategoria
});

function nomeUnicoPorTipo(usuarioId: string, nome: string, tipo: string, excluirId?: string) {
  return prisma.categoria.findFirst({
    where: {
      ...organizationFilter(usuarioId),
      nome: { equals: nome, mode: 'insensitive' },
      tipo,
      ...(excluirId ? { id: { not: excluirId } } : {})
    }
  });
}

export const listarCategorias = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
  const tipo = (req.query.tipo as string) === 'servico' ? 'servico' : undefined;
  const categorias = await prisma.categoria.findMany({
    where: { ...organizationFilter(usuarioId), ...(tipo ? { tipo } : {}) },
    orderBy: { nome: 'asc' },
    include: { _count: { select: { produtos: true } } }
  });
  res.json(
    categorias.map((c) => ({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo ?? 'produto',
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
  const usuarioId = getCurrentOrganizationId(req);
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
  const tipo = data.tipo ?? 'produto';
  const existente = await nomeUnicoPorTipo(usuarioId, nomeSanitizado, tipo);
  if (existente) {
    throw new AppError('Já existe uma categoria com este nome para este tipo', 400);
  }
  const categoria = await prisma.categoria.create({
    data: { usuario_id: usuarioId, nome: nomeSanitizado, tipo }
  });
  const body = { id: categoria.id, nome: categoria.nome, tipo: categoria.tipo ?? 'produto', createdAt: categoria.createdAt, updatedAt: categoria.updatedAt };
  if (idempotencyKey?.trim()) {
    categoriaIdempotencyCache.set(idempotencyKey.trim(), { statusCode: 201, body, createdAt: Date.now() });
  }
  res.status(201).json(body);
};

export const atualizarCategoria = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
  const id = req.params.id;
  const data = categoriaSchema.parse(req.body);
  const categoria = await prisma.categoria.findFirst({ where: { id, ...organizationFilter(usuarioId) } });
  assertRecordOwnership(categoria, usuarioId, (c) => c?.usuario_id ?? undefined, 'Categoria');
  const nomeSanitizado = data.nome;
  const tipo = data.tipo ?? categoria!.tipo ?? 'produto';
  const existente = await nomeUnicoPorTipo(usuarioId, nomeSanitizado, tipo, id);
  if (existente) {
    throw new AppError('Já existe uma categoria com este nome para este tipo', 400);
  }
  const atualizada = await prisma.categoria.update({
    where: { id },
    data: { nome: nomeSanitizado, tipo }
  });
  res.json(atualizada);
};

export const excluirCategoria = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
  const id = req.params.id;
  const categoria = await prisma.categoria.findFirst({ where: { id, ...organizationFilter(usuarioId) } });
  assertRecordOwnership(categoria, usuarioId, (c) => c?.usuario_id ?? undefined, 'Categoria');
  const produtosCount = await prisma.produto.count({ where: { categoria_id: id, usuario_id: usuarioId } });
  if (produtosCount > 0) {
    throw new AppError('Não é possível excluir: existem produtos associados.', 400);
  }
  await prisma.categoria.delete({ where: { id } });
  res.status(204).send();
};

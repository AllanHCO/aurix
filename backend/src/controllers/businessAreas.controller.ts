import { Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const createSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(120).trim(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  is_active: z.boolean().optional().default(true)
});

const updateSchema = createSchema.partial();

/** GET /configuracoes/business-areas — lista áreas do usuário (ativas por padrão) */
export const list = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const includeInactive = req.query.all === 'true';

  const areas = await prisma.businessArea.findMany({
    where: {
      usuario_id: userId,
      ...(includeInactive ? {} : { is_active: true })
    },
    orderBy: { name: 'asc' }
  });

  res.json(areas);
};

/** POST /configuracoes/business-areas — criar área */
export const create = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const data = createSchema.parse(req.body);

  const existing = await prisma.businessArea.findFirst({
    where: { usuario_id: userId, name: data.name }
  });
  if (existing) {
    throw new AppError('Já existe uma área com esse nome.', 409);
  }

  const area = await prisma.businessArea.create({
    data: {
      usuario_id: userId,
      name: data.name,
      color: data.color ?? null,
      is_active: data.is_active
    }
  });

  res.status(201).json(area);
};

/** PUT /configuracoes/business-areas/:id — atualizar área */
export const update = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;
  const data = updateSchema.parse(req.body);

  const area = await prisma.businessArea.findFirst({
    where: { id, usuario_id: userId }
  });
  if (!area) {
    throw new AppError('Área não encontrada.', 404);
  }

  if (data.name !== undefined && data.name !== area.name) {
    const duplicate = await prisma.businessArea.findFirst({
      where: { usuario_id: userId, name: data.name }
    });
    if (duplicate) {
      throw new AppError('Já existe uma área com esse nome.', 409);
    }
  }

  const updated = await prisma.businessArea.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.is_active !== undefined && { is_active: data.is_active })
    }
  });

  res.json(updated);
};

/** DELETE /configuracoes/business-areas/:id — desativar ou excluir (soft: is_active = false) */
export const remove = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;

  const area = await prisma.businessArea.findFirst({
    where: { id, usuario_id: userId }
  });
  if (!area) {
    throw new AppError('Área não encontrada.', 404);
  }

  // Soft delete: desativar para não quebrar registros vinculados
  await prisma.businessArea.update({
    where: { id },
    data: { is_active: false }
  });

  res.status(204).send();
};

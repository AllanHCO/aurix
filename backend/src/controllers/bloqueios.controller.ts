import { Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { invalidateAgendaMesCache } from '../services/availability.service';

const TIME = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/);

const createRecorrenteSchema = z.object({
  tipo: z.literal('RECORRENTE'),
  dia_semana: z.number().int().min(0).max(6),
  hora_inicio: TIME,
  hora_fim: TIME
});

const createIntervaloSchema = z.object({
  tipo: z.literal('INTERVALO_DATA'),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora_inicio: TIME.nullable().optional(),
  hora_fim: TIME.nullable().optional()
});

export const list = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const list = await prisma.bloqueio.findMany({
    where: { usuario_id: userId },
    orderBy: { createdAt: 'desc' }
  });
  res.json(list);
};

export const create = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const body = req.body;

  if (body.tipo === 'RECORRENTE') {
    const data = createRecorrenteSchema.parse(body);
    const hi = parseTime(data.hora_inicio);
    const hf = parseTime(data.hora_fim);
    if (hi >= hf) throw new AppError('hora_inicio deve ser menor que hora_fim', 400);

    const b = await prisma.bloqueio.create({
      data: {
        usuario_id: userId,
        tipo: 'RECORRENTE',
        dia_semana: data.dia_semana,
        hora_inicio: data.hora_inicio,
        hora_fim: data.hora_fim
      }
    });
    invalidateAgendaMesCache(userId);
    return res.status(201).json(b);
  }

  if (body.tipo === 'INTERVALO_DATA') {
    const data = createIntervaloSchema.parse(body);
    const di = new Date(data.data_inicio + 'T12:00:00');
    const df = new Date(data.data_fim + 'T12:00:00');
    if (di > df) throw new AppError('data_inicio deve ser menor ou igual a data_fim', 400);
    if (data.hora_inicio != null && data.hora_fim != null) {
      const hi = parseTime(data.hora_inicio);
      const hf = parseTime(data.hora_fim);
      if (hi >= hf) throw new AppError('hora_inicio deve ser menor que hora_fim', 400);
    }

    const b = await prisma.bloqueio.create({
      data: {
        usuario_id: userId,
        tipo: 'INTERVALO_DATA',
        data_inicio: di,
        data_fim: df,
        hora_inicio: (data.hora_inicio as string) ?? null,
        hora_fim: (data.hora_fim as string) ?? null
      }
    });
    invalidateAgendaMesCache(userId);
    return res.status(201).json(b);
  }

  throw new AppError('tipo deve ser RECORRENTE ou INTERVALO_DATA', 400);
};

function parseTime(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

export const remove = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;

  const b = await prisma.bloqueio.findFirst({
    where: { id, usuario_id: userId }
  });
  if (!b) throw new AppError('Bloqueio não encontrado', 404);

  await prisma.bloqueio.delete({ where: { id } });
  invalidateAgendaMesCache(userId);
  res.status(204).send();
};

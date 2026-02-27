import { Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getTotalSlotsNoDia, getHorariosDisponiveis } from '../services/availability.service';
import { createAgendamentoManual } from '../services/booking.service';
import { invalidatePrefix } from '../services/cache.service';

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const listByMonth = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const year = Number(req.query.ano);
  const month = Number(req.query.mes);
  if (!year || !month || month < 1 || month > 12) {
    throw new AppError('Query ano e mes obrigatórios (1-12).', 400);
  }
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const list = await prisma.agendamento.findMany({
    where: {
      usuario_id: userId,
      data: { gte: start, lte: end }
    },
    orderBy: [{ data: 'asc' }, { hora_inicio: 'asc' }]
  });
  res.json(list);
};

export const listByDay = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const dataStr = req.query.data as string;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    throw new AppError('Query data obrigatória (YYYY-MM-DD).', 400);
  }
  const data = new Date(dataStr + 'T12:00:00');

  const list = await prisma.agendamento.findMany({
    where: {
      usuario_id: userId,
      data
    },
    orderBy: { hora_inicio: 'asc' }
  });
  res.json(list);
};

/** GET /agendamentos/horarios-disponiveis?data=YYYY-MM-DD — slots livres (respeitando bloqueios e ocupados). */
export const getHorariosDisponiveisInternal = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const dataStr = (req.query.data as string)?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    throw new AppError('Query data obrigatória (YYYY-MM-DD).', 400);
  }
  const horarios = await getHorariosDisponiveis(userId, dataStr);
  res.json({ horarios });
};

export const listProximos = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const hoje = new Date();
  const hojeStr = toDateString(hoje);
  const agora = hoje.getHours() * 60 + hoje.getMinutes();

  const list = await prisma.agendamento.findMany({
    where: {
      usuario_id: userId,
      status: { in: ['PENDENTE', 'CONFIRMADO'] },
      OR: [
        { data: { gt: new Date(hojeStr + 'T12:00:00') } },
        {
          data: new Date(hojeStr + 'T12:00:00'),
          hora_inicio: { gte: String(Math.floor(agora / 60)).padStart(2, '0') + ':' + String(agora % 60).padStart(2, '0') }
        }
      ]
    },
    orderBy: [{ data: 'asc' }, { hora_inicio: 'asc' }],
    take: limit
  });
  res.json(list);
};

export const listPendentes = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const list = await prisma.agendamento.findMany({
    where: { usuario_id: userId, status: 'PENDENTE' },
    orderBy: [{ data: 'asc' }, { hora_inicio: 'asc' }]
  });
  res.json(list);
};

/** GET /agendamentos/:id — detalhe do agendamento (para modal). Valida usuario_id. */
export const getById = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;
  const a = await prisma.agendamento.findFirst({
    where: { id, usuario_id: userId }
  });
  if (!a) throw new AppError('Agendamento não encontrado', 404);
  res.json(a);
};

export const getResumo = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const dataStr = req.query.data as string;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    throw new AppError('Query data obrigatória (YYYY-MM-DD).', 400);
  }
  const data = new Date(dataStr + 'T12:00:00');

  const agendamentos = await prisma.agendamento.findMany({
    where: {
      usuario_id: userId,
      data,
      status: { in: ['PENDENTE', 'CONFIRMADO'] }
    }
  });
  const totalHoje = agendamentos.length;
  const pendentes = agendamentos.filter((a) => a.status === 'PENDENTE').length;
  const checkinsHoje = agendamentos.filter((a) => a.checkin_at != null).length;
  const noShowsHoje = agendamentos.filter((a) => a.no_show).length;
  const totalSlots = await getTotalSlotsNoDia(userId, dataStr);
  const taxaOcupacao = totalSlots > 0 ? Math.round((totalHoje / totalSlots) * 100) : null;

  res.json({
    totalHoje,
    pendentes,
    checkinsHoje,
    noShowsHoje,
    taxaOcupacao: taxaOcupacao != null ? taxaOcupacao : undefined
  });
};

const createManualSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora_inicio: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  nome_cliente: z.string().min(2).max(200),
  telefone_cliente: z.string().min(10),
  observacao: z.string().max(1000).optional()
});

export const createManual = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const body = createManualSchema.parse(req.body);
  const agendamento = await createAgendamentoManual(userId, {
    data: body.data,
    hora_inicio: body.hora_inicio,
    nome_cliente: body.nome_cliente.trim(),
    telefone_cliente: body.telefone_cliente.replace(/\D/g, '').trim(),
    observacao: body.observacao?.trim() || undefined
  });
  res.status(201).json(agendamento);

  invalidatePrefix(`dashboard:summary:${userId}:`);
};

const updateStatusSchema = z.object({
  status: z.enum(['PENDENTE', 'CONFIRMADO', 'CANCELADO'])
});

export const updateStatus = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;
  const { status } = updateStatusSchema.parse(req.body);

  const a = await prisma.agendamento.findFirst({
    where: { id, usuario_id: userId }
  });
  if (!a) throw new AppError('Agendamento não encontrado', 404);

  const updated = await prisma.agendamento.update({
    where: { id },
    data: { status }
  });
  const { invalidateAgendaMesCache } = await import('../services/availability.service');
  invalidateAgendaMesCache(a.usuario_id);
  invalidatePrefix(`dashboard:summary:${userId}:`);
  res.json(updated);
};

/** GET /agendamentos/historico?inicio=&fim=&status=&q=&page=&limit= — listagem filtrada e paginada */
const historicoStatusValues = ['all', 'checkin', 'pendente', 'no_show', 'cancelado'] as const;
export const listHistorico = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const inicioStr = (req.query.inicio as string)?.trim();
  const fimStr = (req.query.fim as string)?.trim();
  const statusFilter = (req.query.status as string)?.trim() || 'all';
  const q = (req.query.q as string)?.trim() || '';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  if (!historicoStatusValues.includes(statusFilter as (typeof historicoStatusValues)[number])) {
    throw new AppError('status deve ser: all, checkin, pendente, no_show ou cancelado.', 400);
  }

  const inicio = inicioStr && /^\d{4}-\d{2}-\d{2}$/.test(inicioStr) ? new Date(inicioStr + 'T00:00:00') : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const fim = fimStr && /^\d{4}-\d{2}-\d{2}$/.test(fimStr) ? new Date(fimStr + 'T23:59:59') : new Date();

  const where: Prisma.AgendamentoWhereInput = {
    usuario_id: userId,
    data: { gte: inicio, lte: fim }
  };

  if (statusFilter === 'checkin') {
    where.checkin_at = { not: null };
  } else if (statusFilter === 'pendente') {
    where.status = { in: ['PENDENTE', 'CONFIRMADO'] };
    where.checkin_at = null;
    where.no_show = false;
  } else if (statusFilter === 'no_show') {
    where.no_show = true;
  } else if (statusFilter === 'cancelado') {
    where.status = 'CANCELADO';
  }

  if (q.length >= 2) {
    const qNorm = q.replace(/\D/g, '');
    const orConditions: Array<{ nome_cliente?: { contains: string; mode: 'insensitive' }; telefone_cliente?: { contains: string } }> = [
      { nome_cliente: { contains: q, mode: 'insensitive' } }
    ];
    if (qNorm.length >= 4) orConditions.push({ telefone_cliente: { contains: qNorm } });
    where.OR = orConditions;
  }

  const [list, total] = await Promise.all([
    prisma.agendamento.findMany({
      where,
      orderBy: [{ data: 'desc' }, { hora_inicio: 'desc' }],
      skip,
      take: limit
    }),
    prisma.agendamento.count({ where })
  ]);

  res.json({ list, total, page, limit });
};

/** PATCH /agendamentos/:id/checkin — registra comparecimento */
export const checkin = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;
  const a = await prisma.agendamento.findFirst({
    where: { id, usuario_id: userId }
  });
  if (!a) throw new AppError('Agendamento não encontrado', 404);
  if (a.status === 'CANCELADO') throw new AppError('Agendamento cancelado não pode receber check-in.', 400);

  const updated = await prisma.agendamento.update({
    where: { id },
    data: { checkin_at: new Date(), no_show: false }
  });
  const { invalidateAgendaMesCache } = await import('../services/availability.service');
  invalidateAgendaMesCache(a.usuario_id);
  invalidatePrefix(`dashboard:summary:${userId}:`);
  res.json(updated);
};

/** PATCH /agendamentos/:id/no-show — marca não comparecimento */
export const noShow = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { id } = req.params;
  const a = await prisma.agendamento.findFirst({
    where: { id, usuario_id: userId }
  });
  if (!a) throw new AppError('Agendamento não encontrado', 404);
  if (a.status === 'CANCELADO') throw new AppError('Agendamento cancelado.', 400);

  const updated = await prisma.agendamento.update({
    where: { id },
    data: { no_show: true, checkin_at: null }
  });
  const { invalidateAgendaMesCache } = await import('../services/availability.service');
  invalidateAgendaMesCache(a.usuario_id);
  invalidatePrefix(`dashboard:summary:${userId}:`);
  res.json(updated);
};

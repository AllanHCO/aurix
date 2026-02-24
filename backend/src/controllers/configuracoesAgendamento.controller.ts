import { Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const TIME = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/);
const DURACAO_SLOTS = [30, 60, 90, 120] as const;

const putBodySchema = z.object({
  duracao_slot_min: z.number().int().refine((n) => DURACAO_SLOTS.includes(n as 30 | 60 | 90 | 120), {
    message: 'duracao_slot_min deve ser 30, 60, 90 ou 120'
  }),
  antecedencia_min_dias: z.number().int().min(0).max(60),
  buffer_min: z.number().int().min(0).max(60),
  limite_maximo_dias: z.number().int().min(1).max(365).optional(),
  servico_padrao_nome: z.string().max(200).optional().nullable(),
  disponibilidade: z.array(
    z.object({
      dia_semana: z.number().int().min(1).max(6),
      ativo: z.boolean(),
      hora_inicio: TIME,
      hora_fim: TIME
    })
  )
});

export const getConfiguracoesAgendamento = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const [config, disponibilidade, slugRes] = await Promise.all([
    prisma.configuracaoAgenda.findUnique({
      where: { usuario_id: userId }
    }),
    prisma.disponibilidadeSemanal.findMany({
      where: { usuario_id: userId },
      orderBy: { dia_semana: 'asc' }
    }),
    prisma.usuario.findUnique({
      where: { id: userId },
      select: { agenda_slug: true }
    })
  ]);

  const disponibilidadeMap = new Map(disponibilidade.map((d) => [d.dia_semana, d]));
  const disponibilidadePayload = [1, 2, 3, 4, 5, 6].map((dia_semana) => {
    const row = disponibilidadeMap.get(dia_semana);
    if (row) {
      return {
        dia_semana: row.dia_semana,
        ativo: row.ativo,
        hora_inicio: row.hora_inicio,
        hora_fim: row.hora_fim
      };
    }
    return {
      dia_semana,
      ativo: false,
      hora_inicio: config?.hora_inicio_funcionamento ?? '08:00',
      hora_fim: config?.hora_fim_funcionamento ?? '18:00'
    };
  });

  res.json({
    duracao_slot_min: config?.duracao_padrao_minutos ?? 30,
    antecedencia_min_dias: config?.antecedencia_minima_dias ?? 2,
    buffer_min: config?.buffer_minutos ?? 10,
    limite_maximo_dias: config?.limite_maximo_dias ?? 30,
    servico_padrao_nome: config?.servico_padrao_nome ?? null,
    hora_inicio_funcionamento: config?.hora_inicio_funcionamento ?? '08:00',
    hora_fim_funcionamento: config?.hora_fim_funcionamento ?? '18:00',
    disponibilidade: disponibilidadePayload,
    agenda_slug: slugRes?.agenda_slug ?? null
  });
};

export const putConfiguracoesAgendamento = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const body = putBodySchema.parse(req.body);

  for (const d of body.disponibilidade) {
    if (d.ativo) {
      const hi = parseTime(d.hora_inicio);
      const hf = parseTime(d.hora_fim);
      if (hi >= hf) throw new AppError(`Dia ${d.dia_semana}: hora_inicio deve ser menor que hora_fim`, 400);
    }
  }

  const duracao = body.duracao_slot_min;
  const buffer = body.buffer_min;
  const antecedencia = body.antecedencia_min_dias;
  const limiteMaximoDias = body.limite_maximo_dias ?? 30;
  const servicoPadraoNome = body.servico_padrao_nome != null ? String(body.servico_padrao_nome).trim() || null : undefined;

  await prisma.$transaction(async (tx) => {
    await tx.configuracaoAgenda.upsert({
      where: { usuario_id: userId },
      create: {
        usuario_id: userId,
        hora_inicio_funcionamento: '08:00',
        hora_fim_funcionamento: '18:00',
        duracao_padrao_minutos: duracao,
        buffer_minutos: buffer,
        antecedencia_minima_dias: antecedencia,
        limite_maximo_dias: limiteMaximoDias,
        servico_padrao_nome: servicoPadraoNome ?? null
      },
      update: {
        duracao_padrao_minutos: duracao,
        buffer_minutos: buffer,
        antecedencia_minima_dias: antecedencia,
        limite_maximo_dias: limiteMaximoDias,
        ...(servicoPadraoNome !== undefined && { servico_padrao_nome: servicoPadraoNome })
      }
    });

    for (const d of body.disponibilidade) {
      await tx.disponibilidadeSemanal.upsert({
        where: {
          usuario_id_dia_semana: { usuario_id: userId, dia_semana: d.dia_semana }
        },
        create: {
          usuario_id: userId,
          dia_semana: d.dia_semana,
          ativo: d.ativo,
          hora_inicio: d.hora_inicio,
          hora_fim: d.hora_fim
        },
        update: {
          ativo: d.ativo,
          hora_inicio: d.hora_inicio,
          hora_fim: d.hora_fim
        }
      });
    }
  });

  res.json({ ok: true });
};

function parseTime(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

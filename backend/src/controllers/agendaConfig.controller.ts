import { Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { invalidateAgendaMesCache } from '../services/availability.service';
import { sanitizeSlug, getSlugValidationError, slugBaseFromName } from '../services/slug.service';

const configSchema = z.object({
  hora_inicio_funcionamento: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Use HH:mm'),
  hora_fim_funcionamento: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Use HH:mm'),
  duracao_padrao_minutos: z.number().int().min(5).max(240),
  buffer_minutos: z.number().int().min(0).max(60),
  antecedencia_minima_dias: z.number().int().min(0).max(60),
  limite_maximo_dias: z.number().int().min(1).max(365)
});

export const getConfig = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const config = await prisma.configuracaoAgenda.findUnique({
    where: { usuario_id: userId }
  });
  if (!config) return res.json(null);
  res.json({
    hora_inicio_funcionamento: config.hora_inicio_funcionamento,
    hora_fim_funcionamento: config.hora_fim_funcionamento,
    duracao_padrao_minutos: config.duracao_padrao_minutos,
    buffer_minutos: config.buffer_minutos,
    antecedencia_minima_dias: config.antecedencia_minima_dias,
    limite_maximo_dias: config.limite_maximo_dias
  });
};

export const putConfig = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const body = configSchema.parse(req.body);
  const hi = body.hora_inicio_funcionamento;
  const hf = body.hora_fim_funcionamento;
  const [hiH, hiM] = hi.split(':').map(Number);
  const [hfH, hfM] = hf.split(':').map(Number);
  if (hiH * 60 + hiM >= hfH * 60 + hfM) {
    throw new AppError('hora_inicio deve ser menor que hora_fim', 400);
  }
  const config = await prisma.configuracaoAgenda.upsert({
    where: { usuario_id: userId },
    create: { usuario_id: userId, ...body },
    update: body
  });
  invalidateAgendaMesCache(userId);
  res.json(config);
};

const slugBodySchema = z.object({
  slug: z.string().min(1, 'Informe o slug')
});

/** Gera um slug único a partir do nome (base, base-2, base-3...). */
async function generateUniqueSlug(userId: string, nome: string): Promise<string> {
  const base = slugBaseFromName(nome);
  let candidate = base;
  let n = 1;
  while (true) {
    const taken = await prisma.usuario.findFirst({
      where: { agenda_slug: candidate, id: { not: userId } }
    });
    if (!taken) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
    if (candidate.length > 60) candidate = `agenda-${n}`;
  }
}

export const getSlug = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { agenda_slug: true, nome_organizacao: true, nome: true, email: true }
  });
  if (!user) return res.json({ agenda_slug: null });
  let slug = user.agenda_slug;
  if (!slug) {
    const nome = [user.nome_organizacao, user.nome, user.email].find(Boolean) as string || 'agenda';
    slug = await generateUniqueSlug(userId, nome);
    await prisma.usuario.update({
      where: { id: userId },
      data: { agenda_slug: slug }
    });
  }
  res.json({ agenda_slug: slug });
};

export const putSlug = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { slug: raw } = slugBodySchema.parse(req.body);
  const slug = sanitizeSlug(raw);
  const errorMsg = getSlugValidationError(raw);
  if (!slug || errorMsg) throw new AppError(errorMsg || 'Slug inválido.', 400);
  const existing = await prisma.usuario.findFirst({
    where: { agenda_slug: slug, id: { not: userId } }
  });
  if (existing) throw new AppError('Este endereço já está em uso. Escolha outro.', 409);
  await prisma.usuario.update({
    where: { id: userId },
    data: { agenda_slug: slug }
  });
  res.json({ agenda_slug: slug });
};

const brandingSchema = z.object({
  nome_organizacao: z.string().min(1).max(200).optional(),
  nome_unidade: z.string().max(200).optional(),
  logo_url: z.string().url().max(500).optional().nullable(),
  cor_primaria_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  status_operacao: z.string().max(100).optional().nullable()
});

export const getBranding = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { nome_organizacao: true, nome_unidade: true, logo_url: true, cor_primaria_hex: true, status_operacao: true }
  });
  if (!user) return res.json({});
  res.json({
    nome_organizacao: user.nome_organizacao ?? '',
    nome_unidade: user.nome_unidade ?? '',
    logo_url: user.logo_url ?? '',
    cor_primaria_hex: user.cor_primaria_hex ?? '',
    status_operacao: user.status_operacao ?? ''
  });
};

export const putBranding = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const body = brandingSchema.parse(req.body);
  await prisma.usuario.update({
    where: { id: userId },
    data: {
      nome_organizacao: body.nome_organizacao ?? null,
      nome_unidade: body.nome_unidade || null,
      logo_url: body.logo_url || null,
      cor_primaria_hex: body.cor_primaria_hex || null,
      status_operacao: body.status_operacao || null
    }
  });
  res.json({ ok: true });
};

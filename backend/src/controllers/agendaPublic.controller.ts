import { Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../lib/prisma';
import { getDiasDisponiveis, getHorariosDisponiveis, getMesDisponibilidade, getMinMaxDataStr } from '../services/availability.service';
import { createAgendamentoPublic } from '../services/booking.service';

const IDEMPOTENCY_TTL_MS = 60_000;
const idempotencyCache = new Map<string, { statusCode: number; body: unknown; createdAt: number }>();

function purgeIdempotency() {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache.entries()) {
    if (now - entry.createdAt > IDEMPOTENCY_TTL_MS) idempotencyCache.delete(key);
  }
}

export const getDias = async (req: Request, res: Response) => {
  const slugRaw = (req.params.empresaSlug || '').trim().toLowerCase();
  if (!slugRaw) throw new AppError('Agenda não encontrada.', 404);

  const ano = req.query.ano != null ? Number(req.query.ano) : null;
  const mes = req.query.mes != null ? Number(req.query.mes) : null;
  let from: string;
  let to: string;
  if (ano != null && mes != null && !isNaN(ano) && !isNaN(mes) && mes >= 1 && mes <= 12) {
    const first = new Date(ano, mes - 1, 1);
    const last = new Date(ano, mes, 0);
    from = toLocalDateString(first);
    to = toLocalDateString(last);
  } else {
    from = (req.query.from as string) || toLocalDateString(new Date());
    to = (req.query.to as string) || toLocalDateString(addDays(new Date(), 90));
  }

  const user = await prisma.usuario.findFirst({
    where: { agenda_slug: { equals: slugRaw, mode: 'insensitive' } }
  });
  if (!user) throw new AppError('Agenda não encontrada.', 404);

  const dias = await getDiasDisponiveis(user.id, from, to);
  res.json({ dias });
};

export const getMes = async (req: Request, res: Response) => {
  const slugRaw = (req.params.empresaSlug || '').trim().toLowerCase();
  if (!slugRaw) throw new AppError('Agenda não encontrada.', 404);
  const ano = req.query.ano != null ? Number(req.query.ano) : new Date().getFullYear();
  const mes = req.query.mes != null ? Number(req.query.mes) : new Date().getMonth() + 1;
  if (isNaN(ano) || isNaN(mes) || mes < 1 || mes > 12) throw new AppError('Parâmetros ano e mês inválidos.', 400);

  const user = await prisma.usuario.findFirst({
    where: { agenda_slug: { equals: slugRaw, mode: 'insensitive' } }
  });
  if (!user) throw new AppError('Agenda não encontrada.', 404);

  const result = await getMesDisponibilidade(user.id, ano, mes);
  res.json(result);
};

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

export const getHorarios = async (req: Request, res: Response) => {
  const slugNorm = (req.params.empresaSlug || '').trim().toLowerCase();
  const data = req.query.data as string;
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new AppError('Query data obrigatória (YYYY-MM-DD).', 400);
  }
  if (!slugNorm) throw new AppError('Agenda não encontrada.', 404);

  const user = await prisma.usuario.findFirst({
    where: { agenda_slug: { equals: slugNorm, mode: 'insensitive' } }
  });
  if (!user) throw new AppError('Agenda não encontrada.', 404);

  const config = await prisma.configuracaoAgenda.findUnique({
    where: { usuario_id: user.id }
  });
  if (config) {
    const { minDataStr } = getMinMaxDataStr(config.antecedencia_minima_dias, config.limite_maximo_dias);
    if (data < minDataStr) {
      const N = config.antecedencia_minima_dias;
      throw new AppError(`Agendamentos exigem pelo menos ${N} dias de antecedência.`, 400);
    }
  }

  const horarios = await getHorariosDisponiveis(user.id, data);
  res.json({ horarios });
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): void {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    throw new AppError('Muitas tentativas. Aguarde um minuto e tente novamente.', 429);
  }
}

export const createAgendamento = async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  checkRateLimit(ip);

  const slugNorm = (req.params.empresaSlug || '').trim().toLowerCase();
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  if (!slugNorm) throw new AppError('Agenda não encontrada.', 404);

  const user = await prisma.usuario.findFirst({
    where: { agenda_slug: { equals: slugNorm, mode: 'insensitive' } }
  });
  if (!user) throw new AppError('Agenda não encontrada.', 404);

  if (idempotencyKey) {
    purgeIdempotency();
    const key = `${user.id}:${idempotencyKey}`;
    const cached = idempotencyCache.get(key);
    if (cached) {
      return res.status(cached.statusCode).json(cached.body);
    }
  }

  const body = req.body;
  const payload = {
    data: typeof body.data === 'string' ? body.data.trim() : '',
    hora_inicio: typeof body.hora_inicio === 'string' ? body.hora_inicio.trim() : '',
    nome_cliente: typeof body.nome_cliente === 'string' ? body.nome_cliente.trim() : '',
    telefone_cliente: typeof body.telefone_cliente === 'string' ? body.telefone_cliente.replace(/\D/g, '') : '',
    observacao: typeof body.observacao === 'string' ? body.observacao.trim() : undefined
  };
  const agendamento = await createAgendamentoPublic(user.id, payload, idempotencyKey || null);

  const tel = agendamento.telefone_cliente.replace(/\D/g, '');
  const msg = `Olá ${agendamento.nome_cliente}, seu agendamento foi solicitado para ${agendamento.data.toISOString().slice(0, 10)} às ${agendamento.hora_inicio}. Aguarde confirmação.`;
  const whatsappUrl = `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`;

  const response = {
    ok: true,
    agendamentoId: agendamento.id,
    status: agendamento.status,
    mensagem: 'Agendamento solicitado com sucesso!',
    whatsappUrl: whatsappUrl,
    message: 'Agendamento solicitado com sucesso!',
    agendamento: {
      id: agendamento.id,
      data: agendamento.data.toISOString().slice(0, 10),
      hora_inicio: agendamento.hora_inicio,
      hora_fim: agendamento.hora_fim,
      status: agendamento.status
    },
    whatsapp_url: whatsappUrl
  };

  if (idempotencyKey) {
    const key = `${user.id}:${idempotencyKey}`;
    idempotencyCache.set(key, { statusCode: 201, body: response, createdAt: Date.now() });
  }

  res.status(201).json(response);
};

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function sanitizeSlug(slug: string): string | null {
  const s = String(slug).toLowerCase().trim();
  if (!s || s.length > 64) return null;
  if (!SLUG_REGEX.test(s)) return null;
  return s;
}

export const getBranding = async (req: Request, res: Response) => {
  const slugRaw = req.params.empresaSlug;
  const empresaSlug = sanitizeSlug(slugRaw);
  if (!empresaSlug) throw new AppError('Agenda não encontrada.', 404);

  const user = await prisma.usuario.findFirst({
    where: { agenda_slug: empresaSlug },
    select: {
      id: true,
      nome: true,
      nome_organizacao: true,
      nome_unidade: true,
      logo_url: true,
      cor_primaria_hex: true,
      status_operacao: true
    }
  });
  if (!user) throw new AppError('Agenda não encontrada.', 404);

  const config = await prisma.configuracaoAgenda.findUnique({
    where: { usuario_id: user.id }
  });
  if (!config) throw new AppError('Agenda não encontrada.', 404);

  const nomeOrganizacao = user.nome_organizacao || user.nome || 'Agendamento';
  const corPrimariaHex = user.cor_primaria_hex && /^#[0-9A-Fa-f]{6}$/.test(user.cor_primaria_hex)
    ? user.cor_primaria_hex
    : undefined;

  res.json({
    empresaId: user.id,
    nomeOrganizacao,
    nomeUnidade: user.nome_unidade || undefined,
    logoUrl: user.logo_url || undefined,
    corPrimariaHex: corPrimariaHex || undefined,
    statusOperacao: user.status_operacao || undefined
  });
};

/** Configuração pública mínima para a página de agendamento (resumo, validação UI). */
export const getPublicConfig = async (req: Request, res: Response) => {
  const slugNorm = (req.params.empresaSlug || '').trim().toLowerCase();
  if (!slugNorm) throw new AppError('Agenda não encontrada.', 404);

  const user = await prisma.usuario.findFirst({
    where: { agenda_slug: { equals: slugNorm, mode: 'insensitive' } },
    select: { id: true, nome: true, nome_organizacao: true, nome_unidade: true }
  });
  if (!user) throw new AppError('Agenda não encontrada.', 404);

  const config = await prisma.configuracaoAgenda.findUnique({
    where: { usuario_id: user.id }
  });

  const nomeOrganizacao = user.nome_organizacao || user.nome || 'Agendamento';
  const nomeUnidade = user.nome_unidade || undefined;
  const duracao_slot_min = config?.duracao_padrao_minutos ?? 30;
  const buffer_min = config?.buffer_minutos ?? 0;
  const antecedencia_min_dias = config?.antecedencia_minima_dias ?? 0;
  const limite_maximo_dias = config?.limite_maximo_dias ?? 30;
  const servico_padrao_nome = config?.servico_padrao_nome?.trim() || undefined;

  res.json({
    nomeOrganizacao,
    nomeUnidade,
    duracao_slot_min,
    buffer_min,
    antecedencia_min_dias,
    limite_maximo_dias,
    servico_padrao_nome
  });
};

export const getAgendaInfo = async (req: Request, res: Response) => {
  const { empresaSlug } = req.params;
  const user = await prisma.usuario.findFirst({
    where: { agenda_slug: empresaSlug },
    select: { id: true, nome: true, nome_organizacao: true, agenda_slug: true }
  });
  if (!user) throw new AppError('Agenda não encontrada.', 404);

  const config = await prisma.configuracaoAgenda.findUnique({
    where: { usuario_id: user.id }
  });
  if (!config) throw new AppError('Agenda não configurada.', 404);

  const nome = user.nome_organizacao || user.nome || 'Agenda';
  res.json({
    slug: user.agenda_slug,
    nome
  });
};

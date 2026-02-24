import { Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { sanitizeSlug, getSlugValidationError } from '../services/slug.service';
import { getMensagensTemplates } from '../services/companySettings.service';

const MSG_MAX = 1000;
const DEFAULT_MSG_ATENCAO = 'Olá {NOME}! Tudo bem? Faz {DIAS} dias que você não aparece. Quer marcar um horário essa semana? 🙂';
const DEFAULT_MSG_INATIVO = 'Olá {NOME}! Tudo bem? Faz {DIAS} dias que você não aparece. Posso te ajudar a agendar um horário? 🙂';

const putSchema = z.object({
  empresa: z.object({
    slug: z.string().min(1).max(120).optional()
  }).optional(),
  retencao: z.object({
    dias_atencao: z.number().int().min(1).max(365).optional(),
    dias_inativo: z.number().int().min(1).max(365).optional()
  }).optional(),
  mensagens: z.object({
    msg_whatsapp_atencao: z.string().max(MSG_MAX).optional().nullable(),
    msg_whatsapp_inativo: z.string().max(MSG_MAX).optional().nullable(),
    msg_whatsapp_pos_venda: z.string().max(MSG_MAX).optional().nullable(),
    msg_whatsapp_confirmacao_agenda: z.string().max(MSG_MAX).optional().nullable(),
    msg_whatsapp_lembrete_agenda: z.string().max(MSG_MAX).optional().nullable()
  }).optional(),
  plano: z.object({
    plano: z.enum(['FREE', 'TRIAL', 'PAID']).optional(),
    trial_ends_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    is_active: z.boolean().optional(),
    blocked_reason: z.string().max(500).optional().nullable()
  }).optional(),
  meta: z.object({
    meta_faturamento_mes: z.number().min(0).optional().nullable()
  }).optional()
}).strict();

async function getOrCreateSettings(userId: string) {
  let s = await prisma.companySettings.findUnique({
    where: { usuario_id: userId }
  });
  if (!s) {
    s = await prisma.companySettings.create({
      data: {
        usuario_id: userId,
        dias_atencao: 30,
        dias_inativo: 45
      }
    });
  }
  return s;
}

/** Resposta padrão quando company_settings não está disponível (ex.: tabela não criada). */
function defaultConfigResponse(user: { agenda_slug: string | null } | null, configAgenda: unknown) {
  const slug = user?.agenda_slug ?? null;
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const linkPreview = slug ? `${baseUrl.replace(/\/$/, '')}/agenda/${slug}` : null;
  return {
    empresa: { slug, link_preview: linkPreview },
    retencao: { dias_atencao: 30, dias_inativo: 45 },
    mensagens: {
      msg_whatsapp_atencao: DEFAULT_MSG_ATENCAO,
      msg_whatsapp_inativo: DEFAULT_MSG_INATIVO,
      msg_whatsapp_pos_venda: null,
      msg_whatsapp_confirmacao_agenda: null,
      msg_whatsapp_lembrete_agenda: null
    },
    agendamentos: { configurado: !!configAgenda },
    plano: { plano: 'FREE', trial_ends_at: null, is_active: true, blocked_reason: null },
    meta: { meta_faturamento_mes: null }
  };
}

/** GET /configuracoes — configurações consolidadas por empresa (ownership pelo token). */
export const getConfiguracoes = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  let user: { agenda_slug: string | null } | null = null;
  let configAgenda: unknown = null;
  let settings: Awaited<ReturnType<typeof getOrCreateSettings>> | null = null;

  try {
    [user, configAgenda] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: userId }, select: { agenda_slug: true } }),
      prisma.configuracaoAgenda.findUnique({ where: { usuario_id: userId } })
    ]);
    settings = await getOrCreateSettings(userId);
  } catch {
    if (!user || configAgenda === undefined) {
      const [u, c] = await Promise.all([
        prisma.usuario.findUnique({ where: { id: userId }, select: { agenda_slug: true } }),
        prisma.configuracaoAgenda.findUnique({ where: { usuario_id: userId } })
      ]).catch(() => [null, null]);
      return res.json(defaultConfigResponse(u ?? null, c ?? null));
    }
    return res.json(defaultConfigResponse(user, configAgenda));
  }

  const slug = user?.agenda_slug ?? null;
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const linkPreview = slug ? `${baseUrl.replace(/\/$/, '')}/agenda/${slug}` : null;

  res.json({
    empresa: { slug, link_preview: linkPreview },
    retencao: { dias_atencao: settings.dias_atencao, dias_inativo: settings.dias_inativo },
    mensagens: {
      msg_whatsapp_atencao: settings.msg_whatsapp_atencao ?? DEFAULT_MSG_ATENCAO,
      msg_whatsapp_inativo: settings.msg_whatsapp_inativo ?? DEFAULT_MSG_INATIVO,
      msg_whatsapp_pos_venda: settings.msg_whatsapp_pos_venda ?? null,
      msg_whatsapp_confirmacao_agenda: settings.msg_whatsapp_confirmacao_agenda ?? null,
      msg_whatsapp_lembrete_agenda: settings.msg_whatsapp_lembrete_agenda ?? null
    },
    agendamentos: { configurado: !!configAgenda },
    plano: {
      plano: settings.plano,
      trial_ends_at: settings.trial_ends_at?.toISOString().slice(0, 10) ?? null,
      is_active: settings.is_active,
      blocked_reason: settings.blocked_reason ?? null
    },
    meta: {
      meta_faturamento_mes: settings.meta_faturamento_mes != null ? Number(settings.meta_faturamento_mes) : null
    }
  });
};

/** GET /configuracoes/mensagens — apenas templates WhatsApp (para uso no botão Clientes). */
export const getConfiguracoesMensagens = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const mensagens = await getMensagensTemplates(userId);
  res.json(mensagens);
};

/** PUT /configuracoes — atualiza apenas os campos enviados (whitelist). */
export const putConfiguracoes = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const body = putSchema.parse(req.body);

  if (body.empresa?.slug !== undefined) {
    const raw = body.empresa.slug.trim();
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
  }

  if (body.retencao) {
    const diasAtencao = body.retencao.dias_atencao;
    const diasInativo = body.retencao.dias_inativo;
    if (diasAtencao !== undefined && diasInativo !== undefined && diasAtencao >= diasInativo) {
      throw new AppError('Dias para Atenção deve ser menor que Dias para Inativo.', 400);
    }
    if (diasAtencao !== undefined && (diasAtencao < 1 || diasAtencao > 365)) {
      throw new AppError('Dias para Atenção deve estar entre 1 e 365.', 400);
    }
    if (diasInativo !== undefined && (diasInativo < 1 || diasInativo > 365)) {
      throw new AppError('Dias para Inativo deve estar entre 1 e 365.', 400);
    }
  }

  try {
    const settings = await getOrCreateSettings(userId);
    const updateData: Record<string, unknown> = {};

    if (body.retencao?.dias_atencao !== undefined) updateData.dias_atencao = body.retencao.dias_atencao;
    if (body.retencao?.dias_inativo !== undefined) updateData.dias_inativo = body.retencao.dias_inativo;
    if (body.mensagens) {
      if (body.mensagens.msg_whatsapp_atencao !== undefined) updateData.msg_whatsapp_atencao = body.mensagens.msg_whatsapp_atencao?.trim() || null;
      if (body.mensagens.msg_whatsapp_inativo !== undefined) updateData.msg_whatsapp_inativo = body.mensagens.msg_whatsapp_inativo?.trim() || null;
      if (body.mensagens.msg_whatsapp_pos_venda !== undefined) updateData.msg_whatsapp_pos_venda = body.mensagens.msg_whatsapp_pos_venda?.trim() || null;
      if (body.mensagens.msg_whatsapp_confirmacao_agenda !== undefined) updateData.msg_whatsapp_confirmacao_agenda = body.mensagens.msg_whatsapp_confirmacao_agenda?.trim() || null;
      if (body.mensagens.msg_whatsapp_lembrete_agenda !== undefined) updateData.msg_whatsapp_lembrete_agenda = body.mensagens.msg_whatsapp_lembrete_agenda?.trim() || null;
    }
    if (body.plano) {
      if (body.plano.plano !== undefined) updateData.plano = body.plano.plano;
      if (body.plano.trial_ends_at !== undefined) updateData.trial_ends_at = body.plano.trial_ends_at ? new Date(body.plano.trial_ends_at) : null;
      if (body.plano.is_active !== undefined) updateData.is_active = body.plano.is_active;
      if (body.plano.blocked_reason !== undefined) updateData.blocked_reason = body.plano.blocked_reason?.trim().slice(0, 500) || null;
    }
    if (body.meta?.meta_faturamento_mes !== undefined) updateData.meta_faturamento_mes = body.meta.meta_faturamento_mes;

    if (Object.keys(updateData).length > 0) {
      await prisma.companySettings.update({
        where: { usuario_id: userId },
        data: updateData as any
      });
    }

    res.json({ success: true, message: 'Configurações salvas com sucesso.' });
  } catch (e: any) {
    const msg = e?.message || '';
    if (/company_settings|Unknown table|does not exist/i.test(msg)) {
      throw new AppError('Tabela de configurações não encontrada. Execute: npx prisma migrate dev (ou db push).', 503);
    }
    throw e;
  }
};

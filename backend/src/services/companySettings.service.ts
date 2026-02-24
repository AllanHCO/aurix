import { prisma } from '../lib/prisma';

const DEFAULT_DIAS_ATENCAO = 30;
const DEFAULT_DIAS_INATIVO = 45;

export async function getRetencaoThresholds(usuarioId: string): Promise<{ dias_atencao: number; dias_inativo: number }> {
  try {
    const s = await prisma.companySettings.findUnique({
      where: { usuario_id: usuarioId }
    });
    return {
      dias_atencao: s?.dias_atencao ?? DEFAULT_DIAS_ATENCAO,
      dias_inativo: s?.dias_inativo ?? DEFAULT_DIAS_INATIVO
    };
  } catch {
    return { dias_atencao: DEFAULT_DIAS_ATENCAO, dias_inativo: DEFAULT_DIAS_INATIVO };
  }
}

const DEFAULT_MSG_ATENCAO = 'Olá {NOME}! Tudo bem? Faz {DIAS} dias que você não aparece. Quer marcar um horário essa semana? 🙂';
const DEFAULT_MSG_INATIVO = 'Olá {NOME}! Tudo bem? Faz {DIAS} dias que você não aparece. Posso te ajudar a agendar um horário? 🙂';

export async function getMensagensTemplates(usuarioId: string): Promise<{
  msg_whatsapp_atencao: string;
  msg_whatsapp_inativo: string;
  msg_whatsapp_pos_venda: string | null;
  msg_whatsapp_confirmacao_agenda: string | null;
  msg_whatsapp_lembrete_agenda: string | null;
}> {
  try {
    const s = await prisma.companySettings.findUnique({
      where: { usuario_id: usuarioId }
    });
    return {
      msg_whatsapp_atencao: s?.msg_whatsapp_atencao?.trim() || DEFAULT_MSG_ATENCAO,
      msg_whatsapp_inativo: s?.msg_whatsapp_inativo?.trim() || DEFAULT_MSG_INATIVO,
      msg_whatsapp_pos_venda: s?.msg_whatsapp_pos_venda?.trim() || null,
      msg_whatsapp_confirmacao_agenda: s?.msg_whatsapp_confirmacao_agenda?.trim() || null,
      msg_whatsapp_lembrete_agenda: s?.msg_whatsapp_lembrete_agenda?.trim() || null
    };
  } catch {
    return {
      msg_whatsapp_atencao: DEFAULT_MSG_ATENCAO,
      msg_whatsapp_inativo: DEFAULT_MSG_INATIVO,
      msg_whatsapp_pos_venda: null,
      msg_whatsapp_confirmacao_agenda: null,
      msg_whatsapp_lembrete_agenda: null
    };
  }
}

export function applyTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
  }
  return out.replace(/\{[A-Z_]+\}/g, '').trim() || 'Olá!';
}

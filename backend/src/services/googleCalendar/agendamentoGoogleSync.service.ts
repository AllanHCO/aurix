import { prisma } from '../../lib/prisma';
import type { Agendamento } from '@prisma/client';
import { getCalendarContextForUser, type CalendarContext } from './googleCalendarClient.service';

const DEFAULT_TZ = process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() || 'America/Sao_Paulo';

function formatGoogleSyncError(e: unknown): string {
  const g = e as {
    response?: {
      data?: {
        error?: { message?: string; errors?: Array<{ message?: string }> };
        error_message?: string;
      };
    };
    message?: string;
  };
  const d = g.response?.data;
  const nested = d?.error?.errors?.[0]?.message;
  const apiMsg =
    nested ||
    d?.error?.message ||
    (d as { message?: string } | undefined)?.message ||
    d?.error_message;
  if (apiMsg && typeof apiMsg === 'string') return apiMsg;
  if (e instanceof Error) return e.message;
  return 'Erro ao sincronizar com Google Calendar';
}

/** Sincroniza um agendamento com o Google Calendar (não bloqueia fluxo principal se falhar). */
export async function syncAgendamentoToGoogle(usuarioId: string, agendamentoId: string): Promise<void> {
  try {
    const ctx = await getCalendarContextForUser(usuarioId);
    if (!ctx) return;

    const ag = await prisma.agendamento.findFirst({
      where: { id: agendamentoId, usuario_id: usuarioId }
    });
    if (!ag) return;

    if (ag.status === 'CANCELADO') {
      await deleteGoogleEvent(ctx, ag);
      return;
    }

    await upsertGoogleEvent(ctx, usuarioId, ag);
  } catch (e) {
    const msg = formatGoogleSyncError(e).slice(0, 500);
    await prisma.agendamento.updateMany({
      where: { id: agendamentoId, usuario_id: usuarioId },
      data: {
        google_sync_status: 'error',
        google_sync_error: msg,
        google_last_sync_at: new Date()
      }
    });
  }
}

async function deleteGoogleEvent(ctx: CalendarContext, ag: Agendamento): Promise<void> {
  const calId = ag.google_calendar_id || ctx.integration.calendar_id;
  if (!ag.google_event_id) {
    await prisma.agendamento.update({
      where: { id: ag.id },
      data: {
        google_sync_status: 'synced',
        google_sync_error: null,
        google_last_sync_at: new Date()
      }
    });
    return;
  }
  try {
    await ctx.calendar.events.delete({
      calendarId: calId,
      eventId: ag.google_event_id
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code !== 404) throw err;
  }
  await prisma.agendamento.update({
    where: { id: ag.id },
    data: {
      google_event_id: null,
      google_calendar_id: null,
      google_sync_status: 'synced',
      google_sync_error: null,
      google_last_sync_at: new Date()
    }
  });
}

async function upsertGoogleEvent(ctx: CalendarContext, usuarioId: string, ag: Agendamento): Promise<void> {
  const [usuario, config] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nome_organizacao: true, nome: true }
    }),
    prisma.configuracaoAgenda.findUnique({
      where: { usuario_id: usuarioId },
      select: { servico_padrao_nome: true }
    })
  ]);

  const org = usuario?.nome_organizacao || usuario?.nome || 'Aurix';
  const servico = config?.servico_padrao_nome?.trim() || '';
  const event = buildCalendarEventBody(ag, org, servico);
  const calendarId = ctx.integration.calendar_id || 'primary';

  if (ag.google_event_id) {
    try {
      await ctx.calendar.events.patch({
        calendarId: ag.google_calendar_id || calendarId,
        eventId: ag.google_event_id,
        requestBody: event
      });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 404) {
        const { data } = await ctx.calendar.events.insert({
          calendarId,
          requestBody: event
        });
        await prisma.agendamento.update({
          where: { id: ag.id },
          data: {
            google_event_id: data.id!,
            google_calendar_id: calendarId,
            google_sync_status: 'synced',
            google_last_sync_at: new Date(),
            google_sync_error: null
          }
        });
        return;
      }
      throw err;
    }
    await prisma.agendamento.update({
      where: { id: ag.id },
      data: {
        google_sync_status: 'synced',
        google_last_sync_at: new Date(),
        google_sync_error: null,
        google_calendar_id: ag.google_calendar_id || calendarId
      }
    });
    return;
  }

  const { data } = await ctx.calendar.events.insert({
    calendarId,
    requestBody: event
  });
  await prisma.agendamento.update({
    where: { id: ag.id },
    data: {
      google_event_id: data.id!,
      google_calendar_id: calendarId,
      google_sync_status: 'synced',
      google_last_sync_at: new Date(),
      google_sync_error: null
    }
  });
}

function buildCalendarEventBody(ag: Agendamento, orgName: string, servicoNome: string): {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
} {
  const y = ag.data.getFullYear();
  const m = String(ag.data.getMonth() + 1).padStart(2, '0');
  const d = String(ag.data.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  const summary =
    servicoNome.length > 0
      ? `${ag.nome_cliente} — ${servicoNome}`.slice(0, 1024)
      : `Atendimento: ${ag.nome_cliente}`.slice(0, 1024);

  const statusPt =
    ag.status === 'CONFIRMADO' ? 'Confirmado' : ag.status === 'PENDENTE' ? 'Pendente' : String(ag.status);

  const lines = [
    `Cliente: ${ag.nome_cliente}`,
    `Telefone: ${ag.telefone_cliente}`,
    `Status: ${statusPt}`,
    servicoNome ? `Serviço: ${servicoNome}` : null,
    `Estabelecimento: ${orgName}`,
    ag.observacao?.trim() ? `Observação: ${ag.observacao.trim()}` : null,
    '',
    'Origem: Aurix'
  ].filter(Boolean);
  const description = lines.join('\n').slice(0, 8000);

  return {
    summary,
    description,
    start: { dateTime: `${dateStr}T${ag.hora_inicio}:00`, timeZone: DEFAULT_TZ },
    end: { dateTime: `${dateStr}T${ag.hora_fim}:00`, timeZone: DEFAULT_TZ }
  };
}

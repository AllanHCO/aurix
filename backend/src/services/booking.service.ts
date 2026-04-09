import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { getHorariosDisponiveis, getMinMaxDataStr, invalidateAgendaMesCache } from './availability.service';
import { syncAgendamentoToGoogle } from './googleCalendar/agendamentoGoogleSync.service';

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

function parseTime(s: string): number {
  if (!TIME_REGEX.test(s)) return NaN;
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Normaliza telefone: só dígitos. */
function normalizePhone(tel: string): string {
  return tel.replace(/\D/g, '').trim();
}

export async function createAgendamentoPublic(
  usuarioId: string,
  body: {
    nome_cliente: string;
    telefone_cliente: string;
    observacao?: string;
    data: string;
    hora_inicio: string;
  },
  idempotencyKey: string | null
) {
  const nome = String(body.nome_cliente ?? '').trim().slice(0, 200);
  const telefone = normalizePhone(String(body.telefone_cliente ?? ''));
  const observacaoRaw = body.observacao != null ? String(body.observacao).trim() : '';
  const observacao = observacaoRaw
    ? observacaoRaw.replace(/<[^>]*>/g, '').slice(0, 500).trim() || null
    : null;
  const dataStr = body.data;
  const horaInicio = body.hora_inicio;

  if (!nome || nome.length < 2) throw new AppError('Nome é obrigatório (mín. 2 caracteres).', 400);
  if (!telefone || telefone.length < 10) throw new AppError('Telefone é obrigatório (mín. 10 dígitos).', 400);
  if (observacaoRaw.length > 500) throw new AppError('Observação deve ter no máximo 500 caracteres.', 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) throw new AppError('Data inválida. Use YYYY-MM-DD.', 400);
  if (!TIME_REGEX.test(horaInicio)) throw new AppError('Horário inválido. Use HH:mm.', 400);

  const config = await prisma.configuracaoAgenda.findUnique({
    where: { usuario_id: usuarioId }
  });
  if (!config) throw new AppError('Agenda não configurada.', 400);

  const { minDataStr, maxDataStr } = getMinMaxDataStr(config.antecedencia_minima_dias, config.limite_maximo_dias);
  if (dataStr < minDataStr) {
    const N = config.antecedencia_minima_dias;
    throw new AppError(`Agendamentos exigem pelo menos ${N} dias de antecedência.`, 400);
  }
  if (dataStr > maxDataStr) throw new AppError('Data além do limite máximo.', 400);

  const data = new Date(dataStr + 'T12:00:00');

  const slots = await getHorariosDisponiveis(usuarioId, dataStr);
  const slotValido = slots.find((s) => s.hora_inicio === horaInicio);
  if (!slotValido) throw new AppError('Horário não disponível.', 400);

  const inicioMin = parseTime(config.hora_inicio_funcionamento);
  const fimMin = parseTime(config.hora_fim_funcionamento);
  const slotInicioMin = parseTime(horaInicio);
  if (slotInicioMin < inicioMin || slotInicioMin >= fimMin)
    throw new AppError('Horário fora do funcionamento.', 400);

  const duracao = config.duracao_padrao_minutos;
  const horaFim = formatTime(slotInicioMin + duracao);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.agendamento.findFirst({
      where: {
        usuario_id: usuarioId,
        data: data,
        hora_inicio: horaInicio,
        status: { in: ['PENDENTE', 'CONFIRMADO'] }
      }
    });
    if (existing) throw new AppError('Este horário já está ocupado.', 409);

    const agendamento = await tx.agendamento.create({
      data: {
        usuario_id: usuarioId,
        nome_cliente: nome,
        telefone_cliente: telefone,
        observacao: observacao || undefined,
        data: data,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        status: 'PENDENTE'
      }
    });

    return agendamento;
  });
  invalidateAgendaMesCache(usuarioId);
  void syncAgendamentoToGoogle(usuarioId, result.id).catch((err) =>
    console.error('[GoogleCalendar] sync após criar agendamento:', err)
  );
  return result;
}

/** Cria agendamento manual (painel interno). Mesma validação do público, sem idempotência. */
export async function createAgendamentoManual(
  usuarioId: string,
  body: {
    nome_cliente: string;
    telefone_cliente: string;
    observacao?: string;
    data: string;
    hora_inicio: string;
  }
) {
  return createAgendamentoPublic(usuarioId, body, null);
}

/** Atualiza agendamento (edição no painel). Valida horário disponível se data/hora mudarem. */
export async function updateAgendamentoForUsuario(
  usuarioId: string,
  agendamentoId: string,
  body: {
    nome_cliente?: string;
    telefone_cliente?: string;
    observacao?: string | null;
    data?: string;
    hora_inicio?: string;
  }
) {
  const existing = await prisma.agendamento.findFirst({
    where: { id: agendamentoId, usuario_id: usuarioId }
  });
  if (!existing) throw new AppError('Agendamento não encontrado', 404);
  if (existing.status === 'CANCELADO') throw new AppError('Agendamento cancelado não pode ser editado.', 400);

  const dataStr: string = body.data ?? toDateString(existing.data);
  const horaInicio = body.hora_inicio ?? existing.hora_inicio;

  if (body.data || body.hora_inicio) {
    const slots = await getHorariosDisponiveis(usuarioId, dataStr);
    const slotValido = slots.find((s) => s.hora_inicio === horaInicio);
    if (!slotValido) throw new AppError('Horário não disponível.', 400);

    const dataD = new Date(dataStr + 'T12:00:00');
    const conflict = await prisma.agendamento.findFirst({
      where: {
        usuario_id: usuarioId,
        data: dataD,
        hora_inicio: horaInicio,
        status: { in: ['PENDENTE', 'CONFIRMADO'] },
        id: { not: agendamentoId }
      }
    });
    if (conflict) throw new AppError('Este horário já está ocupado.', 409);
  }

  const config = await prisma.configuracaoAgenda.findUnique({
    where: { usuario_id: usuarioId }
  });
  if (!config) throw new AppError('Agenda não configurada.', 400);

  const slotInicioMin = parseTime(horaInicio);
  const horaFim = formatTime(slotInicioMin + config.duracao_padrao_minutos);

  const nome =
    body.nome_cliente !== undefined ? String(body.nome_cliente).trim().slice(0, 200) : existing.nome_cliente;
  const tel =
    body.telefone_cliente !== undefined
      ? normalizePhone(String(body.telefone_cliente))
      : existing.telefone_cliente;
  if (!nome || nome.length < 2) throw new AppError('Nome é obrigatório (mín. 2 caracteres).', 400);
  if (!tel || tel.length < 10) throw new AppError('Telefone é obrigatório (mín. 10 dígitos).', 400);

  let observacao: string | null | undefined = undefined;
  if (body.observacao !== undefined) {
    const o = body.observacao != null ? String(body.observacao).trim() : '';
    observacao = o ? o.replace(/<[^>]*>/g, '').slice(0, 500).trim() || null : null;
    if (String(body.observacao ?? '').length > 500) throw new AppError('Observação deve ter no máximo 500 caracteres.', 400);
  }

  const updated = await prisma.agendamento.update({
    where: { id: agendamentoId },
    data: {
      nome_cliente: nome,
      telefone_cliente: tel,
      observacao: observacao !== undefined ? observacao : existing.observacao,
      data: body.data ? new Date(dataStr + 'T12:00:00') : existing.data,
      hora_inicio: horaInicio,
      hora_fim: horaFim
    }
  });
  invalidateAgendaMesCache(usuarioId);
  void syncAgendamentoToGoogle(usuarioId, updated.id).catch((err) =>
    console.error('[GoogleCalendar] sync após editar agendamento:', err)
  );
  return updated;
}

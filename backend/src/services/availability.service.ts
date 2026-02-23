import { prisma } from '../lib/prisma';

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

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Data no formato YYYY-MM-DD usando o dia civil local (evita deslocamento por fuso). */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Início do dia de hoje no fuso local (para regra de antecedência). */
function getStartOfDayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Primeiro dia agendável = hoje + (antecedencia_minima_dias + 1) dias.
 * Ex.: hoje 22, N=2 → dias 23 e 24 indisponíveis, primeiro agendável = 25.
 */
export function getMinMaxDataStr(antecedenciaDias: number, limiteDias: number): { minDataStr: string; maxDataStr: string } {
  const startOfToday = getStartOfDayLocal();
  const minDataStr = toLocalDateString(addDays(startOfToday, antecedenciaDias + 1));
  const maxDataStr = toLocalDateString(addDays(startOfToday, limiteDias));
  return { minDataStr, maxDataStr };
}

function getDayOfWeek(d: Date): number {
  return d.getDay();
}

/** Gera slots do dia (em minutos desde 00:00) sem filtrar bloqueios/agendamentos. */
function generateRawSlots(
  inicioMin: number,
  fimMin: number,
  duracao: number,
  buffer: number
): Array<{ inicio: number; fim: number }> {
  const slots: Array<{ inicio: number; fim: number }> = [];
  let cur = inicioMin;
  while (cur + duracao <= fimMin) {
    slots.push({ inicio: cur, fim: cur + duracao });
    cur += duracao + buffer;
  }
  return slots;
}

/** Verifica se slot (inicioMin, fimMin) colide com bloqueio recorrente (dia_semana + hora). */
function slotCollidesRecorrente(
  slotInicio: number,
  slotFim: number,
  diaSemana: number,
  bloqueios: { dia_semana: number | null; hora_inicio: string | null; hora_fim: string | null }[]
): boolean {
  for (const b of bloqueios) {
    if (b.dia_semana !== diaSemana || !b.hora_inicio || !b.hora_fim) continue;
    const bInicio = parseTime(b.hora_inicio);
    const bFim = parseTime(b.hora_fim);
    if (bInicio >= bFim) continue;
    if (slotInicio < bFim && slotFim > bInicio) return true;
  }
  return false;
}

/** Bloqueio intervalo dia inteiro: data está dentro do intervalo e sem hora. */
function dateInIntervaloDiaInteiro(
  dataStr: string,
  bloqueios: { data_inicio: Date | null; data_fim: Date | null; hora_inicio: string | null; hora_fim: string | null }[]
): boolean {
  const d = new Date(dataStr + 'T12:00:00');
  for (const b of bloqueios) {
    if (!b.data_inicio || !b.data_fim || b.hora_inicio != null || b.hora_fim != null) continue;
    const start = new Date(b.data_inicio);
    const end = new Date(b.data_fim);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (d >= start && d <= end) return true;
  }
  return false;
}

/** Janela do dia a partir de dados em memória (sem DB). */
function getJanelaDiaFromData(
  dispList: { dia_semana: number; ativo: boolean; hora_inicio: string; hora_fim: string }[],
  config: { hora_inicio_funcionamento: string; hora_fim_funcionamento: string } | null,
  diaSemana: number
): { inicioMin: number; fimMin: number } | null {
  const disp = dispList.find((d) => d.dia_semana === diaSemana);
  if (disp?.ativo) {
    const inicioMin = parseTime(disp.hora_inicio);
    const fimMin = parseTime(disp.hora_fim);
    if (!isNaN(inicioMin) && !isNaN(fimMin) && inicioMin < fimMin) return { inicioMin, fimMin };
  }
  if (!config) return null;
  const inicioMin = parseTime(config.hora_inicio_funcionamento);
  const fimMin = parseTime(config.hora_fim_funcionamento);
  if (isNaN(inicioMin) || isNaN(fimMin) || inicioMin >= fimMin) return null;
  return { inicioMin, fimMin };
}

const MES_CACHE_TTL_MS = 60_000;
const mesCache = new Map<string, { result: MesDisponibilidadeResponse; expiresAt: number }>();

export type MotivoIndisponivel = 'FORA_DA_ANTECEDENCIA' | 'FORA_DO_LIMITE';

export interface MesDisponibilidadeResponse {
  ano: number;
  mes: number;
  dias: Array<{
    data: string;
    status: 'DISPONIVEL' | 'INDISPONIVEL';
    temBloqueios?: boolean;
    motivo?: MotivoIndisponivel;
  }>;
}

/** Invalida cache do mês para um usuário (chamar ao criar/cancelar/confirmar agendamento, criar/remover bloqueio, salvar config). */
export function invalidateAgendaMesCache(usuarioId: string): void {
  const prefix = `agenda:mes:${usuarioId}:`;
  for (const key of mesCache.keys()) {
    if (key.startsWith(prefix)) mesCache.delete(key);
  }
}

export async function getMesDisponibilidade(
  usuarioId: string,
  ano: number,
  mes: number
): Promise<MesDisponibilidadeResponse> {
  const cacheKey = `agenda:mes:${usuarioId}:${ano}-${mes}`;
  const cached = mesCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.result;

  const firstDate = new Date(ano, mes - 1, 1);
  const lastDate = new Date(ano, mes, 0);
  const firstStr = toLocalDateString(firstDate);
  const lastStr = toLocalDateString(lastDate);

  const [config, dispList, bloqueiosRec, bloqueiosInt, agendamentos] = await Promise.all([
    prisma.configuracaoAgenda.findUnique({ where: { usuario_id: usuarioId } }),
    prisma.disponibilidadeSemanal.findMany({ where: { usuario_id: usuarioId } }),
    prisma.bloqueio.findMany({
      where: { usuario_id: usuarioId, tipo: 'RECORRENTE' }
    }),
    prisma.bloqueio.findMany({
      where: {
        usuario_id: usuarioId,
        tipo: 'INTERVALO_DATA',
        data_inicio: { not: null, lte: lastDate },
        data_fim: { not: null, gte: firstDate }
      }
    }),
    prisma.agendamento.findMany({
      where: {
        usuario_id: usuarioId,
        data: { gte: firstDate, lte: lastDate },
        status: { in: ['PENDENTE', 'CONFIRMADO'] }
      },
      select: { data: true }
    })
  ]);

  if (!config) {
    const empty: MesDisponibilidadeResponse = { ano, mes, dias: [] };
    return empty;
  }

  const { minDataStr, maxDataStr } = getMinMaxDataStr(config.antecedencia_minima_dias, config.limite_maximo_dias);
  const duracao = config.duracao_padrao_minutos;
  const buffer = config.buffer_minutos;

  const dias: MesDisponibilidadeResponse['dias'] = [];
  const agendamentosPorData = new Map<string, number>();
  for (const a of agendamentos) {
    const k = toLocalDateString(a.data);
    agendamentosPorData.set(k, (agendamentosPorData.get(k) ?? 0) + 1);
  }

  let d = new Date(firstDate);
  while (d <= lastDate) {
    const dataStr = toLocalDateString(d);
    const diaSemana = getDayOfWeek(d);
    let status: 'DISPONIVEL' | 'INDISPONIVEL' = 'INDISPONIVEL';
    let temBloqueios = false;

    if (dataStr < minDataStr) {
      dias.push({ data: dataStr, status: 'INDISPONIVEL', motivo: 'FORA_DA_ANTECEDENCIA' });
      d.setDate(d.getDate() + 1);
      continue;
    }
    if (dataStr > maxDataStr) {
      dias.push({ data: dataStr, status: 'INDISPONIVEL', motivo: 'FORA_DO_LIMITE' });
      d.setDate(d.getDate() + 1);
      continue;
    }
    if (dateInIntervaloDiaInteiro(dataStr, bloqueiosInt)) {
      dias.push({ data: dataStr, status: 'INDISPONIVEL', temBloqueios: true });
      d.setDate(d.getDate() + 1);
      continue;
    }

    const janela = getJanelaDiaFromData(dispList, config, diaSemana);
    if (!janela) {
      dias.push({ data: dataStr, status: 'INDISPONIVEL' });
      d.setDate(d.getDate() + 1);
      continue;
    }

    const { inicioMin, fimMin } = janela;
    const rawSlots = generateRawSlots(inicioMin, fimMin, duracao, buffer);
    let slotsLivres = 0;
    for (const slot of rawSlots) {
      if (slotCollidesRecorrente(slot.inicio, slot.fim, diaSemana, bloqueiosRec)) continue;
      if (slotCollidesIntervalo(dataStr, slot.inicio, slot.fim, bloqueiosInt)) continue;
      slotsLivres++;
    }
    const ocupados = agendamentosPorData.get(dataStr) ?? 0;
    if (slotsLivres > ocupados) status = 'DISPONIVEL';
    if (bloqueiosRec.some((b) => b.dia_semana === diaSemana)) temBloqueios = true;
    if (bloqueiosInt.some((b) => b.data_inicio && b.data_fim)) {
      const day = new Date(dataStr + 'T12:00:00');
      for (const b of bloqueiosInt) {
        if (!b.data_inicio || !b.data_fim) continue;
        const start = new Date(b.data_inicio);
        const end = new Date(b.data_fim);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        if (day >= start && day <= end) {
          temBloqueios = true;
          break;
        }
      }
    }

    dias.push({ data: dataStr, status, temBloqueios });
    d.setDate(d.getDate() + 1);
  }

  const result: MesDisponibilidadeResponse = { ano, mes, dias };
  mesCache.set(cacheKey, { result, expiresAt: Date.now() + MES_CACHE_TTL_MS });
  return result;
}

/** Para bloqueio por intervalo com horário: verifica se slot colide. */
function slotCollidesIntervalo(
  dataStr: string,
  slotInicio: number,
  slotFim: number,
  bloqueios: { data_inicio: Date | null; data_fim: Date | null; hora_inicio: string | null; hora_fim: string | null }[]
): boolean {
  const d = new Date(dataStr + 'T12:00:00');
  for (const b of bloqueios) {
    if (!b.data_inicio || !b.data_fim || !b.hora_inicio || !b.hora_fim) continue;
    const start = new Date(b.data_inicio);
    const end = new Date(b.data_fim);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (d < start || d > end) continue;
    const bInicio = parseTime(b.hora_inicio);
    const bFim = parseTime(b.hora_fim);
    if (bInicio >= bFim) continue;
    if (slotInicio < bFim && slotFim > bInicio) return true;
  }
  return false;
}

export async function getDiasDisponiveis(
  usuarioId: string,
  from: string,
  to: string
): Promise<string[]> {
  const config = await prisma.configuracaoAgenda.findUnique({
    where: { usuario_id: usuarioId }
  });
  if (!config) return [];

  const fromDate = new Date(from + 'T12:00:00');
  const toDate = new Date(to + 'T12:00:00');
  const { minDataStr, maxDataStr } = getMinMaxDataStr(config.antecedencia_minima_dias, config.limite_maximo_dias);

  const bloqueiosRec = await prisma.bloqueio.findMany({
    where: { usuario_id: usuarioId, tipo: 'RECORRENTE' }
  });
  const bloqueiosInt = await prisma.bloqueio.findMany({
    where: { usuario_id: usuarioId, tipo: 'INTERVALO_DATA' }
  });

  const dias: string[] = [];
  let d = new Date(fromDate);
  while (d <= toDate) {
    const dataStr = toLocalDateString(d);
    if (dataStr < minDataStr || dataStr > maxDataStr) {
      d.setDate(d.getDate() + 1);
      continue;
    }
    const slots = await getHorariosDisponiveis(usuarioId, dataStr);
    if (slots.length > 0) dias.push(dataStr);
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

async function getJanelaDia(usuarioId: string, diaSemana: number): Promise<{ inicioMin: number; fimMin: number } | null> {
  const disp = await prisma.disponibilidadeSemanal.findUnique({
    where: { usuario_id_dia_semana: { usuario_id: usuarioId, dia_semana: diaSemana } }
  });
  if (disp && disp.ativo) {
    const inicioMin = parseTime(disp.hora_inicio);
    const fimMin = parseTime(disp.hora_fim);
    if (!isNaN(inicioMin) && !isNaN(fimMin) && inicioMin < fimMin) return { inicioMin, fimMin };
  }
  const config = await prisma.configuracaoAgenda.findUnique({
    where: { usuario_id: usuarioId }
  });
  if (!config) return null;
  const inicioMin = parseTime(config.hora_inicio_funcionamento);
  const fimMin = parseTime(config.hora_fim_funcionamento);
  if (isNaN(inicioMin) || isNaN(fimMin) || inicioMin >= fimMin) return null;
  return { inicioMin, fimMin };
}

export async function getHorariosDisponiveis(
  usuarioId: string,
  data: string
): Promise<Array<{ hora_inicio: string; hora_fim: string }>> {
  const config = await prisma.configuracaoAgenda.findUnique({
    where: { usuario_id: usuarioId }
  });
  if (!config) return [];

  const { minDataStr, maxDataStr } = getMinMaxDataStr(config.antecedencia_minima_dias, config.limite_maximo_dias);
  if (data < minDataStr || data > maxDataStr) return [];

  const dataDate = new Date(data + 'T12:00:00');
  const diaSemana = getDayOfWeek(dataDate);
  const janela = await getJanelaDia(usuarioId, diaSemana);
  if (!janela) return [];

  const { inicioMin, fimMin } = janela;

  const duracao = config.duracao_padrao_minutos;
  const buffer = config.buffer_minutos;
  const rawSlots = generateRawSlots(inicioMin, fimMin, duracao, buffer);

  const bloqueiosRec = await prisma.bloqueio.findMany({
    where: { usuario_id: usuarioId, tipo: 'RECORRENTE' }
  });
  const bloqueiosInt = await prisma.bloqueio.findMany({
    where: { usuario_id: usuarioId, tipo: 'INTERVALO_DATA' }
  });

  if (dateInIntervaloDiaInteiro(data, bloqueiosInt)) return [];

  const agendamentos = await prisma.agendamento.findMany({
    where: {
      usuario_id: usuarioId,
      data: new Date(data),
      status: { in: ['PENDENTE', 'CONFIRMADO'] }
    }
  });

  const ocupados = new Set<number>();
  for (const a of agendamentos) {
    ocupados.add(parseTime(a.hora_inicio));
  }

  const result: Array<{ hora_inicio: string; hora_fim: string }> = [];
  for (const slot of rawSlots) {
    if (ocupados.has(slot.inicio)) continue;
    if (slotCollidesRecorrente(slot.inicio, slot.fim, diaSemana, bloqueiosRec)) continue;
    if (slotCollidesIntervalo(data, slot.inicio, slot.fim, bloqueiosInt)) continue;
    result.push({
      hora_inicio: formatTime(slot.inicio),
      hora_fim: formatTime(slot.fim)
    });
  }
  return result;
}

/** Retorna a quantidade total de slots do dia (antes de filtrar ocupados/bloqueios). Para cálculo de taxa de ocupação. */
export async function getTotalSlotsNoDia(usuarioId: string, data: string): Promise<number> {
  const config = await prisma.configuracaoAgenda.findUnique({
    where: { usuario_id: usuarioId }
  });
  if (!config) return 0;
  const { minDataStr, maxDataStr } = getMinMaxDataStr(config.antecedencia_minima_dias, config.limite_maximo_dias);
  if (data < minDataStr || data > maxDataStr) return 0;
  const dataDate = new Date(data + 'T12:00:00');
  const diaSemana = getDayOfWeek(dataDate);
  const janela = await getJanelaDia(usuarioId, diaSemana);
  if (!janela) return 0;
  const { inicioMin, fimMin } = janela;
  const duracao = config.duracao_padrao_minutos;
  const buffer = config.buffer_minutos;
  const rawSlots = generateRawSlots(inicioMin, fimMin, duracao, buffer);
  const bloqueiosRec = await prisma.bloqueio.findMany({
    where: { usuario_id: usuarioId, tipo: 'RECORRENTE' }
  });
  const bloqueiosInt = await prisma.bloqueio.findMany({
    where: { usuario_id: usuarioId, tipo: 'INTERVALO_DATA' }
  });
  if (dateInIntervaloDiaInteiro(data, bloqueiosInt)) return 0;
  let count = 0;
  for (const slot of rawSlots) {
    if (slotCollidesRecorrente(slot.inicio, slot.fim, diaSemana, bloqueiosRec)) continue;
    if (slotCollidesIntervalo(data, slot.inicio, slot.fim, bloqueiosInt)) continue;
    count++;
  }
  return count;
}

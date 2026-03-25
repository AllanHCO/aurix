import { Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { getHorariosDisponiveis } from '../services/availability.service';
import { getRetencaoThresholds } from '../services/companySettings.service';
import { getCache, setCache } from '../services/cache.service';

const prisma = new PrismaClient();

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function inicioFimMesAtual(): { inicio: Date; fim: Date } {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { inicio, fim };
}

function inicioFimMesAnterior(): { inicio: Date; fim: Date } {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const fim = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { inicio, fim };
}

export type PeriodoSummary = 'semana' | 'mes' | 'trimestre' | 'ultimos_7_dias' | 'ultimos_30_dias' | 'ultimos_90_dias';

type PeriodoDashboard = 'este_mes' | 'ultimos_3_meses';

function getPeriodoRange(periodo: PeriodoDashboard): { inicio: Date; fim: Date } {
  const now = new Date();
  const fim = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (periodo === 'este_mes') {
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { inicio, fim };
  }
  const inicio = new Date(now);
  inicio.setMonth(inicio.getMonth() - 3);
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim };
}

/** Retorna início e fim do período atual e do período anterior para comparação. */
function getRangesPeriodo(periodo: PeriodoSummary): { inicio: Date; fim: Date; inicioAnt: Date; fimAnt: Date } {
  const now = new Date();
  const fim = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let inicio: Date;
  let inicioAnt: Date;
  let fimAnt: Date;

  if (periodo === 'ultimos_7_dias') {
    inicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    fimAnt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 23, 59, 59, 999);
    inicioAnt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13, 0, 0, 0, 0);
  } else if (periodo === 'ultimos_30_dias') {
    inicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
    fimAnt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 23, 59, 59, 999);
    inicioAnt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59, 0, 0, 0, 0);
  } else if (periodo === 'ultimos_90_dias') {
    inicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89, 0, 0, 0, 0);
    fimAnt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90, 23, 59, 59, 999);
    inicioAnt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 179, 0, 0, 0, 0);
  } else if (periodo === 'semana') {
    const dia = now.getDay();
    const diff = dia === 0 ? 6 : dia - 1;
    inicio = new Date(now);
    inicio.setDate(now.getDate() - diff);
    inicio.setHours(0, 0, 0, 0);
    fimAnt = new Date(inicio);
    fimAnt.setDate(fimAnt.getDate() - 1);
    fimAnt.setHours(23, 59, 59, 999);
    inicioAnt = new Date(fimAnt);
    inicioAnt.setDate(inicioAnt.getDate() - 6);
    inicioAnt.setHours(0, 0, 0, 0);
  } else if (periodo === 'trimestre') {
    const mes = now.getMonth();
    const trimestreInicio = mes - (mes % 3);
    inicio = new Date(now.getFullYear(), trimestreInicio, 1, 0, 0, 0, 0);
    fim.setFullYear(now.getFullYear());
    fim.setMonth(trimestreInicio + 3, 0);
    fim.setHours(23, 59, 59, 999);
    fimAnt = new Date(now.getFullYear(), trimestreInicio, 0, 23, 59, 59, 999);
    inicioAnt = new Date(now.getFullYear(), trimestreInicio - 3, 1, 0, 0, 0, 0);
  } else {
    // mês
    inicio = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    fimAnt = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    inicioAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  }

  return { inicio, fim, inicioAnt, fimAnt };
}

/** Período anterior com a mesma duração, terminando no dia anterior ao início do período atual. */
function periodoAnteriorMesmoTamanho(inicio: Date, fim: Date): { inicio: Date; fim: Date } {
  const dias = Math.round((fim.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const fimAnt = new Date(inicio);
  fimAnt.setDate(fimAnt.getDate() - 1);
  fimAnt.setHours(23, 59, 59, 999);
  const inicioAnt = new Date(fimAnt);
  inicioAnt.setDate(inicioAnt.getDate() - dias + 1);
  inicioAnt.setHours(0, 0, 0, 0);
  return { inicio: inicioAnt, fim: fimAnt };
}

/** Valida e parseia dataInicial/dataFinal; retorna null se inválido ou ausente.
 * A data final é tratada como inclusiva: adiciona-se 1 dia e usa-se como limite superior exclusivo (lt),
 * para que o dia selecionado seja totalmente incluído mesmo com fuso horário. */
function parsePeriodoCustom(dataInicial: unknown, dataFinal: unknown): { inicio: Date; fim: Date } | null {
  if (!dataInicial || !dataFinal || typeof dataInicial !== 'string' || typeof dataFinal !== 'string') return null;
  const inicio = new Date((dataInicial as string).trim());
  const fim = new Date((dataFinal as string).trim());
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return null;
  inicio.setHours(0, 0, 0, 0);
  fim.setDate(fim.getDate() + 1);
  fim.setHours(0, 0, 0, 0);
  if (fim <= inicio) return null;
  return { inicio, fim };
}

export const getDashboard = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const periodo = ((req.query.periodo as PeriodoDashboard) || 'este_mes') as PeriodoDashboard;
  const validPeriodos: PeriodoDashboard[] = ['este_mes', 'ultimos_3_meses'];
  const periodoSafe = validPeriodos.includes(periodo) ? periodo : 'este_mes';

  const { inicio, fim } = getPeriodoRange(periodoSafe);

  // Faturamento do período: apenas vendas (tipo=sale) com status PAGO; orçamentos não entram
  const faturamentoResult = await prisma.venda.aggregate({
    where: {
      usuario_id: userId,
      tipo: 'sale',
      status: 'PAGO',
      createdAt: { gte: inicio, lte: fim }
    },
    _sum: { total: true }
  });
  const faturamento = Number(faturamentoResult._sum.total ?? 0);

  // Total de vendas no período (count) — apenas tipo sale; orçamentos não contam
  const totalVendas = await prisma.venda.count({
    where: {
      usuario_id: userId,
      tipo: 'sale',
      createdAt: { gte: inicio, lte: fim }
    }
  });

  // Produtos com estoque baixo (estoque_atual <= estoque_minimo)
  const produtosEstoqueBaixo = await prisma.$queryRaw<
    Array<{ id: string; nome: string; estoque_atual: number; estoque_minimo: number }>
  >`
    SELECT id, nome, estoque_atual, estoque_minimo
    FROM produtos
    WHERE usuario_id = ${userId}
      AND estoque_atual <= estoque_minimo
  `;

  // Últimas 5 vendas
  const ultimasVendas = await prisma.venda.findMany({
    where: {
      usuario_id: userId
    },
    take: 5,
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      cliente: {
        select: {
          nome: true
        }
      },
      itens: {
        include: {
          produto: {
            select: {
              nome: true
            }
          }
        }
      }
    }
  });

  res.json({
    periodo: periodoSafe,
    faturamento,
    totalVendas,
    produtosEstoqueBaixo,
    ultimasVendas
  });
};

const CACHE_TTL_MS = 60_000; // 60s
const LIMIT_PRODUTOS_ESTOQUE_BAIXO = 3;
const LIMIT_PROXIMOS_AGENDAMENTOS = 3;
const LIMIT_ATIVIDADES_RECENTES = 8;

export type PeriodoSummaryOuCustom = PeriodoSummary | 'custom';

/** GET /dashboard/summary — painel estratégico. Aceita periodo (fixo) ou dataInicial+dataFinal (período livre). Opcional: business_area_id para filtrar por área. */
export const getDashboardSummary = async (req: AuthRequest, res: Response) => {
  const totalStart = Date.now();
  const userId = req.userId!;
  const businessAreaId = typeof req.query.business_area_id === 'string' && req.query.business_area_id.trim()
    ? req.query.business_area_id.trim()
    : null;
  const areaWhere = businessAreaId ? { business_area_id: businessAreaId } : {};
  const produtoWhere = businessAreaId ? { business_area_id: businessAreaId } : {};

  const periodo = (req.query.periodo as PeriodoSummary) || 'ultimos_30_dias';
  const periodosValidos: PeriodoSummary[] = ['semana', 'mes', 'trimestre', 'ultimos_7_dias', 'ultimos_30_dias', 'ultimos_90_dias'];

  let inicio: Date;
  let fim: Date;
  let inicioAnt: Date;
  let fimAnt: Date;
  let periodoSafe: PeriodoSummaryOuCustom;
  let cacheKey: string;
  const dataInicialQ = req.query.dataInicial;
  const dataFinalQ = req.query.dataFinal;

  if (typeof dataInicialQ === 'string' && typeof dataFinalQ === 'string' && dataInicialQ.trim() && dataFinalQ.trim()) {
    const parsed = parsePeriodoCustom(dataInicialQ, dataFinalQ);
    if (parsed) {
      inicio = parsed.inicio;
      fim = parsed.fim;
      const ant = periodoAnteriorMesmoTamanho(inicio, fim);
      inicioAnt = ant.inicio;
      fimAnt = ant.fim;
      periodoSafe = 'custom';
      cacheKey = `dashboard:summary:${userId}:${dataInicialQ}_${dataFinalQ}${businessAreaId ? `:${businessAreaId}` : ''}`;
    } else {
      periodoSafe = periodosValidos.includes(periodo) ? periodo : 'ultimos_30_dias';
      const ranges = getRangesPeriodo(periodoSafe as PeriodoSummary);
      inicio = ranges.inicio;
      fim = ranges.fim;
      inicioAnt = ranges.inicioAnt;
      fimAnt = ranges.fimAnt;
      cacheKey = `dashboard:summary:${userId}:${periodoSafe}${businessAreaId ? `:${businessAreaId}` : ''}`;
    }
  } else {
    periodoSafe = periodosValidos.includes(periodo) ? periodo : 'ultimos_30_dias';
    const ranges = getRangesPeriodo(periodoSafe as PeriodoSummary);
    inicio = ranges.inicio;
    fim = ranges.fim;
    inicioAnt = ranges.inicioAnt;
    fimAnt = ranges.fimAnt;
    cacheKey = `dashboard:summary:${userId}:${periodoSafe}${businessAreaId ? `:${businessAreaId}` : ''}`;
  }

  const cached = getCache<any>(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  /** Período custom usa data final +1 dia como limite exclusivo (lt); presets usam lte. */
  const createdAtRange =
    periodoSafe === 'custom'
      ? ({ gte: inicio, lt: fim } as { gte: Date; lt: Date })
      : ({ gte: inicio, lte: fim } as { gte: Date; lte: Date });

  const hoje = new Date();

  // Batch 1: config + módulos (não dependem do período)
  const t1 = Date.now();
  const [settings, configAgenda, totalProdutos, totalVendasCount, retencaoThresholds] = await Promise.all([
    prisma.companySettings.findUnique({ where: { usuario_id: userId }, select: { meta_faturamento_mes: true } }).catch(() => null),
    prisma.configuracaoAgenda.findUnique({ where: { usuario_id: userId } }),
    prisma.produto.count({ where: produtoWhere }),
    prisma.venda.count({ where: { usuario_id: userId, tipo: 'sale', ...areaWhere } }),
    getRetencaoThresholds(userId)
  ]);
  const metaFaturamentoMes = settings?.meta_faturamento_mes != null ? Number(settings.meta_faturamento_mes) : null;
  const modulos = {
    agendamento: !!configAgenda,
    produtos: totalProdutos > 0,
    vendas: totalVendasCount > 0
  };
  const { dias_atencao, dias_inativo } = retencaoThresholds;
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[dashboard/summary] batch1 (config): ${Date.now() - t1}ms`);
  }

  // Batch 2: todas as métricas em paralelo (retenção + resultado + operacional + gráfico)
  const t2 = Date.now();
  const [
    ultimaVendaPorCliente,
    faturamentoAgg,
    faturamentoAntResult,
    clientesUnicosPeriodoAgg,
    estoqueBaixoRows,
    produtosEstoqueBaixo,
    vendasPendentesAgg,
    vendasPendentesCount,
    clientesPeriodoAnteriorAgg,
    vendasAtual,
    vendasAnterior,
    ultimasVendas,
    proximosAgendamentos,
    agendamentosRecentes
  ] = await Promise.all([
    prisma.venda.groupBy({
      by: ['cliente_id'],
      where: { usuario_id: userId, tipo: 'sale', status: 'PAGO', ...areaWhere },
      _max: { createdAt: true }
    }),
    prisma.venda.aggregate({
      where: { usuario_id: userId, tipo: 'sale', status: 'PAGO', createdAt: createdAtRange, ...areaWhere },
      _sum: { total: true },
      _count: { _all: true }
    }),
    prisma.venda.aggregate({
      where: { usuario_id: userId, tipo: 'sale', status: 'PAGO', createdAt: { gte: inicioAnt, lte: fimAnt }, ...areaWhere },
      _sum: { total: true }
    }),
    prisma.venda.groupBy({
      by: ['cliente_id'],
      where: { usuario_id: userId, tipo: 'sale', status: 'PAGO', createdAt: createdAtRange, ...areaWhere }
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT COUNT(*)::bigint AS count FROM produtos WHERE usuario_id = ${userId} AND estoque_atual <= estoque_minimo ${businessAreaId ? Prisma.sql`AND business_area_id = ${businessAreaId}` : Prisma.empty}`
    ),
    prisma.$queryRaw<Array<{ id: string; nome: string; estoque_atual: number; estoque_minimo: number }>>(
      Prisma.sql`SELECT id, nome, estoque_atual, estoque_minimo FROM produtos WHERE usuario_id = ${userId} AND estoque_atual <= estoque_minimo ${businessAreaId ? Prisma.sql`AND business_area_id = ${businessAreaId}` : Prisma.empty} LIMIT ${LIMIT_PRODUTOS_ESTOQUE_BAIXO}`
    ),
    prisma.venda.aggregate({
      where: { usuario_id: userId, tipo: 'sale', status: 'PENDENTE', createdAt: createdAtRange, ...areaWhere },
      _sum: { total: true }
    }),
    prisma.venda.count({
      where: { usuario_id: userId, tipo: 'sale', status: 'PENDENTE', createdAt: createdAtRange, ...areaWhere }
    }),
    prisma.venda.groupBy({
      by: ['cliente_id'],
      where: { usuario_id: userId, tipo: 'sale', status: 'PAGO', createdAt: { gte: inicioAnt, lte: fimAnt }, ...areaWhere }
    }),
    prisma.venda.findMany({
      where: { usuario_id: userId, tipo: 'sale', status: 'PAGO', createdAt: createdAtRange, ...areaWhere },
      select: { total: true, createdAt: true }
    }),
    prisma.venda.findMany({
      where: { usuario_id: userId, tipo: 'sale', status: 'PAGO', createdAt: { gte: inicioAnt, lte: fimAnt }, ...areaWhere },
      select: { total: true, createdAt: true }
    }),
    prisma.venda.findMany({
      where: { usuario_id: userId, ...areaWhere },
      orderBy: { createdAt: 'desc' },
      take: LIMIT_ATIVIDADES_RECENTES,
      select: { id: true, total: true, createdAt: true, cliente: { select: { nome: true } } }
    }),
    modulos.agendamento
      ? prisma.agendamento.findMany({
          where: {
            usuario_id: userId,
            data: { gte: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) },
            status: { in: ['PENDENTE', 'CONFIRMADO'] },
            ...areaWhere
          },
          orderBy: [{ data: 'asc' }, { hora_inicio: 'asc' }],
          take: LIMIT_PROXIMOS_AGENDAMENTOS,
          select: { id: true, nome_cliente: true, data: true, hora_inicio: true, status: true }
        })
      : Promise.resolve([]),
    modulos.agendamento
      ? prisma.agendamento.findMany({
          where: { usuario_id: userId, data: { gte: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) }, ...areaWhere },
          orderBy: [{ data: 'asc' }, { hora_inicio: 'asc' }],
          take: 5,
          select: { id: true, nome_cliente: true, data: true, hora_inicio: true }
        })
      : Promise.resolve([])
  ]);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[dashboard/summary] batch2 (métricas): ${Date.now() - t2}ms`);
  }

  let clientesAtencao = 0;
  let clientesInativo = 0;
  for (const row of ultimaVendaPorCliente) {
    const ultima = row._max.createdAt;
    if (!ultima) continue;
    const diffMs = hoje.getTime() - ultima.getTime();
    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (dias < dias_atencao) continue;
    if (dias < dias_inativo) clientesAtencao++;
    else clientesInativo++;
  }

  const faturamento = Number(faturamentoAgg._sum.total ?? 0);
  const faturamentoAnterior = Number(faturamentoAntResult._sum.total ?? 0);
  const qtdVendasPagas = faturamentoAgg._count._all ?? 0;
  const ticketMedio = qtdVendasPagas > 0 ? faturamento / qtdVendasPagas : 0;
  let variacaoPercentual: number | null = null;
  if (faturamentoAnterior > 0) {
    variacaoPercentual = ((faturamento - faturamentoAnterior) / faturamentoAnterior) * 100;
  } else if (faturamento > 0) {
    variacaoPercentual = 100;
  }

  const clientesQueCompraramNoPeriodo = clientesUnicosPeriodoAgg.length;
  const receitaMediaPorCliente = clientesQueCompraramNoPeriodo > 0 ? faturamento / clientesQueCompraramNoPeriodo : 0;
  const estimativaReceitaRisco = Math.round(receitaMediaPorCliente * clientesInativo);

  const vendasPendentesTotal = Number(vendasPendentesAgg._sum.total ?? 0);
  const clientesQueCompraramNoAnterior = new Set(
    clientesPeriodoAnteriorAgg.map((v) => v.cliente_id),
  );
  const clientesQueCompraramNoAtual = new Set(
    clientesUnicosPeriodoAgg.map((v) => v.cliente_id),
  );
  const clientesNaoVoltaramIds = [...clientesQueCompraramNoAnterior].filter((id) => !clientesQueCompraramNoAtual.has(id));
  const receitaEmRiscoNaoVoltaram = Math.round(receitaMediaPorCliente * clientesNaoVoltaramIds.length);

  // Clientes recuperados: NÃO compraram no período anterior e compraram (PAGO) no atual
  const clientesRecuperadosIds = [...clientesQueCompraramNoAtual].filter((id) => !clientesQueCompraramNoAnterior.has(id));
  const clientesEmRiscoNoPeriodoAnterior = clientesNaoVoltaramIds.length;
  let receitaRecuperada = 0;
  if (clientesRecuperadosIds.length > 0) {
    const t3 = Date.now();
    const aggRecuperada = await prisma.venda.aggregate({
      where: {
        usuario_id: userId,
        status: 'PAGO',
        createdAt: createdAtRange,
        cliente_id: { in: clientesRecuperadosIds },
        ...areaWhere
      },
      _sum: { total: true }
    });
    receitaRecuperada = Number(aggRecuperada._sum.total ?? 0);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[dashboard/summary] batch3 (aggRecuperada): ${Date.now() - t3}ms`);
    }
  }
  const taxaRecuperacao =
    clientesEmRiscoNoPeriodoAnterior > 0
      ? Math.round((clientesRecuperadosIds.length / clientesEmRiscoNoPeriodoAnterior) * 100)
      : (clientesRecuperadosIds.length > 0 ? 100 : 0);

  const estoqueBaixoCount = Number(estoqueBaixoRows[0]?.count ?? 0);
  const produtosEstoqueBaixoList = ((produtosEstoqueBaixo || []) as Array<{
    id: string;
    nome: string;
    estoque_atual: number;
    estoque_minimo: number;
  }>).slice(0, LIMIT_PRODUTOS_ESTOQUE_BAIXO);

  const dayMs = 24 * 60 * 60 * 1000;
  const rangeEndForBucket = periodoSafe === 'custom' ? fim : null;
  const rangeEndAntForBucket = periodoSafe === 'custom' ? fimAnt : null;

  const bucketize = (
    vendas: { total: unknown; createdAt: Date }[],
    period: PeriodoSummaryOuCustom,
    rangeStart: Date,
    rangeEnd: Date | null = null
  ) => {
    let n: number;
    const rangeSpanMs = rangeEnd ? rangeEnd.getTime() - rangeStart.getTime() : 0;
    const rangeDays = rangeEnd
      ? period === 'custom'
        ? Math.round(rangeSpanMs / dayMs)
        : Math.round(rangeSpanMs / dayMs) + 1
      : 0;

    if (period === 'custom' && rangeEnd) {
      if (rangeDays <= 7) n = 7;
      else if (rangeDays <= 35) n = 5;
      else if (rangeDays <= 90) n = 12;
      else n = 12;
    } else if (period === 'ultimos_7_dias') n = 7;
    else if (period === 'ultimos_30_dias') n = 5;
    else if (period === 'ultimos_90_dias') n = 12;
    else if (period === 'semana') n = 7;
    else if (period === 'mes') n = 5;
    else n = 3;

    const sums = new Array(n).fill(0);
    const counts = new Array(n).fill(0);
    const bucketMs = period === 'custom' && rangeEnd && rangeDays > 0 ? (rangeSpanMs + 1) / n : 0;

    for (const v of vendas) {
      const d = v.createdAt;
      const val = Number(v.total ?? 0);
      let idx: number;
      if (period === 'custom' && rangeEnd) {
        idx = Math.floor((d.getTime() - rangeStart.getTime()) / (bucketMs || 1));
        if (idx < 0) idx = 0;
        if (idx > n - 1) idx = n - 1;
      } else if (period === 'ultimos_7_dias') {
        idx = Math.floor((d.getTime() - rangeStart.getTime()) / dayMs);
        if (idx < 0) idx = 0;
        if (idx > 6) idx = 6;
      } else if (period === 'ultimos_30_dias') {
        idx = Math.floor((d.getTime() - rangeStart.getTime()) / (7 * dayMs));
        if (idx < 0) idx = 0;
        if (idx > 4) idx = 4;
      } else if (period === 'ultimos_90_dias') {
        idx = Math.floor((d.getTime() - rangeStart.getTime()) / (7 * dayMs));
        if (idx < 0) idx = 0;
        if (idx > 11) idx = 11;
      } else if (period === 'semana') {
        idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
      } else if (period === 'mes') {
        idx = Math.min(4, Math.floor((d.getDate() - 1) / 7));
        if (d.getMonth() !== rangeStart.getMonth()) idx = 4;
      } else {
        idx = d.getMonth() - rangeStart.getMonth();
        if (idx < 0 || idx > 2) idx = 0;
      }
      sums[idx] += val;
      counts[idx] += 1;
    }
    const ticket = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
    return { sums, ticket };
  };
  const bAtual = bucketize(vendasAtual, periodoSafe, inicio, rangeEndForBucket);
  const bAnterior = bucketize(vendasAnterior, periodoSafe, inicioAnt, rangeEndAntForBucket);

  const buildChartLabels = (): string[] => {
    if (periodoSafe === 'custom') {
      const dias = Math.round((fim.getTime() - inicio.getTime()) / dayMs);
      let n: number;
      if (dias <= 7) n = 7;
      else if (dias <= 35) n = 5;
      else if (dias <= 90) n = 12;
      else n = 12;
      return Array.from({ length: n }, (_, i) => {
        const d = new Date(inicio);
        const step = dias <= 7 ? 1 : dias <= 35 ? Math.ceil(dias / 5) : Math.ceil(dias / 12);
        d.setDate(d.getDate() + i * step);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      });
    }
    if (periodoSafe === 'ultimos_7_dias') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(inicio);
        d.setDate(d.getDate() + i);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      });
    }
    if (periodoSafe === 'ultimos_30_dias') return ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5'];
    if (periodoSafe === 'ultimos_90_dias') return Array.from({ length: 12 }, (_, i) => `Sem ${i + 1}`);
    if (periodoSafe === 'semana') return ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    if (periodoSafe === 'mes') return ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5'];
    return ['Mês 1', 'Mês 2', 'Mês 3'];
  };
  const chartLabels = buildChartLabels();
  const grafico = {
    labels: chartLabels,
    receitaAtual: bAtual.sums,
    receitaAnterior: bAnterior.sums,
    ticketMedioAtual: bAtual.ticket,
    ticketMedioAnterior: bAnterior.ticket
  };

  // Atividades recentes (já vêm do batch2: ultimasVendas + agendamentosRecentes)
  const atividadesRecentes: Array<{ tipo: string; id: string; nome: string; horario: string; valor?: number }> = [];
  for (const v of ultimasVendas) {
    atividadesRecentes.push({
      tipo: 'venda',
      id: v.id,
      nome: (v.cliente as { nome?: string } | null)?.nome ?? 'Cliente',
      horario: v.createdAt.toISOString(),
      valor: Number(v.total ?? 0)
    });
  }
  for (const a of agendamentosRecentes) {
    atividadesRecentes.push({
      tipo: 'agendamento',
      id: a.id,
      nome: a.nome_cliente,
      horario: new Date(a.data.getFullYear(), a.data.getMonth(), a.data.getDate()).toISOString().slice(0, 10) + 'T' + (a.hora_inicio ?? '00:00') + ':00'
    });
  }
  atividadesRecentes.sort((a, b) => new Date(b.horario).getTime() - new Date(a.horario).getTime());
  const atividadesRecentesSlice = atividadesRecentes.slice(0, LIMIT_ATIVIDADES_RECENTES);

  // Resultado por área (só quando visão consolidada, para card de comparação)
  let resultadoPorArea: Array<{ areaId: string; areaName: string; color: string | null; faturamento: number }> = [];
  if (!businessAreaId) {
    const porArea = await prisma.venda.groupBy({
      by: ['business_area_id'],
      where: {
        usuario_id: userId,
        tipo: 'sale',
        status: 'PAGO',
        createdAt: createdAtRange
      },
      _sum: { total: true }
    });
    const areaIds = porArea.map((r) => r.business_area_id).filter((id): id is string => id != null);
    if (areaIds.length > 0) {
      const areas = await prisma.businessArea.findMany({
        where: { id: { in: areaIds } },
        select: { id: true, name: true, color: true }
      });
      const areaMap = new Map(areas.map((a) => [a.id, a]));
      resultadoPorArea = porArea
        .filter((r) => r.business_area_id != null)
        .map((r) => ({
          areaId: r.business_area_id!,
          areaName: areaMap.get(r.business_area_id!)?.name ?? 'Sem área',
          color: areaMap.get(r.business_area_id!)?.color ?? null,
          faturamento: Number(r._sum.total ?? 0)
        }))
        .sort((a, b) => b.faturamento - a.faturamento);
    }
  }

  const payload = {
    periodo: periodoSafe,
    ...(periodoSafe === 'custom' && { dataInicio: String(dataInicialQ ?? '').trim(), dataFim: String(dataFinalQ ?? '').trim() }),
    modulos,
    metaFaturamentoMes,
    resultado: {
      faturamento,
      faturamentoAnterior,
      variacaoPercentual,
      ticketMedio,
      qtdVendasPagas
    },
    retencao: {
      clientesAtencao,
      clientesInativo,
      receitaMediaPorCliente,
      estimativaReceitaRisco,
      clientesRecuperados: clientesRecuperadosIds.length,
      receitaRecuperada,
      taxaRecuperacao
    },
    receitaEmRisco: {
      vendasPendentesTotal,
      vendasPendentesCount,
      clientesNaoVoltaram: clientesNaoVoltaramIds.length,
      receitaEmRiscoNaoVoltaram
    },
    operacional: {
      qtdVendasPeriodo: qtdVendasPagas,
      estoqueBaixoCount,
      produtosEstoqueBaixo: produtosEstoqueBaixoList.map((p) => ({
        id: p.id,
        nome: p.nome,
        estoque_atual: p.estoque_atual,
        estoque_minimo: p.estoque_minimo
      })),
      proximosAgendamentos: proximosAgendamentos.map((a) => ({
        id: a.id,
        nome_cliente: a.nome_cliente,
        data: a.data.toISOString().slice(0, 10),
        hora_inicio: a.hora_inicio,
        status: a.status
      }))
    },
    grafico: grafico,
    atividadesRecentes: atividadesRecentesSlice,
    ...(resultadoPorArea.length > 0 && { resultadoPorArea })
  };

  setCache(cacheKey, payload, CACHE_TTL_MS);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[dashboard/summary] total: ${Date.now() - totalStart}ms`);
  }
  res.json(payload);
};

const SEARCH_LIMIT = 5;

/** GET /dashboard/search?q= — busca global: clientes, pedidos/vendas, agendamentos (nome, telefone, código). */
export const getDashboardSearch = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const q = ((req.query.q as string) ?? '').trim();
  if (q.length < 2) {
    return res.json({ clientes: [], vendas: [], agendamentos: [] });
  }
  const term = q.slice(0, 100);
  const contains = { contains: term, mode: 'insensitive' as const };

  const [clientes, vendas, agendamentos] = await Promise.all([
    prisma.cliente.findMany({
      where: {
        usuario_id: userId,
        OR: [{ nome: contains }, { telefone: { contains: term } }]
      },
      take: SEARCH_LIMIT,
      select: { id: true, nome: true, telefone: true }
    }),
    prisma.venda.findMany({
      where: {
        usuario_id: userId,
        OR: [
          { sale_code: contains },
          { os_code: contains },
          { cliente: { nome: contains } },
          { cliente: { telefone: { contains: term } } }
        ]
      },
      take: SEARCH_LIMIT,
      select: { id: true, sale_code: true, os_code: true, tipo: true, total: true, createdAt: true, cliente: { select: { nome: true } } }
    }),
    prisma.agendamento.findMany({
      where: {
        usuario_id: userId,
        OR: [{ nome_cliente: contains }, { telefone_cliente: { contains: term } }]
      },
      take: SEARCH_LIMIT,
      select: { id: true, nome_cliente: true, data: true, hora_inicio: true, status: true }
    })
  ]);

  res.json({
    clientes: clientes.map((c) => ({ id: c.id, tipo: 'cliente' as const, label: c.nome, sublabel: c.telefone ?? undefined, rota: `/clientes/${c.id}` })),
    vendas: vendas.map((v) => ({
      id: v.id,
      tipo: 'venda' as const,
      label: (v.sale_code ?? v.os_code) || (v.cliente?.nome ?? 'Venda'),
      sublabel: v.cliente?.nome,
      rota: v.tipo === 'quote' ? `/orcamentos/${v.id}` : `/vendas/${v.id}`
    })),
    agendamentos: agendamentos.map((a) => ({
      id: a.id,
      tipo: 'agendamento' as const,
      label: a.nome_cliente,
      sublabel: a.data ? `${a.data.toISOString().slice(0, 10)} ${a.hora_inicio ?? ''}` : undefined,
      rota: `/agenda`
    }))
  });
};

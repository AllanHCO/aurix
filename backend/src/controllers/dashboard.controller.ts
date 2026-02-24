import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
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

export type PeriodoSummary = 'semana' | 'mes' | 'trimestre';

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

  if (periodo === 'semana') {
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

export const getDashboard = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const periodo = ((req.query.periodo as PeriodoDashboard) || 'este_mes') as PeriodoDashboard;
  const validPeriodos: PeriodoDashboard[] = ['este_mes', 'ultimos_3_meses'];
  const periodoSafe = validPeriodos.includes(periodo) ? periodo : 'este_mes';

  const { inicio, fim } = getPeriodoRange(periodoSafe);

  // Faturamento do período: SUM(total) onde status = PAGO e data no período (fonte: tabela vendas)
  const faturamentoResult = await prisma.venda.aggregate({
    where: {
      usuario_id: userId,
      status: 'PAGO',
      createdAt: { gte: inicio, lte: fim }
    },
    _sum: { total: true }
  });
  const faturamento = Number(faturamentoResult._sum.total ?? 0);

  // Total de vendas no período (count)
  const totalVendas = await prisma.venda.count({
    where: {
      usuario_id: userId,
      createdAt: { gte: inicio, lte: fim }
    }
  });

  // Produtos com estoque baixo (estoque_atual <= estoque_minimo)
  const produtosEstoqueBaixo = await prisma.$queryRaw<
    Array<{ id: string; nome: string; estoque_atual: number; estoque_minimo: number }>
  >`
    SELECT id, nome, estoque_atual, estoque_minimo
    FROM produtos
    WHERE estoque_atual <= estoque_minimo
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

/** GET /dashboard/summary — painel estratégico: financeiro, retenção, operacional. Query: periodo=semana|mes|trimestre (default: mes). */
export const getDashboardSummary = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const periodo = (req.query.periodo as PeriodoSummary) || 'mes';
  const periodoSafe: PeriodoSummary = ['semana', 'mes', 'trimestre'].includes(periodo) ? periodo : 'mes';

  const cacheKey = `dashboard:summary:${userId}:${periodoSafe}`;
  const cached = getCache<any>(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const { inicio, fim, inicioAnt, fimAnt } = getRangesPeriodo(periodoSafe);

  const settings = await prisma.companySettings.findUnique({
    where: { usuario_id: userId },
    select: { meta_faturamento_mes: true }
  }).catch(() => null);
  const metaFaturamentoMes = settings?.meta_faturamento_mes != null ? Number(settings.meta_faturamento_mes) : null;

  const [configAgenda, totalProdutos, totalVendasCount] = await Promise.all([
    prisma.configuracaoAgenda.findUnique({ where: { usuario_id: userId } }),
    prisma.produto.count(),
    prisma.venda.count({ where: { usuario_id: userId } })
  ]);
  const modulos = {
    agendamento: !!configAgenda,
    produtos: totalProdutos > 0,
    vendas: totalVendasCount > 0
  };

  const { dias_atencao, dias_inativo } = await getRetencaoThresholds(userId);
  const hoje = new Date();
  let clientesAtencao = 0;
  let clientesInativo = 0;
  // Última venda PAGA por cliente (somente clientes deste usuário)
  const ultimaVendaPorCliente = await prisma.venda.groupBy({
    by: ['cliente_id'],
    where: { usuario_id: userId, status: 'PAGO' },
    _max: { createdAt: true }
  });
  for (const row of ultimaVendaPorCliente) {
    const ultima = row._max.createdAt;
    if (!ultima) continue;
    const diffMs = hoje.getTime() - ultima.getTime();
    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (dias < dias_atencao) continue;
    if (dias < dias_inativo) clientesAtencao++;
    else clientesInativo++;
  }

  const [
    faturamentoAgg,
    faturamentoAntResult,
    clientesUnicosPeriodoAgg,
    estoqueBaixoRows,
    produtosEstoqueBaixo,
    proximosAgendamentos
  ] = await Promise.all([
    prisma.venda.aggregate({
      where: { usuario_id: userId, status: 'PAGO', createdAt: { gte: inicio, lte: fim } },
      _sum: { total: true },
      _count: { _all: true }
    }),
    prisma.venda.aggregate({
      where: { usuario_id: userId, status: 'PAGO', createdAt: { gte: inicioAnt, lte: fimAnt } },
      _sum: { total: true }
    }),
    prisma.venda.groupBy({
      by: ['cliente_id'],
      where: { usuario_id: userId, status: 'PAGO', createdAt: { gte: inicio, lte: fim } }
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM produtos WHERE estoque_atual <= estoque_minimo
    `,
    prisma.$queryRaw<Array<{ id: string; nome: string; estoque_atual: number; estoque_minimo: number }>>`
      SELECT id, nome, estoque_atual, estoque_minimo FROM produtos WHERE estoque_atual <= estoque_minimo LIMIT 10
    `,
    modulos.agendamento
      ? prisma.agendamento.findMany({
          where: {
            usuario_id: userId,
            data: { gte: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) },
            status: { in: ['PENDENTE', 'CONFIRMADO'] }
          },
          orderBy: [{ data: 'asc' }, { hora_inicio: 'asc' }],
          take: 5,
          select: { id: true, nome_cliente: true, data: true, hora_inicio: true, status: true }
        })
      : Promise.resolve([])
  ]);

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

  // Vendas pendentes no período (dinheiro travado)
  const [vendasPendentesAgg, vendasPendentesCount, clientesPeriodoAnteriorAgg] = await Promise.all([
    prisma.venda.aggregate({
      where: { usuario_id: userId, status: 'PENDENTE', createdAt: { gte: inicio, lte: fim } },
      _sum: { total: true }
    }),
    prisma.venda.count({
      where: { usuario_id: userId, status: 'PENDENTE', createdAt: { gte: inicio, lte: fim } }
    }),
    prisma.venda.groupBy({
      by: ['cliente_id'],
      where: { usuario_id: userId, status: 'PAGO', createdAt: { gte: inicioAnt, lte: fimAnt } }
    })
  ]);
  const vendasPendentesTotal = Number(vendasPendentesAgg._sum.total ?? 0);
  const clientesQueCompraramNoAnterior = new Set(
    clientesPeriodoAnteriorAgg.map((v) => v.cliente_id),
  );
  const clientesQueCompraramNoAtual = new Set(
    clientesUnicosPeriodoAgg.map((v) => v.cliente_id),
  );
  const clientesNaoVoltaramIds = [...clientesQueCompraramNoAnterior].filter((id) => !clientesQueCompraramNoAtual.has(id));
  const receitaEmRiscoNaoVoltaram = Math.round(receitaMediaPorCliente * clientesNaoVoltaramIds.length);

  const estoqueBaixoCount = Number(estoqueBaixoRows[0]?.count ?? 0);
  const produtosEstoqueBaixoList = ((produtosEstoqueBaixo || []) as Array<{
    id: string;
    nome: string;
    estoque_atual: number;
    estoque_minimo: number;
  }>).slice(0, 5);

  // Séries do gráfico: agregar vendas por bucket (dia da semana / semana do mês / mês do trimestre)
  const [vendasAtual, vendasAnterior] = await Promise.all([
    prisma.venda.findMany({
      where: { usuario_id: userId, status: 'PAGO', createdAt: { gte: inicio, lte: fim } },
      select: { total: true, createdAt: true }
    }),
    prisma.venda.findMany({
      where: { usuario_id: userId, status: 'PAGO', createdAt: { gte: inicioAnt, lte: fimAnt } },
      select: { total: true, createdAt: true }
    })
  ]);

  const bucketize = (vendas: { total: unknown; createdAt: Date }[], period: PeriodoSummary, rangeStart: Date) => {
    const n = period === 'semana' ? 7 : period === 'mes' ? 5 : 3;
    const sums = new Array(n).fill(0);
    const counts = new Array(n).fill(0);
    for (const v of vendas) {
      const d = v.createdAt;
      const val = Number(v.total ?? 0);
      let idx: number;
      if (period === 'semana') {
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
  const bAtual = bucketize(vendasAtual, periodoSafe, inicio);
  const bAnterior = bucketize(vendasAnterior, periodoSafe, inicioAnt);
  const chartLabels =
    periodoSafe === 'semana'
      ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
      : periodoSafe === 'mes'
        ? ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5']
        : ['Mês 1', 'Mês 2', 'Mês 3'];
  const grafico = {
    labels: chartLabels,
    receitaAtual: bAtual.sums,
    receitaAnterior: bAnterior.sums,
    ticketMedioAtual: bAtual.ticket,
    ticketMedioAnterior: bAnterior.ticket
  };

  // Atividades recentes: últimas vendas + próximos agendamentos, ordenados por data
  const ultimasVendas = await prisma.venda.findMany({
    where: { usuario_id: userId },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { id: true, total: true, createdAt: true, cliente: { select: { nome: true } } }
  });
  const atividadesRecentes: Array<{ tipo: string; id: string; nome: string; horario: string; valor?: number }> = [];
  for (const v of ultimasVendas) {
    atividadesRecentes.push({
      tipo: 'venda',
      id: v.id,
      nome: v.cliente?.nome ?? 'Cliente',
      horario: v.createdAt.toISOString(),
      valor: Number(v.total ?? 0)
    });
  }
  if (modulos.agendamento) {
    const agendamentosRecentes = await prisma.agendamento.findMany({
      where: { usuario_id: userId, data: { gte: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) } },
      orderBy: [{ data: 'asc' }, { hora_inicio: 'asc' }],
      take: 5,
      select: { id: true, nome_cliente: true, data: true, hora_inicio: true }
    });
    for (const a of agendamentosRecentes) {
      atividadesRecentes.push({
        tipo: 'agendamento',
        id: a.id,
        nome: a.nome_cliente,
        horario: new Date(a.data.getFullYear(), a.data.getMonth(), a.data.getDate()).toISOString().slice(0, 10) + 'T' + a.hora_inicio + ':00'
      });
    }
  }
  atividadesRecentes.sort((a, b) => new Date(b.horario).getTime() - new Date(a.horario).getTime());
  const atividadesRecentesSlice = atividadesRecentes.slice(0, 8);

  const payload = {
    periodo: periodoSafe,
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
      estimativaReceitaRisco
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
    atividadesRecentes: atividadesRecentesSlice
  };

  // Cache curto (45s) por usuário + período
  setCache(cacheKey, payload, 45_000);

  res.json(payload);
};

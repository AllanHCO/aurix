import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrencyNoCents } from '../utils/format';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CACHE_TTL_MS = 60_000;
const DEBOUNCE_MS = 500;

type Periodo = 'semana' | 'mes' | 'trimestre';

interface DashboardSummary {
  periodo: Periodo;
  modulos: { agendamento: boolean; produtos: boolean; vendas: boolean };
  metaFaturamentoMes?: number | null;
  resultado: {
    faturamento: number;
    faturamentoAnterior: number;
    variacaoPercentual: number | null;
    ticketMedio: number;
    qtdVendasPagas: number;
  };
  retencao: {
    clientesAtencao: number;
    clientesInativo: number;
    receitaMediaPorCliente: number;
    estimativaReceitaRisco: number;
    clientesRecuperados?: number;
    receitaRecuperada?: number;
    taxaRecuperacao?: number;
  };
  receitaEmRisco?: {
    vendasPendentesTotal: number;
    vendasPendentesCount: number;
    clientesNaoVoltaram: number;
    receitaEmRiscoNaoVoltaram: number;
  };
  operacional: {
    qtdVendasPeriodo: number;
    estoqueBaixoCount: number;
    produtosEstoqueBaixo: Array<{ id: string; nome: string; estoque_atual: number; estoque_minimo: number }>;
    proximosAgendamentos: Array<{ id: string; nome_cliente: string; data: string; hora_inicio: string; status: string }>;
  };
  grafico?: {
    labels: string[];
    receitaAtual: number[];
    receitaAnterior: number[];
    ticketMedioAtual: number[];
    ticketMedioAnterior: number[];
  };
  atividadesRecentes?: Array<{ tipo: string; id: string; nome: string; horario: string; valor?: number }>;
}

const PERIODO_LABELS: Record<Periodo, string> = {
  semana: 'Semana',
  mes: 'Mês',
  trimestre: 'Trimestre'
};

/** Gráfico estilo Revenue Analytics: área preenchida, linha anterior pontilhada, dot no máximo, grid leve. */
function DesempenhoChart({
  labels,
  atual,
  anterior,
  valorTotal,
  variacao
}: {
  labels: string[];
  atual: number[];
  anterior: number[];
  valorTotal: number;
  variacao: number | null;
}) {
  const maxVal = Math.max(1, ...atual, ...anterior);
  const w = 100;
  const h = 24;
  const padL = 4;
  const padR = 4;
  const padT = 2;
  const padB = 4;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const toX = (i: number) => padL + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * chartW);
  const toY = (v: number) => padT + chartH - (maxVal > 0 ? (v / maxVal) * chartH : 0);

  const pointsAtual = atual.map((v, i) => `${toX(i)},${toY(v)}`);
  const pointsAnterior = anterior.map((v, i) => `${toX(i)},${toY(v)}`);
  const maxIdx = atual.reduce((best, v, i) => (v > (atual[best] ?? 0) ? i : best), 0);
  const areaPath =
    pointsAtual.length > 0
      ? `M ${toX(0)},${padT + chartH} L ${pointsAtual.join(' L ')} L ${toX(atual.length - 1)},${padT + chartH} Z`
      : '';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <span className="text-2xl font-bold tracking-tight text-text-main">{formatCurrencyNoCents(valorTotal)}</span>
        {variacao != null && (
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${variacao >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
            {variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}% vs período anterior
          </span>
        )}
      </div>
      <div className="h-[220px] w-full" style={{ minHeight: 220 }}>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full block">
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Grid horizontal — gridlines suaves */}
          {[0.25, 0.5, 0.75].map((q) => (
            <line
              key={q}
              x1={padL}
              y1={padT + chartH * (1 - q)}
              x2={w - padR}
              y2={padT + chartH * (1 - q)}
              stroke="rgba(148,163,184,0.15)"
              strokeWidth="0.15"
              strokeDasharray="0.5,0.5"
            />
          ))}
          {/* Área preenchida */}
          <path d={areaPath} fill="url(#chartFill)" />
          {/* Linha período anterior — slate-600, dash 6,6 */}
          <polyline
            fill="none"
            stroke="#475569"
            strokeWidth="0.5"
            strokeDasharray="6,6"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsAnterior.join(' ')}
          />
          {/* Linha atual */}
          <polyline
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="0.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsAtual.join(' ')}
          />
          {/* Dot no valor máximo */}
          {atual.length > 0 && (
            <circle
              cx={toX(maxIdx)}
              cy={toY(atual[maxIdx] ?? 0)}
              r="0.8"
              fill="var(--color-primary)"
              stroke="var(--color-bg-secondary)"
              strokeWidth="0.3"
            />
          )}
        </svg>
      </div>
      <div className="flex justify-between mt-3 text-xs text-text-muted">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div className="flex gap-4 mt-2 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-primary rounded-full" /> Atual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 border border-text-muted border-dashed rounded-full" /> Anterior
        </span>
      </div>
    </div>
  );
}

type CacheEntry = { data: DashboardSummary; expiresAt: number };

export default function Dashboard() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [chartToggle, setChartToggle] = useState<'receita' | 'ticket'>('receita');
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cacheRef = useRef<Map<Periodo, CacheEntry>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestedPeriodRef = useRef<Periodo | null>(null);
  const lastPeriodClickRef = useRef<{ periodo: Periodo; time: number }>({ periodo: 'mes', time: 0 });

  const getCache = (): Map<Periodo, CacheEntry> => {
    if (!cacheRef.current) cacheRef.current = new Map();
    return cacheRef.current;
  };
  const getCached = (p: Periodo): DashboardSummary | null => {
    const entry = getCache().get(p);
    return entry && entry.expiresAt > Date.now() ? entry.data : null;
  };
  const setCached = (p: Periodo, payload: DashboardSummary) => {
    getCache().set(p, { data: payload, expiresAt: Date.now() + CACHE_TTL_MS });
  };

  const loadSummary = (requestedPeriodo: Periodo, opts?: { prefetch?: boolean }) => {
    if (opts?.prefetch) {
      if (getCached(requestedPeriodo)) return;
      api
        .get<DashboardSummary>('/dashboard/summary', { params: { periodo: requestedPeriodo } })
        .then((res) => setCached(requestedPeriodo, res.data))
        .catch(() => {});
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    requestedPeriodRef.current = requestedPeriodo;

    const cached = getCached(requestedPeriodo);
    if (cached) {
      setData(cached);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
      setRefreshing(true);
    }

    api
      .get<DashboardSummary>('/dashboard/summary', { params: { periodo: requestedPeriodo }, signal: ac.signal })
      .then((res) => {
        if (requestedPeriodRef.current !== requestedPeriodo) return;
        setCached(requestedPeriodo, res.data);
        setData(res.data);
        setLoading(false);
        setRefreshing(false);
        if (requestedPeriodo === 'mes') {
          loadSummary('semana', { prefetch: true });
          loadSummary('trimestre', { prefetch: true });
        }
      })
      .catch((err) => {
        if (requestedPeriodRef.current !== requestedPeriodo) return;
        if (axios.isCancel(err) || err?.name === 'AbortError') return;
        toast.error('Erro ao carregar o painel');
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    loadSummary(periodo);
  }, [periodo]);

  const handlePeriodoClick = (p: Periodo) => {
    if (p === periodo) {
      if (Date.now() - lastPeriodClickRef.current.time < DEBOUNCE_MS) return;
    }
    lastPeriodClickRef.current = { periodo: p, time: Date.now() };
    setPeriodo(p);
  };

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
          <div>
            <div className="h-8 w-48 bg-bg-elevated rounded animate-pulse" />
            <div className="h-4 w-32 bg-bg-elevated rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-64 bg-bg-elevated rounded-full animate-pulse" />
        </header>
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-2xl bg-bg-card border border-border p-6 h-[180px] animate-pulse">
              <div className="h-12 w-12 rounded-2xl bg-bg-elevated" />
              <div className="h-4 w-24 mt-4 bg-bg-elevated rounded" />
              <div className="h-10 w-32 mt-2 bg-bg-elevated rounded" />
            </div>
          ))}
        </section>
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
          <div className="lg:col-span-7 rounded-2xl bg-bg-secondary border border-border p-6 h-[320px] animate-pulse" />
          <div className="lg:col-span-3 rounded-2xl bg-bg-card border border-border p-6 h-[280px] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center py-20 text-text-muted">
        Não foi possível carregar os dados do painel.
      </div>
    );
  }

  const { resultado, retencao, receitaEmRisco, operacional, grafico, atividadesRecentes, metaFaturamentoMes } = data;
  const variacao = resultado.variacaoPercentual;

  const metaFaturamento = metaFaturamentoMes != null && metaFaturamentoMes > 0 ? metaFaturamentoMes : null;
  const progressoFaturamento = metaFaturamento ? Math.min(100, Math.round((resultado.faturamento / metaFaturamento) * 100)) : 0;
  const metaTicket = resultado.ticketMedio * 1.1 || 1;
  const ticketAcimaMeta = resultado.ticketMedio >= metaTicket;
  const alertasCount = (retencao.clientesInativo > 0 ? 1 : 0) + (operacional.estoqueBaixoCount > 0 ? 1 : 0);
  const temReceitaEmRisco = (receitaEmRisco?.vendasPendentesTotal ?? 0) > 0 || (receitaEmRisco?.receitaEmRiscoNaoVoltaram ?? 0) > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-8">
      {/* Header: título + busca + notificação + seletor */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main">Strategic Dashboard</h1>
          <p className="text-sm text-text-muted mt-0.5">O que importa para decidir</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 sm:flex-initial min-w-[200px] max-w-[280px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none">search</span>
            <input
              type="text"
              placeholder="Buscar pedidos, clientes..."
              className="w-full rounded-full border border-border bg-bg-card pl-10 pr-10 py-2.5 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
              readOnly
              aria-label="Busca"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted font-mono hidden sm:inline">⌘K</kbd>
          </div>
          <button
            type="button"
            className="relative p-2 rounded-full text-text-muted hover:bg-bg-elevated hover:text-text-main transition-colors"
            aria-label="Notificações"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            {alertasCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--color-error)]" />
            )}
          </button>
          <div className="flex items-center gap-2">
            {refreshing && data && (
              <span className="material-symbols-outlined text-lg text-primary animate-spin" aria-hidden>
                progress_activity
              </span>
            )}
            <div className="flex rounded-full border border-border bg-bg-card overflow-hidden shadow-sm">
              {(['semana', 'mes', 'trimestre'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePeriodoClick(p)}
                  className={`px-4 py-2 text-sm font-medium transition-all ${
                    periodo === p ? 'bg-primary text-[var(--color-text-on-primary)] shadow-sm' : 'text-text-muted hover:bg-bg-elevated hover:text-text-main'
                  }`}
                >
                  {PERIODO_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* KPIs no topo — configuração antiga; valores em moeda sem centavos para caber */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
        {/* Faturamento */}
        <div className="rounded-2xl bg-bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-6 relative flex flex-col">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">payments</span>
            </div>
            {variacao != null && (
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${variacao >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                {variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs uppercase tracking-wide text-text-muted font-semibold mt-4">Faturamento bruto</p>
          <p className="text-4xl font-bold text-text-main mt-2">{formatCurrencyNoCents(resultado.faturamento)}</p>
          <p className="text-xs text-text-muted mt-1">Faturamento do período</p>
          {metaFaturamento != null && metaFaturamento > 0 ? (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-text-muted mb-1.5">
                <span>Meta: {formatCurrencyNoCents(metaFaturamento)}</span>
                <span className="font-medium text-text-main">{progressoFaturamento}%</span>
              </div>
              <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${progressoFaturamento >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, progressoFaturamento)}%` }} />
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <a href="/configuracoes" className="text-sm font-medium text-primary hover:underline">Definir meta</a>
            </div>
          )}
        </div>

        {/* Crescimento */}
        <div className="rounded-2xl bg-bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-6 relative flex flex-col">
          <div className="flex justify-between items-start">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${variacao != null && variacao >= 0 ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
              <span className={`material-symbols-outlined text-2xl ${variacao != null && variacao >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {variacao != null && variacao >= 0 ? 'trending_up' : 'trending_down'}
              </span>
            </div>
            {variacao != null && (
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${variacao >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                {variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs uppercase tracking-wide text-text-muted font-semibold mt-4">Crescimento</p>
          <p className={`text-4xl font-bold mt-2 ${variacao != null && variacao >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {variacao != null ? `${variacao >= 0 ? '+' : ''}${variacao.toFixed(1)}%` : '—'}
          </p>
          <p className="text-xs text-text-muted mt-1">vs período anterior</p>
        </div>

        {/* Ticket médio */}
        <div className="rounded-2xl bg-bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-6 relative flex flex-col">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">receipt_long</span>
            </div>
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${ticketAcimaMeta ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
              Meta {formatCurrencyNoCents(metaTicket)}
            </span>
          </div>
          <p className="text-xs uppercase tracking-wide text-text-muted font-semibold mt-4">Ticket médio</p>
          <p className="text-4xl font-bold text-text-main mt-2">{formatCurrencyNoCents(resultado.ticketMedio)}</p>
          <p className="text-xs text-text-muted mt-1">{resultado.qtdVendasPagas} vendas no período</p>
        </div>

        {/* Clientes recuperados */}
        <div className="rounded-2xl bg-bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-6 relative flex flex-col">
          <div className="flex justify-between items-start">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${(retencao.clientesRecuperados ?? 0) > 0 ? 'bg-green-500/15' : 'bg-bg-elevated'}`}>
              <span className={`material-symbols-outlined text-2xl ${(retencao.clientesRecuperados ?? 0) > 0 ? 'text-green-400' : 'text-text-muted'}`}>person_add</span>
            </div>
            {(retencao.clientesRecuperados ?? 0) > 0 && (
              <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-500/15 text-green-400">
                {(retencao.taxaRecuperacao ?? 0)}%
              </span>
            )}
          </div>
          <p className="text-xs uppercase tracking-wide text-text-muted font-semibold mt-4">Clientes recuperados</p>
          <p className="text-4xl font-bold text-text-main mt-2">{retencao.clientesRecuperados ?? 0} clientes</p>
          <p className="text-xs text-text-muted mt-1">{formatCurrencyNoCents(retencao.receitaRecuperada ?? 0)} recuperados</p>
        </div>

        {/* Estoque baixo */}
        <button
          type="button"
          onClick={() => navigate('/produtos?filtro=estoque_baixo')}
          className="rounded-2xl bg-bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-6 relative text-left flex flex-col"
        >
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-red-400 text-2xl">inventory_2</span>
            </div>
            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-red-500/15 text-red-400">
              Action Needed
            </span>
          </div>
          <p className="text-xs uppercase tracking-wide text-text-muted font-semibold mt-4">Estoque baixo</p>
          <p className="text-4xl font-bold text-text-main mt-2">{operacional.estoqueBaixoCount} itens</p>
          <p className="text-xs text-text-muted mt-1">Produtos abaixo do mínimo</p>
          {operacional.produtosEstoqueBaixo.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-xs text-text-muted">
              {operacional.produtosEstoqueBaixo.slice(0, 2).map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="truncate">{p.nome}</span>
                  <span className="text-red-400 font-medium shrink-0">{p.estoque_atual} restantes</span>
                </li>
              ))}
            </ul>
          )}
        </button>
      </section>

      {/* Card Receita em risco / Ações */}
      <section className="rounded-2xl bg-bg-card border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
        <h2 className="text-lg font-semibold text-text-main mb-4">Receita em risco</h2>
        {!temReceitaEmRisco && operacional.estoqueBaixoCount === 0 ? (
          <p className="text-text-muted flex items-center gap-2 py-2">
            <span className="text-green-400">✅</span> Nenhuma receita em risco no momento.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl bg-bg-elevated/50 border border-border p-4">
                <p className="text-sm font-medium text-text-muted">Vendas pendentes (dinheiro travado)</p>
                <p className="text-xl font-bold text-text-main mt-1">{formatCurrencyNoCents(receitaEmRisco?.vendasPendentesTotal ?? 0)}</p>
                <p className="text-xs text-text-muted mt-0.5">{(receitaEmRisco?.vendasPendentesCount ?? 0)} vendas pendentes</p>
                {(receitaEmRisco?.vendasPendentesCount ?? 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => navigate('/pendencias')}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-[var(--color-text-on-primary)] hover:bg-primary-hover transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">pending_actions</span>
                    Ver pendências
                  </button>
                ) : (
                  <button type="button" onClick={() => navigate('/pendencias')} className="mt-3 text-sm font-medium text-primary hover:underline">
                    Ver pendências
                  </button>
                )}
              </div>
              <div className="rounded-xl bg-bg-elevated/50 border border-border p-4">
                <p className="text-sm font-medium text-text-muted">Clientes que não voltaram</p>
                <p className="text-lg font-bold text-text-main mt-1">
                  Você pode perder aproximadamente {formatCurrencyNoCents(receitaEmRisco?.receitaEmRiscoNaoVoltaram ?? 0)} se não reativar.
                </p>
                <p className="text-xs text-text-muted mt-0.5">{(receitaEmRisco?.clientesNaoVoltaram ?? 0)} clientes compraram no período anterior e não voltaram</p>
                {(receitaEmRisco?.clientesNaoVoltaram ?? 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => navigate('/clientes?tab=retencao')}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-[var(--color-text-on-primary)] hover:bg-primary-hover transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">group</span>
                    Reativar agora
                  </button>
                ) : (
                  <button type="button" onClick={() => navigate('/clientes?status=inativo')} className="mt-3 text-sm font-medium text-primary hover:underline">
                    Reativar clientes
                  </button>
                )}
              </div>
            </div>
            {operacional.estoqueBaixoCount > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => navigate('/produtos?filtro=estoque_baixo')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 px-4 py-2.5 text-sm font-medium hover:bg-amber-500/25 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">inventory_2</span>
                  Repor estoque ({operacional.estoqueBaixoCount} itens)
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Área central: gráfico (70%) + coluna lateral (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
        {/* Card grande – Revenue Analytics (bg-secondary) */}
        <div className="lg:col-span-7 rounded-2xl bg-bg-secondary border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-text-main">Desempenho do período</h2>
              <p className="text-xs text-text-muted mt-0.5">Métricas comparativas</p>
            </div>
            <div className="flex rounded-full border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setChartToggle('receita')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${chartToggle === 'receita' ? 'bg-primary text-[var(--color-text-on-primary)]' : 'text-text-muted hover:bg-bg-elevated'}`}
              >
                Receita
              </button>
              <button
                type="button"
                onClick={() => setChartToggle('ticket')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${chartToggle === 'ticket' ? 'bg-primary text-[var(--color-text-on-primary)]' : 'text-text-muted hover:bg-bg-elevated'}`}
              >
                Ticket médio
              </button>
            </div>
          </div>
          {grafico ? (
            <DesempenhoChart
              labels={grafico.labels}
              atual={chartToggle === 'receita' ? grafico.receitaAtual : grafico.ticketMedioAtual}
              anterior={chartToggle === 'receita' ? grafico.receitaAnterior : grafico.ticketMedioAnterior}
              valorTotal={chartToggle === 'receita' ? resultado.faturamento : resultado.ticketMedio}
              variacao={variacao}
            />
          ) : (
            <div className="h-[220px] flex items-center justify-center text-text-muted text-sm rounded-lg bg-bg-elevated/50">
              Sem dados para exibir o gráfico
            </div>
          )}
        </div>

        {/* Coluna lateral: Recent Sales + CTA */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="rounded-2xl bg-bg-card border border-border p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col flex-1 min-h-0">
            <h2 className="text-base font-semibold text-text-main mb-4">Atividades recentes</h2>
            <ul className="space-y-4 flex-1 min-h-0 overflow-auto">
              {(atividadesRecentes || []).length === 0 ? (
                <li className="text-sm text-text-muted">Nenhuma atividade recente</li>
              ) : (
                (atividadesRecentes || []).slice(0, 6).map((a) => (
                  <li key={`${a.tipo}-${a.id}`} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-lg">
                        {a.tipo === 'venda' ? 'payments' : 'event'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-text-main truncate text-sm">{a.nome}</p>
                      <p className="text-xs text-text-muted">
                        {formatDistanceToNow(new Date(a.horario), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {a.valor != null && a.valor > 0 && (
                      <span className="text-sm font-medium text-green-400 shrink-0">+{formatCurrencyNoCents(a.valor ?? 0)}</span>
                    )}
                  </li>
                ))
              )}
            </ul>
            <button
              type="button"
              onClick={() => navigate('/vendas')}
              className="mt-4 w-full rounded-xl border border-border py-2.5 text-sm font-medium text-text-main hover:bg-bg-elevated transition-colors"
            >
              Ver todas
            </button>
          </div>

          {/* Card CTA – Oportunidade de receita (sempre visível) */}
          <div className="rounded-2xl bg-bg-elevated border border-border-soft p-6 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-base font-semibold text-text-main mb-2">Oportunidade de receita</h2>
            {retencao.estimativaReceitaRisco > 0 ? (
              <p className="text-sm text-text-main mb-4">
                Você pode recuperar aproximadamente <strong>{formatCurrencyNoCents(retencao.estimativaReceitaRisco)}</strong> reativando clientes inativos.
              </p>
            ) : (
              <p className="text-sm text-text-muted mb-4">Nenhuma receita em risco no momento.</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate('/clientes?status=inativo')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-[var(--color-text-on-primary)] hover:bg-primary-hover transition-colors"
              >
                <span className="material-symbols-outlined text-lg">group</span>
                Reativar
              </button>
              <button
                type="button"
                onClick={() => navigate('/clientes?status=inativo')}
                className="flex-1 rounded-xl border border-border bg-transparent text-primary px-3 py-2.5 text-sm font-medium hover:bg-bg-elevated transition-colors"
              >
                Ver lista
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

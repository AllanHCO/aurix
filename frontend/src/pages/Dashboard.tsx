import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { api } from '../services/api';
import { usePersonalizacao } from '../contexts/PersonalizacaoContext';
import { useBusinessAreas } from '../contexts/BusinessAreaContext';
import toast from 'react-hot-toast';
import { formatCurrencyNoCents } from '../utils/format';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CACHE_TTL_MS = 60_000;

type Periodo = 'ultimos_7_dias' | 'ultimos_30_dias' | 'ultimos_90_dias' | 'semana' | 'mes' | 'trimestre' | 'custom';

function getMesAtualRange(): { inicio: string; fim: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const inicio = `${y}-${m}-01`;
  const amanha = new Date(now);
  amanha.setDate(amanha.getDate() + 1);
  const fim = `${amanha.getFullYear()}-${String(amanha.getMonth() + 1).padStart(2, '0')}-${String(amanha.getDate()).padStart(2, '0')}`;
  return { inicio, fim };
}

interface DashboardSummary {
  periodo: Periodo;
  dataInicio?: string;
  dataFim?: string;
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
  resultadoPorArea?: Array<{ areaId: string; areaName: string; color: string | null; faturamento: number }>;
}

/** Gráfico estilo Revenue Analytics: área preenchida, linha anterior pontilhada, dot no máximo, grid leve, tooltip no hover. */
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
  const [tooltip, setTooltip] = useState<{ index: number; label: string; value: number; xPct: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  const hoverIdx = tooltip?.index ?? (atual.length > 0 ? atual.reduce((best, v, i) => (v > (atual[best] ?? 0) ? i : best), 0) : 0);
  const areaPath =
    pointsAtual.length > 0
      ? `M ${toX(0)},${padT + chartH} L ${pointsAtual.join(' L ')} L ${toX(atual.length - 1)},${padT + chartH} Z`
      : '';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el || labels.length === 0) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    let idx = 0;
    let best = Math.abs(x - toX(0));
    for (let i = 1; i < labels.length; i++) {
      const d = Math.abs(x - toX(i));
      if (d < best) {
        best = d;
        idx = i;
      }
    }
    const value = atual[idx] ?? 0;
    setTooltip({
      index: idx,
      label: labels[idx] ?? '',
      value,
      xPct: (toX(idx) / w) * 100
    });
  };

  const handleMouseLeave = () => setTooltip(null);

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
      <div
        ref={containerRef}
        className="h-[220px] w-full relative"
        style={{ minHeight: 220 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {tooltip && (
          <div
            className="absolute z-10 pointer-events-none px-3 py-2 rounded-lg bg-bg-elevated border border-border shadow-lg text-sm whitespace-nowrap"
            style={{
              left: `${tooltip.xPct}%`,
              top: 8,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="font-medium text-text-main">{tooltip.label}</div>
            <div className="text-primary font-semibold">{formatCurrencyNoCents(tooltip.value)}</div>
          </div>
        )}
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
          {/* Bolinha segue o ponto sob o mouse (ou máximo quando sem hover) */}
          {atual.length > 0 && (
            <circle
              cx={toX(hoverIdx)}
              cy={toY(atual[hoverIdx] ?? 0)}
              r="0.8"
              fill="var(--color-primary)"
              stroke="var(--color-bg-card)"
              strokeWidth="0.3"
              className="transition-all duration-150"
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
  const { getModuleConfig } = usePersonalizacao();
  const { selectedAreaId } = useBusinessAreas();
  const produtosConfig = getModuleConfig('produtos');
  const marketingConfig = getModuleConfig('marketing');
  const { inicio: defaultInicio, fim: defaultFim } = getMesAtualRange();
  const [dataInicial, setDataInicial] = useState(defaultInicio);
  const [dataFinal, setDataFinal] = useState(defaultFim);
  const [chartToggle, setChartToggle] = useState<'receita' | 'ticket'>('receita');
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const requestedRef = useRef<{ inicio: string; fim: string; area: string | null } | null>(null);

  const getCache = (): Map<string, CacheEntry> => cacheRef.current;
  const cacheKey = (inicio: string, fim: string, area: string | null) => `${inicio}_${fim}_${area ?? 'all'}`;
  const getCached = (inicio: string, fim: string, area: string | null): DashboardSummary | null => {
    const entry = getCache().get(cacheKey(inicio, fim, area));
    return entry && entry.expiresAt > Date.now() ? entry.data : null;
  };
  const setCached = (inicio: string, fim: string, area: string | null, payload: DashboardSummary) => {
    getCache().set(cacheKey(inicio, fim, area), { data: payload, expiresAt: Date.now() + CACHE_TTL_MS });
  };

  const loadSummary = (inicio: string, fim: string, areaId: string | null) => {
    if (!inicio || !fim) return;
    if (new Date(fim) < new Date(inicio)) {
      toast.error('Data final não pode ser anterior à data inicial');
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    requestedRef.current = { inicio, fim, area: areaId };

    const cached = getCached(inicio, fim, areaId);
    if (cached) {
      setData(cached);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
      setRefreshing(true);
    }

    const params: Record<string, string> = { dataInicial: inicio, dataFinal: fim };
    if (areaId) params.business_area_id = areaId;

    api
      .get<DashboardSummary>('/dashboard/summary', { params, signal: ac.signal })
      .then((res) => {
        if (requestedRef.current?.inicio !== inicio || requestedRef.current?.fim !== fim || requestedRef.current?.area !== areaId) return;
        setCached(inicio, fim, areaId, res.data);
        setData(res.data);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err) => {
        if (requestedRef.current?.inicio !== inicio || requestedRef.current?.fim !== fim || requestedRef.current?.area !== areaId) return;
        if (axios.isCancel(err) || err?.name === 'AbortError') return;
        toast.error('Erro ao carregar o painel');
        setLoading(false);
        setRefreshing(false);
      });
  };

  const aplicarFiltro = () => loadSummary(dataInicial, dataFinal, selectedAreaId);

  useEffect(() => {
    loadSummary(dataInicial, dataFinal, selectedAreaId);
  }, [dataInicial, dataFinal, selectedAreaId]);

  if (loading && !data) {
    return (
      <div className="space-y-5 pb-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
          <div>
            <div className="h-8 w-48 bg-bg-elevated rounded animate-pulse" />
            <div className="h-4 w-32 bg-bg-elevated rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-64 bg-bg-elevated rounded-full animate-pulse" />
        </header>
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl bg-bg-card border border-border p-5 h-[140px] animate-pulse">
              <div className="h-12 w-12 rounded-2xl bg-bg-elevated" />
              <div className="h-4 w-24 mt-4 bg-bg-elevated rounded" />
              <div className="h-10 w-32 mt-2 bg-bg-elevated rounded" />
            </div>
          ))}
        </section>
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-5">
          <div className="lg:col-span-7 rounded-xl bg-bg-card border border-border p-5 h-[260px] animate-pulse" />
          <div className="lg:col-span-3 rounded-xl bg-bg-card border border-border p-5 h-[220px] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-text-muted">
        Não foi possível carregar os dados do painel.
      </div>
    );
  }

  const { resultado, retencao, receitaEmRisco, operacional, grafico, atividadesRecentes, metaFaturamentoMes, resultadoPorArea } = data;
  const variacao = resultado.variacaoPercentual;
  const totalFaturamentoArea = resultadoPorArea?.reduce((s, a) => s + a.faturamento, 0) ?? resultado.faturamento;

  const metaFaturamento = metaFaturamentoMes != null && metaFaturamentoMes > 0 ? metaFaturamentoMes : null;
  const progressoFaturamento = metaFaturamento ? Math.min(100, Math.round((resultado.faturamento / metaFaturamento) * 100)) : 0;
  const metaTicket = resultado.ticketMedio * 1.1 || 1;
  const ticketAcimaMeta = resultado.ticketMedio >= metaTicket;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-8">
      {/* Header: título + busca + notificação + seletor */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main">Dashboard</h1>
          <p className="text-sm text-text-muted mt-0.5">Visão geral do desempenho do seu negócio.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
            {refreshing && data && (
              <span className="material-symbols-outlined text-lg text-primary animate-spin" aria-hidden>
                progress_activity
              </span>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="dashboard-data-inicial" className="block text-xs font-medium text-text-muted mb-1">Data inicial</label>
                <input
                  id="dashboard-data-inicial"
                  type="date"
                  value={dataInicial}
                  onChange={(e) => setDataInicial(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-bg-card text-text-main focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
              <div>
                <label htmlFor="dashboard-data-final" className="block text-xs font-medium text-text-muted mb-1">Data final</label>
                <input
                  id="dashboard-data-final"
                  type="date"
                  value={dataFinal}
                  onChange={(e) => setDataFinal(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-bg-card text-text-main focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
              <button
                type="button"
                onClick={aplicarFiltro}
                disabled={loading}
                className="bg-primary hover:bg-primary-hover text-text-on-primary font-medium px-4 py-2 rounded-lg disabled:opacity-50 min-h-[40px]"
              >
                Aplicar
              </button>
            </div>
          </div>
      </header>

      {/* Linha 1: Cards principais — faturamento, crescimento, ticket médio, estoque baixo */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Faturamento */}
        <div className="rounded-xl bg-bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-5 relative flex flex-col">
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
        <div className="rounded-xl bg-bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-5 relative flex flex-col">
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
        <div className="rounded-xl bg-bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-5 relative flex flex-col">
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

        {produtosConfig.controlar_estoque && (
        <>
          {/* Estoque baixo */}
          <button
            type="button"
            onClick={() => navigate('/produtos?filtro=estoque_baixo')}
            className="rounded-xl bg-bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-5 relative text-left flex flex-col"
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
        </>
      )}
      </section>

      {/* Resultado por área (visão consolidada) */}
      {resultadoPorArea && resultadoPorArea.length > 0 && (
        <section className="rounded-xl bg-bg-card border border-border p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-text-main mb-4">Resultado por área</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resultadoPorArea.map((a) => {
              const pct = totalFaturamentoArea > 0 ? Math.round((a.faturamento / totalFaturamentoArea) * 100) : 0;
              return (
                <div
                  key={a.areaId}
                  className="rounded-lg border border-border p-4 flex flex-col"
                  style={a.color ? { borderLeftWidth: 4, borderLeftColor: a.color } : undefined}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {a.color && (
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                    )}
                    <span className="font-medium text-text-main">{a.areaName}</span>
                  </div>
                  <p className="text-2xl font-bold text-text-main">{formatCurrencyNoCents(a.faturamento)}</p>
                  <p className="text-xs text-text-muted mt-1">Participação: {pct}% do faturamento</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Clientes para recuperar — acima do gráfico, no meio; os 3 no mesmo alinhamento (topo e base) */}
      <section className="rounded-xl bg-bg-card border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
        <h2 className="text-lg font-semibold text-text-main mb-3">Clientes para recuperar</h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr] gap-4 items-stretch">
          <button
            type="button"
            onClick={() => navigate('/clientes?tab=retencao')}
            className="rounded-xl bg-bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-5 text-left h-full flex flex-col min-h-[120px]"
          >
            <p className="text-sm font-bold text-text-muted uppercase tracking-wide">Clientes que não voltaram</p>
            <p className="text-2xl font-bold text-text-main mt-2 flex-1">{(receitaEmRisco?.clientesNaoVoltaram ?? 0)} clientes</p>
            <p className="text-xs text-text-muted mt-1">Não voltaram no período</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/clientes?status=inativo')}
            className="rounded-xl bg-bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-5 text-left h-full flex flex-col min-h-[120px]"
          >
            <p className="text-sm font-bold text-text-muted uppercase tracking-wide">Clientes inativos</p>
            <p className="text-2xl font-bold text-text-main mt-2 flex-1">{retencao.clientesInativo} clientes</p>
            <p className="text-xs text-text-muted mt-1">Passaram do limite de inatividade</p>
          </button>
          <div className="rounded-xl bg-bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-5 min-h-[120px] flex flex-col h-full">
            <p className="text-sm font-bold text-text-muted uppercase tracking-wide">Clientes que não voltaram</p>
            <p className="text-text-main font-bold mt-2 flex-1 flex items-center whitespace-nowrap overflow-x-auto text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">
              Você pode perder aproximadamente {formatCurrencyNoCents(resultado.ticketMedio * retencao.clientesInativo)} se não reativar.
            </p>
            <p className="text-xs text-text-muted mt-1">Ticket médio × clientes inativos</p>
          </div>
        </div>
      </section>

      {/* Gráfico de desempenho */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-5">
        <div className="lg:col-span-7 rounded-xl bg-bg-card border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
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
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="rounded-xl bg-bg-card border border-border p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col flex-1 min-h-0">
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

        </div>
      </div>
    </div>
  );
}

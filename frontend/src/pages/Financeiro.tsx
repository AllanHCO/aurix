import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { usePersonalizacao } from '../contexts/PersonalizacaoContext';
import toast from 'react-hot-toast';
import SearchableSelect from '../components/SearchableSelect';
import TableActionsMenu from '../components/TableActionsMenu';
import ModalPortal from '../components/ModalPortal';
import { useBusinessAreas } from '../contexts/BusinessAreaContext';
import { formatCurrency, formatDate } from '../utils/format';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

type TabFinanceiro = 'visao-geral' | 'movimentacoes' | 'categorias' | 'analise';
type PeriodoPreset = '7' | '30' | '90' | 'custom';

interface OverviewRes {
  entradas: number;
  saidas: number;
  cashFlow: number;
  estimatedProfit: number;
  pendencias: number;
  averageMargin: number | null;
  missingCostItems: number;
  chart: { labels: string[]; entradas: number[]; saidas: number[] };
  startDate: string;
  endDate: string;
}

interface FinancialCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
  createdAt: string;
  updatedAt: string;
  transactionsCount?: number;
}

interface FinancialTransaction {
  id: string;
  type: 'income' | 'expense';
  category_id: string;
  category: { id: string; name: string; type: string };
  business_area_id?: string | null;
  business_area?: { id: string; name: string; color: string | null } | null;
  supplier_id: string | null;
  source_type: string;
  source_id: string | null;
  description: string;
  value: number;
  status: string;
  date: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TransactionsRes {
  items: FinancialTransaction[];
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

interface AnalysisRes {
  startDate: string;
  endDate: string;
  despesasPorCategoria: { category_id: string; category_name: string; total: number }[];
  entradasPorCategoria: { category_id: string; category_name: string; total: number }[];
  eficiencia?: { lucroEstimado: number; margemMedia: number | null; itensSemCusto: number };
  itensPorProduto?: { produto_id: string; produto_nome: string; receita: number; custo_total: number; lucro_estimado: number; margem: number | null }[];
  /** Comparação por área (só quando flag áreas ligada e filtro = Todas as áreas) */
  porArea?: { areaId: string | null; areaName: string; color: string | null; entradas: number; despesas: number }[];
}

function getPeriodRange(preset: PeriodoPreset, customStart?: string, customEnd?: string): { start: string; end: string } {
  const end = new Date();
  const endStr = end.toISOString().slice(0, 10);
  if (preset === 'custom' && customStart && customEnd) return { start: customStart, end: customEnd };
  let start = new Date();
  if (preset === '7') start.setDate(start.getDate() - 6);
  else if (preset === '30') start.setDate(start.getDate() - 29);
  else if (preset === '90') start.setDate(start.getDate() - 89);
  else start.setDate(start.getDate() - 29);
  const startStr = start.toISOString().slice(0, 10);
  return { start: startStr, end: endStr };
}

export default function Financeiro() {
  const { getModuleLabel } = usePersonalizacao();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabFinanceiro | null;
  const [tab, setTab] = useState<TabFinanceiro>(tabParam && ['visao-geral', 'movimentacoes', 'categorias', 'analise'].includes(tabParam) ? tabParam : 'visao-geral');

  const setTabAndUrl = (t: TabFinanceiro) => {
    setTab(t);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', t);
      return next;
    });
  };

  useEffect(() => {
    if (tabParam && tabParam !== tab) setTab(tabParam as TabFinanceiro);
  }, [tabParam]);

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-main)] mb-1 sm:mb-2">
          {getModuleLabel('financeiro')}
        </h1>
        <p className="text-sm sm:text-base text-[var(--color-text-muted)]">
          Controle de entradas, saídas e saúde financeira do negócio
        </p>
      </div>

      <div className="border-b border-[var(--color-border)]">
        <nav className="flex gap-6 sm:gap-8" aria-label="Abas do Financeiro">
          {(
            [
              ['visao-geral', 'Visão Geral'],
              ['movimentacoes', 'Movimentações'],
              ['categorias', 'Categorias'],
              ['analise', 'Análise']
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTabAndUrl(key)}
              className={`pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === key
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:border-[var(--color-border)]'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'visao-geral' && <AbaVisaoGeral />}
      {tab === 'movimentacoes' && <AbaMovimentacoes />}
      {tab === 'categorias' && <AbaCategorias />}
      {tab === 'analise' && <AbaAnalise />}
    </div>
  );
}

function AbaVisaoGeral() {
  const { selectedAreaId } = useBusinessAreas();
  const [preset, setPreset] = useState<PeriodoPreset>('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [overview, setOverview] = useState<OverviewRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { start, end } = getPeriodRange(preset, customStart, customEnd);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { startDate: start, endDate: end };
    if (selectedAreaId) params.business_area_id = selectedAreaId;
    api
      .get<OverviewRes>('/financeiro/overview', { params })
      .then((res) => setOverview(res.data))
      .catch((err) => {
        setError(err.response?.data?.error || 'Erro ao carregar visão geral');
        setOverview(null);
      })
      .finally(() => setLoading(false));
  }, [start, end, selectedAreaId]);

  useEffect(() => {
    load();
  }, [load]);

  const chartData = overview?.chart?.labels?.map((label, i) => ({
    name: label,
    Entradas: overview.chart.entradas[i] ?? 0,
    Saídas: overview.chart.saidas[i] ?? 0
  })) ?? [];

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-[var(--color-text-muted)]">Carregando...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center">
        <p className="text-[var(--color-error)] mb-4">{error}</p>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-[var(--color-text-muted)]">Período:</span>
        {(['7', '30', '90', 'custom'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPreset(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              preset === p
                ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]'
                : 'bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-main)] hover:bg-[var(--color-bg-elevated)]'
            }`}
          >
            {p === '7' ? '7 dias' : p === '30' ? '30 dias' : p === '90' ? '90 dias' : 'Personalizado'}
          </button>
        ))}
        {preset === 'custom' && (
          <>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm"
            />
            <span className="text-[var(--color-text-muted)]">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm"
            />
          </>
        )}
      </div>

      {(overview?.missingCostItems ?? 0) > 0 && (
        <div className="rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-[var(--color-warning)] shrink-0">info</span>
          <div>
            <p className="font-medium text-[var(--color-text-main)]">Alguns produtos vendidos não possuem custo cadastrado</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {(overview?.missingCostItems ?? 0)} item(ns) sem custo. Cadastre o custo nos produtos para ver o lucro real com mais precisão.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Entradas</p>
          <p className="text-xl font-bold text-[var(--color-success)]">{formatCurrency(overview?.entradas ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Saídas</p>
          <p className="text-xl font-bold text-[var(--color-error)]">{formatCurrency(overview?.saidas ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Fluxo de caixa</p>
          <p className={`text-xl font-bold ${(overview?.cashFlow ?? 0) >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-error)]'}`}>
            {formatCurrency(overview?.cashFlow ?? 0)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Entradas − Saídas</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Lucro estimado</p>
          <p className={`text-xl font-bold ${(overview?.estimatedProfit ?? 0) >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-error)]'}`}>
            {formatCurrency(overview?.estimatedProfit ?? 0)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Com base no custo dos itens vendidos</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Pendências</p>
          <p className="text-xl font-bold text-[var(--color-text-main)]">{formatCurrency(overview?.pendencias ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Margem média</p>
          {overview?.averageMargin != null ? (
            <p className="text-xl font-bold text-[var(--color-text-main)]">{Number(overview.averageMargin).toFixed(1)}%</p>
          ) : (
            <p className="text-lg text-[var(--color-text-muted)]">Sem dados suficientes</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--color-text-main)] mb-4">Entradas vs Saídas</h2>
        {chartData.length === 0 ? (
          <p className="text-[var(--color-text-muted)] py-8 text-center">Nenhum dado no período.</p>
        ) : (
          <div className="h-64 sm:h-80 financeiro-chart-wrap" style={{ background: 'var(--color-bg-card)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} cursor={{ fill: 'transparent' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickFormatter={(v) => `R$ ${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text-main)' }}
                  wrapperStyle={{ outline: 'none' }}
                  labelStyle={{ color: 'var(--color-text-main)' }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                  labelFormatter={(label) => `Período: ${label}`}
                />
                <Legend />
                <Bar dataKey="Entradas" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Saídas" fill="var(--color-error)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-text-main)] mb-3">Dinheiro escapando do negócio</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Pendências (a receber)</span>
              <span className="font-medium text-[var(--color-text-main)]">{formatCurrency(overview?.pendencias ?? 0)}</span>
            </li>
            <li className="flex justify-between text-[var(--color-text-muted)]">
              <span>Clientes que não voltaram</span>
              <span>— (em breve)</span>
            </li>
            <li className="flex justify-between text-[var(--color-text-muted)]">
              <span>Vendas abaixo da margem</span>
              <span>— (em breve)</span>
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-text-main)] mb-3">Alertas financeiros</h2>
          <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
            {(overview?.pendencias ?? 0) > 0 && (
              <li>• Valores pendentes de recebimento somam {formatCurrency(overview?.pendencias ?? 0)}.</li>
            )}
            {(!overview?.pendencias || overview.pendencias <= 0) && (
              <li>Nenhum alerta no momento.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AbaMovimentacoes() {
  const { selectedAreaId, enabled: businessAreasEnabled } = useBusinessAreas();
  const [items, setItems] = useState<FinancialTransaction[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<PeriodoPreset>('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState<'entrada' | 'saida' | 'edicao' | null>(null);
  const [editando, setEditando] = useState<FinancialTransaction | null>(null);
  const [duplicando, setDuplicando] = useState<FinancialTransaction | null>(null);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const pageSize = 20;

  const { start, end } = getPeriodRange(preset, customStart, customEnd);

  const loadCategories = useCallback(() => {
    api.get<FinancialCategory[]>('/financeiro/categories').then((r) => setCategories(r.data)).catch(() => setCategories([]));
  }, []);

  const loadTransactions = useCallback((pageOverride?: number) => {
    setLoading(true);
    setError(null);
    const p = pageOverride ?? page;
    const params: Record<string, string | number> = {
      startDate: start,
      endDate: end,
      page: p,
      limit: pageSize
    };
    if (filtroTipo) params.type = filtroTipo;
    if (filtroStatus) params.status = filtroStatus;
    if (filtroCategoria) params.category_id = filtroCategoria;
    if (busca.trim()) params.search = busca.trim();
    if (selectedAreaId) params.business_area_id = selectedAreaId;
    api
      .get<TransactionsRes>('/financeiro/transactions', { params })
      .then((res) => {
        setItems(res.data.items);
        setTotalItems(res.data.totalItems);
        setTotalPages(res.data.totalPages);
        if (pageOverride !== undefined) setPage(pageOverride);
        else setPage(res.data.page);
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Erro ao carregar movimentações');
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [start, end, page, filtroTipo, filtroStatus, filtroCategoria, busca, selectedAreaId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    api.get<{ id: string; name: string }[]>('/fornecedores').then((r) => setSuppliers(r.data)).catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const exportCSV = () => {
    const params: Record<string, string> = { startDate: start, endDate: end };
    if (filtroTipo) params.type = filtroTipo;
    if (filtroStatus) params.status = filtroStatus;
    if (filtroCategoria) params.category_id = filtroCategoria;
    if (busca.trim()) params.search = busca.trim();
    if (selectedAreaId) params.business_area_id = selectedAreaId;
    api
      .get<TransactionsRes>('/financeiro/transactions', { params: { ...params, limit: 10000, page: 1 } })
      .then((res) => {
        const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status', 'Origem'];
    if (businessAreasEnabled) headers.push('Área');
    const rows = [
      headers,
      ...res.data.items.map((t) => {
        const row = [
          t.date,
          t.description,
          t.category?.name ?? '',
          t.type === 'income' ? 'Entrada' : 'Saída',
          String(t.value),
          t.status,
          t.source_type === 'sale' ? 'Venda' : t.source_type === 'manual' ? 'Manual' : t.source_type
        ];
        if (businessAreasEnabled) row.push(t.business_area?.name ?? '—');
        return row;
      })
    ];
        const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `movimentacoes_${start}_${end}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exportado.');
      })
      .catch(() => toast.error('Erro ao exportar CSV.'));
  };

  const abrirDuplicar = (t: FinancialTransaction) => {
    setDuplicando(t);
    setEditando(null);
    setModalAberto(t.type === 'income' ? 'entrada' : 'saida');
  };

  const fecharModal = () => {
    setModalAberto(null);
    setEditando(null);
    setDuplicando(null);
    loadTransactions();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta movimentação?')) return;
    try {
      await api.delete(`/financeiro/transactions/${id}`);
      toast.success('Movimentação excluída.');
      loadTransactions();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir.');
    }
  };

  const podeEditar = (t: FinancialTransaction) => t.source_type !== 'sale';

  const statusLabel = (s: string) => (s === 'confirmed' ? 'Confirmado' : s === 'pending' ? 'Pendente' : 'Cancelado');
  const origemLabel = (s: string) => (s === 'sale' ? 'Venda' : s === 'manual' ? 'Manual' : s === 'adjustment' ? 'Ajuste' : s);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as PeriodoPreset)}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm"
        >
          <option value="7">7 dias</option>
          <option value="30">30 dias</option>
          <option value="90">90 dias</option>
          <option value="custom">Personalizado</option>
        </select>
        {preset === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm" />
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm" />
          </>
        )}
        <select
          value={filtroTipo}
          onChange={(e) => { setFiltroTipo(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="income">Entrada</option>
          <option value="expense">Saída</option>
        </select>
        <select
          value={filtroStatus}
          onChange={(e) => { setFiltroStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm"
        >
          <option value="">Todos os status</option>
          <option value="confirmed">Confirmado</option>
          <option value="pending">Pendente</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <SearchableSelect
          options={categories.map((c) => ({ value: c.id, label: `${c.name} (${c.type === 'income' ? 'Entrada' : 'Saída'})` }))}
          value={filtroCategoria}
          onChange={(v) => { setFiltroCategoria(v); setPage(1); }}
          placeholder="Todas as categorias"
          allowClear
          emptyMessage="Nenhuma categoria encontrada"
          className="min-w-[180px]"
        />
        <input
          type="text"
          placeholder="Buscar por descrição"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(1), loadTransactions())}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm min-w-[180px]"
        />
        <button type="button" onClick={() => { setPage(1); loadTransactions(1); }} className="px-4 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-main)] text-sm font-medium">
          Filtrar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setEditando(null); setDuplicando(null); setModalAberto('entrada'); }}
          className="px-4 py-2.5 rounded-lg bg-[var(--color-success)] text-white font-medium flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Nova entrada
        </button>
        <button
          type="button"
          onClick={() => { setEditando(null); setDuplicando(null); setModalAberto('saida'); }}
          className="px-4 py-2.5 rounded-lg bg-[var(--color-error)] text-white font-medium flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">remove</span>
          Nova saída
        </button>
        <button
          type="button"
          onClick={exportCSV}
          className="px-4 py-2.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-main)] font-medium flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">download</span>
          Exportar CSV
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--color-error)] bg-red-500/10 p-4 text-[var(--color-error)]">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-[var(--color-text-muted)]">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-[var(--color-text-muted)]">Nenhuma movimentação no período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-text-main)]">Data</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-text-main)]">Descrição</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-text-main)]">Categoria</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-text-main)]">Tipo</th>
                  <th className="text-right py-3 px-4 font-medium text-[var(--color-text-main)]">Valor</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-text-main)]">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-text-main)]">Origem</th>
                  {businessAreasEnabled && (
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-main)]">Área</th>
                  )}
                  <th className="table-actions-col text-right py-3 px-4 font-medium text-[var(--color-text-main)] w-[80px]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)]">
                    <td className="py-3 px-4 text-[var(--color-text-main)]">{formatDate(t.date)}</td>
                    <td className="py-3 px-4 text-[var(--color-text-main)]">{t.description}</td>
                    <td className="py-3 px-4 text-[var(--color-text-muted)]">{t.category?.name ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className={t.type === 'income' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}>
                        {t.type === 'income' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-[var(--color-text-main)]">
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.value)}
                    </td>
                    <td className="py-3 px-4 text-[var(--color-text-muted)]">{statusLabel(t.status)}</td>
                    <td className="py-3 px-4 text-[var(--color-text-muted)]">{origemLabel(t.source_type)}</td>
                    {businessAreasEnabled && (
                      <td className="py-3 px-4 text-[var(--color-text-muted)]">
                        {t.business_area ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={t.business_area.color ? { backgroundColor: `${t.business_area.color}20`, color: t.business_area.color } : undefined}
                          >
                            {t.business_area.name}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    <td className="table-actions-col py-3 px-4 text-right">
                      <TableActionsMenu
                        iconSize="md"
                        items={[
                          { label: 'Duplicar', icon: 'content_copy', onClick: () => abrirDuplicar(t) },
                          ...(podeEditar(t)
                            ? [
                                { label: 'Editar', icon: 'edit' as const, onClick: () => { setEditando(t); setDuplicando(null); setModalAberto(t.type === 'income' ? 'edicao' : 'edicao'); } },
                                { label: 'Excluir', icon: 'delete' as const, onClick: () => handleDelete(t.id), danger: true }
                              ]
                            : [])
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-text-muted)]">
              {totalItems} registro(s) · Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] disabled:opacity-50 text-sm"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] disabled:opacity-50 text-sm"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {(modalAberto === 'entrada' || modalAberto === 'saida' || modalAberto === 'edicao') && (
        <ModalMovimentacao
          tipo={editando ? (editando.type as 'income' | 'expense') : duplicando ? (duplicando.type as 'income' | 'expense') : modalAberto === 'entrada' ? 'income' : 'expense'}
          categorias={categories}
          suppliers={suppliers}
          transacao={editando ?? duplicando ?? undefined}
          isEdit={!!editando}
          fechar={fecharModal}
        />
      )}
    </div>
  );
}

type TipoSaida = 'despesa' | 'compra';

interface PurchaseItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  /** Data da última compra (para exibir dica) */
  lastPurchaseDate?: string | null;
}

function ModalMovimentacao({
  tipo,
  categorias,
  suppliers = [],
  transacao,
  isEdit,
  fechar
}: {
  tipo: 'income' | 'expense';
  categorias: FinancialCategory[];
  suppliers?: { id: string; name: string }[];
  transacao?: FinancialTransaction;
  isEdit: boolean;
  fechar: () => void;
}) {
  const { areas: businessAreas, selectedAreaId } = useBusinessAreas();
  const isDuplicar = !!transacao && !isEdit;
  const isNovaSaida = tipo === 'expense' && !isEdit && !isDuplicar;
  const categoriasFiltradas = categorias.filter((c) => c.type === tipo);
  const [tipoSaida, setTipoSaida] = useState<TipoSaida>('despesa');
  const [description, setDescription] = useState(transacao?.description ?? '');
  const [categoryId, setCategoryId] = useState(transacao?.category_id ?? categoriasFiltradas[0]?.id ?? '');
  const [businessAreaId, setBusinessAreaId] = useState(transacao?.business_area_id ?? (selectedAreaId ?? ''));
  const [supplierId, setSupplierId] = useState(transacao?.supplier_id ?? '');
  const [value, setValue] = useState(transacao?.value != null ? String(transacao.value) : '');
  const [date, setDate] = useState(transacao?.date ?? new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState(transacao?.status ?? 'confirmed');
  const [notes, setNotes] = useState(transacao?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<{ id: string; nome: string; custo: number }[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([{ product_id: '', product_name: '', quantity: 1, unit_cost: 0, lastPurchaseDate: null }]);

  useEffect(() => {
    if (categoriasFiltradas.length && !categoryId) setCategoryId(categoriasFiltradas[0].id);
  }, [categoriasFiltradas, categoryId]);

  useEffect(() => {
    if (!transacao && selectedAreaId && !businessAreaId) {
      setBusinessAreaId(selectedAreaId);
    }
  }, [transacao, selectedAreaId, businessAreaId]);

  useEffect(() => {
    if (isNovaSaida && tipoSaida === 'compra') {
      api.get<{ id: string; nome: string; custo: number }[]>('/produtos', { params: { filtro: 'todos', periodo: 'este_mes' } })
        .then((r) => setProducts(Array.isArray(r.data) ? r.data : []))
        .catch(() => setProducts([]));
    }
  }, [isNovaSaida, tipoSaida]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNovaSaida && tipoSaida === 'compra') {
      const validItems = purchaseItems.filter((i) => i.product_id && i.quantity > 0 && i.unit_cost >= 0);
      if (validItems.length === 0) {
        toast.error('Adicione pelo menos um produto com quantidade e custo.');
        return;
      }
      const total = validItems.reduce((acc, i) => acc + i.quantity * i.unit_cost, 0);
      if (total <= 0) {
        toast.error('Total da compra deve ser positivo.');
        return;
      }
      setSaving(true);
      try {
        await api.post('/financeiro/purchases', {
          supplier_id: supplierId?.trim() || null,
          category_id: categoryId,
          business_area_id: businessAreaId?.trim() || null,
          date,
          notes: notes.trim() || null,
          items: validItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_cost: i.unit_cost }))
        });
        toast.success('Compra registrada. Estoque e financeiro atualizados.');
        fechar();
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Erro ao registrar compra.');
      } finally {
        setSaving(false);
      }
      return;
    }
    const num = parseFloat(value.replace(',', '.'));
    if (!description.trim() || !categoryId || isNaN(num) || num <= 0 || !date) {
      toast.error('Preencha descrição, categoria, valor e data.');
      return;
    }
    setSaving(true);
    try {
      const payloadBase: {
        description: string;
        category_id: string;
        value: number;
        date: string;
        status: string;
        notes: string | null;
        business_area_id?: string | null;
      } = {
        description: description.trim(),
        category_id: categoryId,
        value: num,
        date,
        status,
        notes: notes.trim() || null
      };
      if (businessAreaId) {
        payloadBase.business_area_id = businessAreaId;
      }
      const supplierPayload = tipo === 'expense' ? { supplier_id: supplierId?.trim() || null } : {};
      if (isEdit && transacao?.id) {
        await api.put(`/financeiro/transactions/${transacao.id}`, { ...payloadBase, ...supplierPayload });
        toast.success('Movimentação atualizada.');
      } else {
        await api.post('/financeiro/transactions', {
          type: tipo,
          ...payloadBase,
          ...supplierPayload
        });
        toast.success(tipo === 'income' ? 'Entrada registrada.' : 'Saída registrada.');
      }
      fechar();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const addPurchaseItem = () => setPurchaseItems((prev) => [...prev, { product_id: '', product_name: '', quantity: 1, unit_cost: 0, lastPurchaseDate: null }]);
  const removePurchaseItem = (idx: number) => setPurchaseItems((prev) => prev.filter((_, i) => i !== idx));
  const updatePurchaseItem = (idx: number, field: keyof PurchaseItem, val: string | number) => {
    setPurchaseItems((prev) => {
      const next = [...prev];
      (next[idx] as any)[field] = val;
      if (field === 'product_id') {
        const p = products.find((x) => x.id === val);
        if (p) {
          next[idx].product_name = p.nome;
          next[idx].unit_cost = p.custo;
          next[idx].lastPurchaseDate = null;
          api.get<{ unit_cost: number; date: string }[]>(`/produtos/${val}/purchase-history`).then((r) => {
            if (r.data?.length && r.data[0]) {
              setPurchaseItems((curr) => {
                const c = [...curr];
                if (c[idx]?.product_id === val) {
                  c[idx] = { ...c[idx], unit_cost: r.data[0].unit_cost, lastPurchaseDate: r.data[0].date ?? null };
                }
                return c;
              });
            }
          }).catch(() => {});
        }
      }
      return next;
    });
  };

  const purchaseTotal = purchaseItems.reduce((acc, i) => acc + i.quantity * i.unit_cost, 0);

  useEffect(() => {
    if (isNovaSaida && tipoSaida === 'compra' && categoriasFiltradas.length) {
      const compraId = categoriasFiltradas.find((c) => c.name.toLowerCase().includes('compra'))?.id ?? categoriasFiltradas[0]?.id;
      if (compraId) setCategoryId(compraId);
    }
  }, [isNovaSaida, tipoSaida, categoriasFiltradas]);

  return (
    <ModalPortal>
      <div className="aurix-modal-overlay fixed inset-0 flex items-center justify-center p-4 bg-black/50" onClick={fechar}>
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold text-[var(--color-text-main)] mb-4">
          {isEdit ? 'Editar movimentação' : isDuplicar ? 'Duplicar movimentação' : tipo === 'income' ? 'Nova entrada' : 'Nova saída'}
        </h3>
        {isNovaSaida && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Tipo de saída</label>
            <select
              value={tipoSaida}
              onChange={(e) => setTipoSaida(e.target.value as TipoSaida)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]"
            >
              <option value="despesa">Despesa</option>
              <option value="compra">Compra de produto</option>
            </select>
          </div>
        )}

        {isNovaSaida && tipoSaida === 'compra' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <SearchableSelect
                  label="Fornecedor"
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                  value={supplierId}
                  onChange={setSupplierId}
                  placeholder="Pesquisar fornecedor..."
                  allowClear
                  emptyMessage="Nenhum fornecedor encontrado"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Data</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" required />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-[var(--color-text-main)]">Itens da compra</label>
                <button type="button" onClick={addPurchaseItem} className="text-sm text-[var(--color-primary)] hover:underline flex items-center gap-1">
                  <span className="material-symbols-outlined text-lg">add</span>
                  Adicionar produto
                </button>
              </div>
              <div className="space-y-3">
                {purchaseItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)]">
                    <div className="col-span-5">
                      <SearchableSelect
                        label="Produto"
                        options={products.map((p) => ({ value: p.id, label: p.nome }))}
                        value={item.product_id}
                        onChange={(v) => updatePurchaseItem(idx, 'product_id', v)}
                        placeholder="Pesquisar produto..."
                        emptyMessage="Nenhum produto encontrado"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-[var(--color-text-muted)] mb-0.5">Qtd</label>
                      <input type="number" min={1} value={item.quantity} onChange={(e) => updatePurchaseItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)} className="w-full px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-[var(--color-text-muted)] mb-0.5">Custo un.</label>
                      <input type="text" inputMode="decimal" value={item.unit_cost || ''} onChange={(e) => updatePurchaseItem(idx, 'unit_cost', parseFloat(e.target.value.replace(',', '.')) || 0)} className="w-full px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm" placeholder="0" />
                      {item.lastPurchaseDate && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Última compra: {formatDate(item.lastPurchaseDate)}</p>
                      )}
                    </div>
                    <div className="col-span-2 text-sm text-[var(--color-text-muted)]">= {formatCurrency(item.quantity * item.unit_cost)}</div>
                    <div className="col-span-1">
                      <button type="button" onClick={() => removePurchaseItem(idx)} className="p-1.5 rounded text-[var(--color-error)] hover:bg-red-500/10" title="Remover">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end text-lg font-semibold text-[var(--color-text-main)]">Total: {formatCurrency(purchaseTotal)}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <SearchableSelect
                  label="Categoria financeira"
                  options={categoriasFiltradas.map((c) => ({ value: c.id, label: c.name }))}
                  value={categoryId}
                  onChange={setCategoryId}
                  placeholder="Pesquisar categoria..."
                  emptyMessage="Nenhuma categoria encontrada"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Observação</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" placeholder="Opcional" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={fechar} className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-main)]">Cancelar</button>
              <button type="submit" disabled={saving || purchaseTotal <= 0} className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Registrar compra'}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Descrição</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" required />
            </div>
            <div>
              <SearchableSelect
                label="Categoria"
                options={categoriasFiltradas.map((c) => ({ value: c.id, label: c.name }))}
                value={categoryId}
                onChange={setCategoryId}
                placeholder={categoriasFiltradas.length === 0 ? 'Cadastre uma categoria na aba Categorias' : 'Pesquisar categoria...'}
                emptyMessage="Nenhuma categoria encontrada"
              />
            </div>
            {tipo === 'expense' && (
              <div>
                <SearchableSelect
                  label="Fornecedor (opcional)"
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                  value={supplierId}
                  onChange={setSupplierId}
                  placeholder="Pesquisar fornecedor..."
                  allowClear
                  emptyMessage="Nenhum fornecedor encontrado"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Valor</label>
              <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" required />
            </div>
            {!transacao?.source_type || transacao.source_type === 'manual' ? (
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]">
                  <option value="confirmed">Confirmado</option>
                  <option value="pending">Pendente</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Observação (opcional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={fechar} className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-main)]">Cancelar</button>
              <button type="submit" disabled={saving || categoriasFiltradas.length === 0} className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium disabled:opacity-50">{saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Registrar'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}

function AbaCategorias() {
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState<'income' | 'expense' | null>(null);
  const [editando, setEditando] = useState<FinancialCategory | null>(null);
  const [nome, setNome] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<FinancialCategory[]>('/financeiro/categories')
      .then((res) => setCategories(res.data))
      .catch((err) => {
        setError(err.response?.data?.error || 'Erro ao carregar categorias');
        setCategories([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const abrirCriar = (tipo: 'income' | 'expense') => {
    setEditando(null);
    setNome('');
    setModalAberto(tipo);
  };

  const abrirEditar = (c: FinancialCategory) => {
    setEditando(c);
    setNome(c.name);
    setModalAberto(c.type);
  };

  const fecharModal = () => {
    setModalAberto(null);
    setEditando(null);
    setNome('');
    load();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = nome.trim();
    if (!name) {
      toast.error('Nome é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      if (editando) {
        await api.put(`/financeiro/categories/${editando.id}`, { name, type: editando.type });
        toast.success('Categoria atualizada.');
      } else {
        await api.post('/financeiro/categories', { name, type: modalAberto! });
        toast.success('Categoria criada.');
      }
      fecharModal();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: FinancialCategory) => {
    if ((c.transactionsCount ?? 0) > 0) {
      toast.error('Não é possível excluir categoria com movimentações vinculadas.');
      return;
    }
    if (!confirm(`Excluir a categoria "${c.name}"?`)) return;
    try {
      await api.delete(`/financeiro/categories/${c.id}`);
      toast.success('Categoria excluída.');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir.');
    }
  };

  const entradas = categories.filter((c) => c.type === 'income');
  const saidas = categories.filter((c) => c.type === 'expense');

  if (loading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-[var(--color-text-muted)]">Carregando...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center">
        <p className="text-[var(--color-error)] mb-4">{error}</p>
        <button type="button" onClick={load} className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-main)]">Categorias de entrada</h2>
            <button
              type="button"
              onClick={() => abrirCriar('income')}
              className="px-3 py-2 rounded-lg bg-[var(--color-success)] text-white text-sm font-medium flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Nova
            </button>
          </div>
          {entradas.length === 0 ? (
            <p className="text-[var(--color-text-muted)] text-sm">Nenhuma categoria. Crie uma para organizar entradas.</p>
          ) : (
            <ul className="space-y-2">
              {entradas.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                  <span className="text-[var(--color-text-main)]">{c.name}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => abrirEditar(c)} className="p-1.5 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)]" title="Editar">
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button type="button" onClick={() => handleDelete(c)} className="p-1.5 rounded text-[var(--color-error)] hover:bg-red-500/10" title="Excluir">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-main)]">Categorias de saída</h2>
            <button
              type="button"
              onClick={() => abrirCriar('expense')}
              className="px-3 py-2 rounded-lg bg-[var(--color-error)] text-white text-sm font-medium flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Nova
            </button>
          </div>
          {saidas.length === 0 ? (
            <p className="text-[var(--color-text-muted)] text-sm">Nenhuma categoria. Crie uma para organizar saídas.</p>
          ) : (
            <ul className="space-y-2">
              {saidas.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                  <span className="text-[var(--color-text-main)]">{c.name}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => abrirEditar(c)} className="p-1.5 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)]" title="Editar">
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button type="button" onClick={() => handleDelete(c)} className="p-1.5 rounded text-[var(--color-error)] hover:bg-red-500/10" title="Excluir">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {modalAberto && (
        <ModalPortal>
          <div className="aurix-modal-overlay fixed inset-0 flex items-center justify-center p-4 bg-black/50" onClick={fecharModal}>
            <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[var(--color-text-main)] mb-4">
              {editando ? 'Editar categoria' : modalAberto === 'income' ? 'Nova categoria de entrada' : 'Nova categoria de saída'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Nome</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={fecharModal} className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-main)]">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

function AbaAnalise() {
  const { selectedAreaId, enabled: businessAreasEnabled } = useBusinessAreas();
  const [preset, setPreset] = useState<PeriodoPreset>('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { start, end } = getPeriodRange(preset, customStart, customEnd);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { startDate: start, endDate: end };
    if (selectedAreaId) params.business_area_id = selectedAreaId;
    api
      .get<AnalysisRes>('/financeiro/analysis', { params })
      .then((res) => setAnalysis(res.data))
      .catch((err) => {
        setError(err.response?.data?.error || 'Erro ao carregar análise');
        setAnalysis(null);
      })
      .finally(() => setLoading(false));
  }, [start, end, selectedAreaId]);

  useEffect(() => {
    load();
  }, [load]);

  const coresPie = ['var(--color-primary)', 'var(--color-success)', 'var(--color-warning)', '#6366f1', '#ec4899', '#14b8a6'];

  if (loading && !analysis) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-[var(--color-text-muted)]">Carregando...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center">
        <p className="text-[var(--color-error)] mb-4">{error}</p>
        <button type="button" onClick={load} className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium">
          Tentar novamente
        </button>
      </div>
    );
  }

  const despesasData = analysis?.despesasPorCategoria?.filter((d) => d.total > 0) ?? [];
  const entradasData = analysis?.entradasPorCategoria?.filter((d) => d.total > 0) ?? [];
  const eficiencia = analysis?.eficiencia;
  const itensPorProduto = analysis?.itensPorProduto ?? [];
  const porArea = analysis?.porArea ?? [];
  const mostrarBlocoArea = businessAreasEnabled && !selectedAreaId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-[var(--color-text-muted)]">Período:</span>
        {(['7', '30', '90', 'custom'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPreset(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              preset === p
                ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]'
                : 'bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-main)] hover:bg-[var(--color-bg-elevated)]'
            }`}
          >
            {p === '7' ? '7 dias' : p === '30' ? '30 dias' : p === '90' ? '90 dias' : 'Personalizado'}
          </button>
        ))}
        {preset === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm" />
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm" />
          </>
        )}
      </div>

      {(eficiencia?.itensSemCusto ?? 0) > 0 && (
        <div className="rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-[var(--color-warning)] shrink-0">info</span>
          <p className="text-sm text-[var(--color-text-main)]">
            Alguns produtos vendidos não possuem custo cadastrado. Cadastre o custo para ver o lucro real com mais precisão.
          </p>
        </div>
      )}

      {mostrarBlocoArea && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-text-main)] mb-4">Comparação por área de negócio</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Com o filtro &quot;Todas as áreas&quot; selecionado no topo da página, entradas e saídas do período são agrupadas por área.
          </p>
          {porArea.length > 0 ? (
            <>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={porArea.map((a) => ({ name: a.areaName, Entradas: a.entradas, Saídas: a.despesas, color: a.color ?? undefined }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} stroke="var(--color-text-muted)" />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fill: 'var(--color-text-main)' }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="Entradas" fill="var(--color-success)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Saídas" fill="var(--color-error)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {porArea.map((a) => (
                  <li key={a.areaId ?? 'sem-area'} className="flex justify-between items-center">
                    <span className="text-[var(--color-text-main)]">{a.areaName}</span>
                    <span className="flex gap-4">
                      <span className="text-[var(--color-success)]">+{formatCurrency(a.entradas)}</span>
                      <span className="text-[var(--color-error)]">-{formatCurrency(a.despesas)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[var(--color-text-muted)] py-8 text-center">
              Nenhuma movimentação com área no período. Cadastre áreas de negócio e vincule-as às movimentações para ver o gráfico.
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--color-text-main)] mb-4">Eficiência das vendas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-[var(--color-text-muted)] mb-1">Lucro estimado</p>
            <p className="text-xl font-bold text-[var(--color-primary)]">{formatCurrency(eficiencia?.lucroEstimado ?? 0)}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--color-text-muted)] mb-1">Margem média</p>
            {eficiencia?.margemMedia != null ? (
              <p className="text-xl font-bold text-[var(--color-text-main)]">{Number(eficiencia.margemMedia).toFixed(1)}%</p>
            ) : (
              <p className="text-[var(--color-text-muted)]">Sem dados suficientes</p>
            )}
          </div>
          <div>
            <p className="text-sm text-[var(--color-text-muted)] mb-1">Itens sem custo cadastrado</p>
            <p className="text-xl font-bold text-[var(--color-text-main)]">{eficiencia?.itensSemCusto ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-text-main)] mb-4">Despesas por categoria</h2>
          {despesasData.length === 0 ? (
            <p className="text-[var(--color-text-muted)] py-6 text-center">Nenhuma despesa no período.</p>
          ) : (
            <>
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={despesasData}
                      dataKey="total"
                      nameKey="category_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ category_name, total }) => `${category_name}: ${formatCurrency(total)}`}
                    >
                      {despesasData.map((_, i) => (
                        <Cell key={i} fill={coresPie[i % coresPie.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2 text-sm">
                {despesasData.map((d) => (
                  <li key={d.category_id} className="flex justify-between">
                    <span className="text-[var(--color-text-main)]">{d.category_name}</span>
                    <span className="font-medium text-[var(--color-text-main)]">{formatCurrency(d.total)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-text-main)] mb-4">Entradas por categoria</h2>
          {entradasData.length === 0 ? (
            <p className="text-[var(--color-text-muted)] py-6 text-center">Nenhuma entrada no período.</p>
          ) : (
            <>
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={entradasData}
                      dataKey="total"
                      nameKey="category_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ category_name, total }) => `${category_name}: ${formatCurrency(total)}`}
                    >
                      {entradasData.map((_, i) => (
                        <Cell key={i} fill={coresPie[i % coresPie.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2 text-sm">
                {entradasData.map((d) => (
                  <li key={d.category_id} className="flex justify-between">
                    <span className="text-[var(--color-text-main)]">{d.category_name}</span>
                    <span className="font-medium text-[var(--color-text-main)]">{formatCurrency(d.total)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--color-text-main)] mb-4">Top categorias de gasto</h2>
        {despesasData.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">Nenhum dado no período.</p>
        ) : (
          <ol className="space-y-2">
            {despesasData.slice(0, 10).map((d, i) => (
              <li key={d.category_id} className="flex items-center gap-3">
                <span className="text-[var(--color-text-muted)] w-6">{i + 1}.</span>
                <span className="text-[var(--color-text-main)] flex-1">{d.category_name}</span>
                <span className="font-medium text-[var(--color-text-main)]">{formatCurrency(d.total)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--color-text-main)] mb-4">Detalhe por produto (vendas pagas no período)</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">Receita, custo e margem por produto vendido (apenas itens com custo cadastrado).</p>
        {itensPorProduto.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">Nenhum item vendido com custo cadastrado no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th className="py-3 px-4 font-medium text-[var(--color-text-main)]">Produto</th>
                  <th className="py-3 px-4 font-medium text-[var(--color-text-main)] text-right">Receita</th>
                  <th className="py-3 px-4 font-medium text-[var(--color-text-main)] text-right">Custo total</th>
                  <th className="py-3 px-4 font-medium text-[var(--color-text-main)] text-right">Lucro estimado</th>
                  <th className="py-3 px-4 font-medium text-[var(--color-text-main)] text-right">Margem</th>
                </tr>
              </thead>
              <tbody>
                {itensPorProduto.map((row) => (
                  <tr key={row.produto_id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)]">
                    <td className="py-3 px-4 text-[var(--color-text-main)]">{row.produto_nome}</td>
                    <td className="py-3 px-4 text-right text-[var(--color-text-main)]">{formatCurrency(row.receita)}</td>
                    <td className="py-3 px-4 text-right text-[var(--color-text-muted)]">{formatCurrency(row.custo_total)}</td>
                    <td className="py-3 px-4 text-right font-medium text-[var(--color-text-main)]">{formatCurrency(row.lucro_estimado)}</td>
                    <td className="py-3 px-4 text-right text-[var(--color-text-main)]">{row.margem != null ? `${Number(row.margem).toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { usePersonalizacao } from '../contexts/PersonalizacaoContext';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate, formatDateTime } from '../utils/format';
import VendaModal from '../components/VendaModal';
import VendaDetalheModal, { type VendaDetalhe } from '../components/VendaDetalheModal';
import TableActionsMenu from '../components/TableActionsMenu';
import { AreaBadge } from '../components/AreaFilterSelect';
import ModalPortal from '../components/ModalPortal';
import { useBusinessAreas } from '../contexts/BusinessAreaContext';

const SEARCH_DEBOUNCE_MS = 300;

type FiltroTipo = 'todos' | 'vendas' | 'orcamentos' | 'ordens_servico';
type FiltroStatus = 'todos' | 'PAGO' | 'PENDENTE' | 'FECHADA' | 'CANCELADO';

function getUltimos30Dias(): { inicio: string; fim: string } {
  const fim = new Date();
  const inicio = new Date(fim);
  inicio.setDate(inicio.getDate() - 30);
  const toYMD = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { inicio: toYMD(inicio), fim: toYMD(fim) };
}

interface Venda extends VendaDetalhe {
  tipo?: 'sale' | 'quote' | 'service_order';
  os_code?: string | null;
  os_status?: string | null;
  business_area?: { id: string; name: string; color: string | null } | null;
  servicos?: Array<{ id?: string; descricao: string; quantidade: number; valor_unitario: number }>;
  itens: Array<{
    id: string;
    produto_id: string;
    quantidade: number;
    preco_unitario: number;
    produto: { nome: string };
  }>;
}

const DEFAULT_RANGE = getUltimos30Dias();
const PAGE_SIZE_OPTIONS = [10, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface VendasListResponse {
  items: Venda[];
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

export default function Vendas() {
  const { getModuleLabel } = usePersonalizacao();
  const { selectedAreaId } = useBusinessAreas();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [dataInicial, setDataInicial] = useState(DEFAULT_RANGE.inicio);
  const [dataFinal, setDataFinal] = useState(DEFAULT_RANGE.fim);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [searchInput, setSearchInput] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detalheVenda, setDetalheVenda] = useState<VendaDetalhe | null>(null);
  const [vendaEditando, setVendaEditando] = useState<Venda | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFaturarModal, setShowFaturarModal] = useState(false);
  const [faturandoLote, setFaturandoLote] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [dataInicial, dataFinal, filtroTipo, filtroStatus, searchDebounced]);

  useEffect(() => {
    loadVendas();
  }, [dataInicial, dataFinal, filtroTipo, filtroStatus, searchDebounced, page, pageSize, selectedAreaId]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, pageSize, dataInicial, dataFinal, filtroTipo, filtroStatus, searchDebounced]);

  const agendamentoIdFromUrl = searchParams.get('agendamentoId') ?? undefined;
  const clienteIdFromUrl = searchParams.get('clienteId') ?? undefined;
  const isNovoFromAgenda = location.pathname === '/vendas/novo' || agendamentoIdFromUrl || clienteIdFromUrl;

  useEffect(() => {
    if (isNovoFromAgenda) {
      setModalOpen(true);
    }
  }, [isNovoFromAgenda]);

  const loadVendas = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        startDate: dataInicial,
        endDate: dataFinal,
        page,
        pageSize
      };
      if (filtroTipo === 'vendas') params.tipo = 'sale';
      else if (filtroTipo === 'orcamentos') params.tipo = 'quote';
      else if (filtroTipo === 'ordens_servico') params.tipo = 'service_order';
      if (filtroStatus !== 'todos') params.status = filtroStatus;
      if (searchDebounced) params.searchTerm = searchDebounced;
      if (selectedAreaId) params.business_area_id = selectedAreaId;
      const response = await api.get<VendasListResponse>('/vendas', { params });
      const data = response.data;
      setVendas(Array.isArray(data.items) ? data.items : []);
      setTotalItems(typeof data.totalItems === 'number' ? data.totalItems : 0);
      setTotalPages(Math.max(1, data.totalPages ?? 1));
    } catch (error: unknown) {
      toast.error('Erro ao carregar vendas');
      setVendas([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const temFiltrosAtivos = filtroTipo !== 'todos' || filtroStatus !== 'todos' || searchDebounced !== '' || dataInicial !== DEFAULT_RANGE.inicio || dataFinal !== DEFAULT_RANGE.fim;

  const handlePageSizeChange = (newSize: PageSize) => {
    setPageSize(newSize);
    setPage(1);
  };

  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalItems);

  const limparFiltros = () => {
    setDataInicial(DEFAULT_RANGE.inicio);
    setDataFinal(DEFAULT_RANGE.fim);
    setFiltroTipo('todos');
    setFiltroStatus('todos');
    setSearchInput('');
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setVendaEditando(null);
    if (location.pathname === '/vendas/novo') {
      navigate('/vendas', { replace: true });
    }
    loadVendas();
  };

  const handleVerDetalhe = async (venda: Venda) => {
    try {
      const response = await api.get<Venda>(`/vendas/${venda.id}`);
      setDetalheVenda(response.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao carregar detalhes');
    }
  };

  const handleEditarVenda = async (venda: VendaDetalhe) => {
    setDetalheVenda(null);
    try {
      // Buscar detalhes completos (itens/servicos/anexos/etc.) para o modal de edição
      const response = await api.get<Venda>(`/vendas/${venda.id}`);
      setVendaEditando(response.data);
      setModalOpen(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao carregar dados para edição');
    }
  };

  const selectableOnPage = vendas.filter(
    (v) =>
      v.tipo !== 'quote' &&
      v.tipo !== 'service_order' &&
      ((v.status || 'PENDENTE') === 'PENDENTE' || v.status === 'PARCIAL' || v.status === 'PAGO')
  );
  const allSelectableSelected =
    selectableOnPage.length > 0 && selectableOnPage.every((v) => selectedIds.has(v.id));

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    if (allSelectableSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectableOnPage.forEach((v) => next.delete(v.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectableOnPage.forEach((v) => next.add(v.id));
        return next;
      });
    }
  };

  const selectedVendas = vendas.filter((v) => selectedIds.has(v.id));
  const handleAbrirFaturarModal = () => setShowFaturarModal(true);

  const [excluindoLote, setExcluindoLote] = useState(false);
  const confirmExcluirLote = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Excluir ${ids.length} pedido(s) selecionado(s)? Esta ação não pode ser desfeita.`)) return;
    setExcluindoLote(true);
    try {
      const { data } = await api.post<{ successIds: string[]; failed: Array<{ id: string; motivo: string }> }>(
        '/vendas/excluir-lote',
        { saleIds: ids }
      );
      await loadVendas();
      setSelectedIds(new Set());
      const ok = data.successIds?.length ?? 0;
      const fail = data.failed?.length ?? 0;
      if (fail === 0) toast.success(`${ok} pedido(s) excluído(s).`);
      else toast.success(`${ok} excluído(s). ${fail} falharam.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg && typeof msg === 'string' ? msg : 'Erro ao excluir em lote');
    } finally {
      setExcluindoLote(false);
    }
  };

  const confirmFaturarLote = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setFaturandoLote(true);
    try {
      const { data } = await api.post<{ successIds: string[]; failed: Array<{ id: string; motivo: string }> }>(
        '/vendas/faturar-lote',
        { saleIds: ids }
      );
      await loadVendas();
      setSelectedIds(new Set());
      setShowFaturarModal(false);
      const ok = data.successIds?.length ?? 0;
      const fail = data.failed?.length ?? 0;
      if (fail === 0) {
        toast.success(`${ok} pedido(s) faturado(s) com sucesso.`);
      } else {
        toast.success(`${ok} pedido(s) faturado(s). ${fail} falharam.`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg && typeof msg === 'string' ? msg : 'Erro ao faturar em lote');
    } finally {
      setFaturandoLote(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-main mb-1 sm:mb-2">{getModuleLabel('vendas')}</h1>
          <p className="text-sm sm:text-base text-text-muted">Registre e acompanhe suas vendas</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-3 sm:px-5 sm:py-2.5 rounded-lg flex items-center justify-center gap-2 min-h-[44px] touch-manipulation shrink-0"
        >
          <span className="material-symbols-outlined">add</span>
          Nova Venda
        </button>
      </div>

      <div className="bg-bg-card rounded-xl border border-border shadow-sm p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 flex-wrap">
          <div className="min-w-[200px] max-w-md flex-1 lg:min-w-[220px] order-1">
            <label htmlFor="vendas-pesquisa" className="block text-sm font-medium text-text-main mb-1">
              Pesquisar
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-lg">search</span>
              <input
                id="vendas-pesquisa"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Código, cliente ou telefone..."
                className="w-full rounded-lg border border-border bg-bg-elevated pl-10 pr-10 py-2.5 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label="Pesquisar vendas"
              />
            {searchInput.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-muted hover:bg-bg-card hover:text-text-main"
                aria-label="Limpar pesquisa"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            )}
            </div>
          </div>
          <div className="order-2 flex flex-col gap-2">
            <div className="flex flex-wrap gap-1">
              {[
                { value: 'todos' as const, label: 'Todos' },
                { value: 'vendas' as const, label: 'Vendas' },
                { value: 'orcamentos' as const, label: 'Orçamentos' },
                { value: 'ordens_servico' as const, label: 'Ordens de serviço' }
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFiltroTipo(value)}
                  className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
                    filtroTipo === value
                      ? 'bg-primary text-[var(--color-text-on-primary)] border-primary'
                      : 'border-border bg-bg-elevated text-text-muted hover:text-text-main hover:bg-bg-card'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                { value: 'todos' as const, label: 'Todos' },
                { value: 'PAGO' as const, label: 'Pagos' },
                { value: 'PENDENTE' as const, label: 'Pendentes' },
                { value: 'FECHADA' as const, label: 'Faturados' },
                { value: 'CANCELADO' as const, label: 'Cancelados' }
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFiltroStatus(value)}
                  className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
                    filtroStatus === value
                      ? 'bg-primary text-[var(--color-text-on-primary)] border-primary'
                      : 'border-border bg-bg-elevated text-text-muted hover:text-text-main hover:bg-bg-card'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 min-w-0 flex-1 order-3">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Data inicial</label>
              <input
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-bg-elevated text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label="Data inicial"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Data final</label>
              <input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-bg-elevated text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label="Data final"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-text-muted">Período:</span>
        <span className="px-2.5 py-1 rounded-lg bg-bg-elevated border border-border text-text-main">
          {formatDate(dataInicial)} – {formatDate(dataFinal)}
        </span>
        <span className="text-text-muted">Filtro:</span>
        <span className="px-2.5 py-1 rounded-lg bg-bg-elevated border border-border text-text-main">
          {filtroTipo === 'todos' ? 'Todos' : filtroTipo === 'vendas' ? 'Vendas' : filtroTipo === 'orcamentos' ? 'Orçamentos' : 'Ordens de serviço'}
          {filtroStatus !== 'todos' && ` · ${filtroStatus === 'PAGO' ? 'Pagos' : filtroStatus === 'PENDENTE' ? 'Pendentes' : filtroStatus === 'FECHADA' ? 'Faturados' : 'Cancelados'}`}
        </span>
        <span className="text-text-muted">Resultados:</span>
        <span className="px-2.5 py-1 rounded-lg bg-bg-elevated border border-border font-semibold text-text-main">
          {totalItems}
        </span>
        {temFiltrosAtivos && (
          <button
            type="button"
            onClick={limparFiltros}
            className="ml-1 px-2.5 py-1 rounded-lg border border-border text-text-muted hover:bg-bg-elevated hover:text-text-main"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {vendas.length === 0 ? (
        <div className="bg-bg-card rounded-xl border border-border p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-text-muted mb-4 block">
            {temFiltrosAtivos ? 'search_off' : 'payments'}
          </span>
          <h3 className="text-xl font-bold text-text-main mb-2">
            {temFiltrosAtivos ? 'Nenhuma venda encontrada' : 'Nenhuma venda registrada'}
          </h3>
          <p className="text-text-muted mb-6">
            {temFiltrosAtivos ? 'Ajuste os filtros ou limpe para ver todas.' : 'Comece registrando sua primeira venda'}
          </p>
          {temFiltrosAtivos ? (
            <button
              type="button"
              onClick={limparFiltros}
              className="bg-bg-elevated hover:bg-border border border-border text-text-main font-medium px-6 py-3 rounded-lg"
            >
              Limpar filtros
            </button>
          ) : (
            <button
              onClick={() => setModalOpen(true)}
              className="bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-6 py-3 rounded-lg"
            >
              Registrar Venda
            </button>
          )}
        </div>
      ) : (
        <>
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border border-border bg-bg-elevated text-text-main">
            <span className="text-sm font-medium">
              {selectedIds.size} selecionado(s)
            </span>
            <button
              type="button"
              onClick={handleAbrirFaturarModal}
              disabled={faturandoLote || excluindoLote}
              className="bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              Faturar Selecionados
            </button>
            <button
              type="button"
              onClick={confirmExcluirLote}
              disabled={excluindoLote || faturandoLote}
              className="px-3 py-2 rounded-lg border border-border bg-bg-card text-error hover:bg-badge-erro text-sm disabled:opacity-50"
            >
              {excluindoLote ? 'Excluindo…' : 'Excluir selecionados'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-2 rounded-lg border border-border bg-bg-card text-text-muted hover:bg-bg-elevated text-sm"
            >
              Limpar seleção
            </button>
          </div>
        )}
        <div className="bg-bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
          <table className="w-full min-w-[560px]">
            <thead className="bg-bg-elevated border-b border-border">
              <tr>
                <th className="w-10 px-2 py-3 sm:py-4 text-center">
                  <input
                    type="checkbox"
                    checked={allSelectableSelected}
                    onChange={toggleSelectAllPage}
                    disabled={selectableOnPage.length === 0}
                    className="rounded border-border bg-bg-card text-primary focus:ring-primary/20"
                    aria-label="Selecionar todos da página"
                  />
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                  Código
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                  Data / Hora
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                  Cliente
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-text-muted">
                  Total
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                  Pagamento
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-text-muted">
                  Status
                </th>
                <th className="table-actions-col px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-text-muted w-[80px]">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendas.map((venda) => {
                const status = venda.status || 'PENDENTE';
                const isQuote = venda.tipo === 'quote';
                const isOs = venda.tipo === 'service_order';
                const statusLabel = isOs
                  ? (venda.os_status === 'CONVERTIDA_EM_VENDA' ? 'Convertida' : venda.os_status === 'CANCELADA' ? 'Cancelada' : venda.os_status === 'CONCLUIDA' ? 'Concluída' : venda.os_status === 'EM_EXECUCAO' ? 'Em execução' : 'Aberta')
                  : isQuote
                    ? (status === 'ORCAMENTO' ? 'Orçamento' : status === 'CANCELADO' ? 'Cancelado' : status)
                    : status === 'PAGO'
                      ? 'Pago'
                      : status === 'PARCIAL'
                        ? 'Parcial'
                        : status === 'FECHADA'
                          ? 'Fechada'
                          : 'Pendente';
                const statusClass = isOs
                  ? venda.os_status === 'CANCELADA' ? 'bg-text-muted/20 text-text-muted' : venda.os_status === 'CONVERTIDA_EM_VENDA' ? 'bg-text-muted/20 text-text-muted' : 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                  : isQuote
                    ? status === 'CANCELADO' ? 'bg-text-muted/20 text-text-muted' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : status === 'PAGO'
                      ? 'bg-badge-pago text-badge-pago-text'
                      : status === 'PARCIAL'
                        ? 'bg-badge-pendente text-badge-pendente-text'
                        : status === 'FECHADA'
                          ? 'bg-text-muted/20 text-text-muted'
                          : 'bg-badge-pendente text-badge-pendente-text';
                const canSelect = !isQuote && !isOs && (status === 'PENDENTE' || status === 'PARCIAL' || status === 'PAGO');
                return (
                  <tr key={venda.id} className="hover:bg-bg-elevated">
                    <td className="w-10 px-2 py-3 sm:py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(venda.id)}
                        onChange={() => toggleSelection(venda.id)}
                        disabled={!canSelect}
                        className="rounded border-border bg-bg-card text-primary focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={canSelect ? `Selecionar ${venda.sale_code ?? venda.id}` : 'Pedido já faturado'}
                      />
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-sm font-mono tabular-nums">
                      <span className="block">{isOs ? (venda.os_code ?? '—') : (venda.sale_code ?? '—')}</span>
                      {isQuote && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mt-0.5 inline-block">Orçamento</span>
                      )}
                      {isOs && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mt-0.5 inline-block">OS</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-sm">{formatDateTime(venda.createdAt)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 font-semibold text-text-main truncate max-w-[120px] sm:max-w-none">{venda.cliente.nome}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-bold text-text-main">
                      {formatCurrency(Number(venda.total))}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-sm">{isQuote || isOs ? '—' : (venda.forma_pagamento ?? '—')}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <span className={`text-xs px-2 py-1 rounded shrink-0 ${statusClass}`}>
                          {statusLabel}
                        </span>
                        {venda.business_area && (
                          <AreaBadge name={venda.business_area.name} color={venda.business_area.color} />
                        )}
                      </div>
                    </td>
                    <td className="table-actions-col px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <TableActionsMenu
                        items={[
                          { label: 'Ver detalhes', icon: 'visibility', onClick: () => handleVerDetalhe(venda) }
                        ]}
                        className="justify-center"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 border-t border-border bg-bg-elevated/50">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm text-text-muted">
                Mostrando {rangeStart}–{rangeEnd} de {totalItems}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-muted">Itens por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value) as PageSize)}
                  className="rounded-lg border border-border bg-bg-card px-3 py-1.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label="Itens por página"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-border bg-bg-card text-text-main text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-elevated"
              >
                Anterior
              </button>
              <span className="text-sm text-text-muted px-1">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-border bg-bg-card text-text-main text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-elevated"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
        </>
      )}

      {showFaturarModal && (
        <ModalPortal>
          <div className="aurix-modal-overlay fixed inset-0 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="faturar-lote-title">
            <div className="bg-bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 id="faturar-lote-title" className="text-lg font-bold text-text-main mb-4">Faturar em lote</h2>
            <p className="text-text-muted text-sm mb-2">
              Você está prestes a faturar <strong className="text-text-main">{selectedVendas.length}</strong> pedido(s).
            </p>
            {selectedVendas.length > 0 && (
              <p className="text-text-muted text-sm mb-2">
                Valor total: <strong className="text-text-main">{formatCurrency(selectedVendas.reduce((s, v) => s + Number(v.total), 0))}</strong>
              </p>
            )}
            <p className="text-text-muted text-sm mb-4">
              {selectedVendas.length <= 5
                ? selectedVendas.map((v) => v.sale_code ?? v.id).join(', ')
                : `${selectedVendas.slice(0, 5).map((v) => v.sale_code ?? v.id).join(', ')} e mais ${selectedVendas.length - 5}…`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFaturarModal(false)}
                disabled={faturandoLote}
                className="px-4 py-2 rounded-lg border border-border bg-bg-card text-text-main hover:bg-bg-elevated disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmFaturarLote}
                disabled={faturandoLote}
                className="bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {faturandoLote ? 'Faturando…' : 'Confirmar faturamento'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {modalOpen && (
        <VendaModal
          onClose={handleCloseModal}
          vendaId={vendaEditando?.id}
          venda={vendaEditando ?? undefined}
          initialClienteId={clienteIdFromUrl}
          initialAgendamentoId={agendamentoIdFromUrl}
        />
      )}
      {detalheVenda && (
        <VendaDetalheModal
          venda={detalheVenda}
          onClose={() => setDetalheVenda(null)}
          onEdit={handleEditarVenda}
          onFechada={loadVendas}
        />
      )}
    </div>
  );
}

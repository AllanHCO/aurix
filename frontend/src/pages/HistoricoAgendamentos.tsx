import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface AgendamentoHist {
  id: string;
  nome_cliente: string;
  telefone_cliente: string;
  observacao: string | null;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  checkin_at: string | null;
  no_show: boolean;
}

type PeriodoPreset = 'hoje' | 'semana' | 'mes' | 'personalizado';
type StatusFiltro = 'all' | 'checkin' | 'pendente' | 'no_show' | 'cancelado';

function dataStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normData(a: AgendamentoHist): string {
  return typeof a.data === 'string' ? a.data.slice(0, 10) : dataStr(new Date(a.data));
}

function formatPhone(digits: string): string {
  const d = (digits || '').replace(/\D/g, '');
  if (d.length >= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length >= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits || '—';
}

function phoneForWhatsApp(digits: string): string {
  const d = (digits || '').replace(/\D/g, '');
  if (d.length >= 10) return '55' + d;
  return '';
}

function getPeriodoBounds(p: PeriodoPreset, inicioCustom?: string, fimCustom?: string): { inicio: string; fim: string } {
  const hoje = new Date();
  if (p === 'hoje') {
    const s = dataStr(hoje);
    return { inicio: s, fim: s };
  }
  if (p === 'semana') {
    const day = hoje.getDay();
    const seg = new Date(hoje);
    seg.setDate(hoje.getDate() - (day === 0 ? 6 : day - 1));
    const dom = new Date(seg);
    dom.setDate(seg.getDate() + 6);
    return { inicio: dataStr(seg), fim: dataStr(dom) };
  }
  if (p === 'mes') {
    const y = hoje.getFullYear();
    const m = hoje.getMonth();
    const primeiro = new Date(y, m, 1);
    const ultimo = new Date(y, m + 1, 0);
    return { inicio: dataStr(primeiro), fim: dataStr(ultimo) };
  }
  return {
    inicio: inicioCustom || dataStr(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    fim: fimCustom || dataStr(hoje)
  };
}

const STATUS_LABELS: Record<StatusFiltro, string> = {
  all: 'Todos',
  checkin: 'Check-in (compareceu)',
  pendente: 'Pendentes',
  no_show: 'No-show (não veio)',
  cancelado: 'Cancelados'
};

const LIMIT = 50;

export default function HistoricoAgendamentos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') || '';

  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('mes');
  const [inicioCustom, setInicioCustom] = useState('');
  const [fimCustom, setFimCustom] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('all');
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') || '');
  const [searchDebounced, setSearchDebounced] = useState(() => searchParams.get('q') || '');
  const [list, setList] = useState<AgendamentoHist[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalDetalhe, setModalDetalhe] = useState<AgendamentoHist | null>(null);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Sync search from URL when opening "Ver histórico deste cliente"
  useEffect(() => {
    if (qParam) {
      setSearchInput(qParam);
      setSearchDebounced(qParam);
    }
  }, [qParam]);

  const { inicio, fim } = getPeriodoBounds(periodoPreset, inicioCustom, fimCustom);

  const loadHistorico = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ list: AgendamentoHist[]; total: number; page: number; limit: number }>(
        '/agendamentos/historico',
        {
          params: {
            inicio,
            fim,
            status: statusFiltro,
            q: searchDebounced || undefined,
            page,
            limit: LIMIT
          }
        }
      );
      setList(res.data.list ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      toast.error('Erro ao carregar histórico');
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [inicio, fim, statusFiltro, searchDebounced, page]);

  useEffect(() => {
    loadHistorico();
  }, [loadHistorico]);

  const handleCheckin = async (id: string) => {
    try {
      await api.patch(`/agendamentos/${id}/checkin`);
      toast.success('Check-in registrado');
      loadHistorico();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Erro');
    }
  };

  const handleNoShow = async (id: string) => {
    try {
      await api.patch(`/agendamentos/${id}/no-show`);
      toast.success('Marcado como não compareceu');
      loadHistorico();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Erro');
    }
  };

  const isPastPlus30 = (a: AgendamentoHist) => {
    const d = normData(a);
    const [h, m] = a.hora_inicio.split(':').map(Number);
    const agendamentoMin = new Date(d + 'T12:00:00').setHours(h, m, 0, 0);
    return Date.now() > agendamentoMin + 30 * 60 * 1000;
  };

  const exportarCSV = () => {
    const rows = list;
    const headers = ['data', 'hora', 'cliente', 'telefone', 'status', 'checkin_at', 'no_show'];
    const escape = (v: string | number | boolean | null | undefined) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const line = (a: AgendamentoHist) =>
      [
        normData(a),
        a.hora_inicio,
        a.nome_cliente,
        a.telefone_cliente,
        a.no_show ? 'no_show' : a.checkin_at ? 'checkin' : a.status,
        a.checkin_at ? new Date(a.checkin_at).toISOString() : '',
        a.no_show ? 'sim' : 'não'
      ].map(escape).join(',');
    const csv = '\uFEFF' + headers.join(',') + '\n' + rows.map(line).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `historico_agendamentos_${inicio}_${fim}.csv`);
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  const statusBadge = (a: AgendamentoHist) => {
    if (a.status === 'CANCELADO')
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-badge-erro text-badge-erro-text">CANCELADO</span>;
    if (a.no_show)
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-badge-erro/80 text-badge-erro-text">NO-SHOW</span>;
    if (a.checkin_at)
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/20 text-success">CHECK-IN</span>;
    if (a.status === 'CONFIRMADO')
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-badge-pago text-badge-pago-text">CONFIRMADO</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-badge-pendente text-badge-pendente-text">PENDENTE</span>;
  };

  const totalPages = Math.ceil(total / LIMIT) || 1;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/agendamentos')}
            className="p-2 rounded-lg hover:bg-bg-elevated text-text-muted"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-2xl font-bold text-text-main">Histórico de Agendamentos</h1>
        </div>
        <button
          type="button"
          onClick={exportarCSV}
          disabled={list.length === 0}
          className="text-sm font-medium px-3 py-2 rounded-lg border border-border bg-bg-card hover:bg-bg-elevated text-text-main disabled:opacity-50 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">download</span>
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-bg-card p-4 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Período</label>
            <div className="flex flex-wrap gap-2">
              {(['hoje', 'semana', 'mes', 'personalizado'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodoPreset(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    periodoPreset === p ? 'bg-primary text-text-on-primary' : 'bg-bg-elevated text-text-muted hover:text-text-main'
                  }`}
                >
                  {p === 'hoje' ? 'Hoje' : p === 'semana' ? 'Semana' : p === 'mes' ? 'Mês' : 'Personalizado'}
                </button>
              ))}
            </div>
          </div>
          {periodoPreset === 'personalizado' && (
            <>
              <div>
                <label className="block text-xs text-text-muted mb-1">Início</label>
                <input
                  type="date"
                  value={inicioCustom}
                  onChange={(e) => setInicioCustom(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-input-border bg-input-bg text-text-main text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Fim</label>
                <input
                  type="date"
                  value={fimCustom}
                  onChange={(e) => setFimCustom(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-input-border bg-input-bg text-text-main text-sm"
                />
              </div>
            </>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">Status</label>
          <div className="flex flex-wrap gap-2">
            {(['all', 'checkin', 'pendente', 'no_show', 'cancelado'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFiltro(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  statusFiltro === s ? 'bg-primary text-text-on-primary' : 'bg-bg-elevated text-text-muted hover:text-text-main'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-md">
          <label className="block text-xs font-medium text-text-muted mb-1">Pesquisar por nome ou telefone</label>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Pesquisar por nome ou telefone…"
            className="w-full px-3 py-2 rounded-lg border border-input-border bg-input-bg text-text-main text-sm"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
        {loading ? (
          <p className="p-6 text-text-muted">Carregando…</p>
        ) : list.length === 0 ? (
          <p className="p-6 text-text-muted">Nenhum agendamento no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elevated">
                  <th className="text-left py-3 px-4 font-medium text-text-muted">Data</th>
                  <th className="text-left py-3 px-4 font-medium text-text-muted">Hora</th>
                  <th className="text-left py-3 px-4 font-medium text-text-muted">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-text-muted">Telefone</th>
                  <th className="text-left py-3 px-4 font-medium text-text-muted">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-text-muted">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-b border-border hover:bg-bg-elevated/50">
                    <td className="py-2 px-4 text-text-main">{new Date(normData(a) + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 px-4 text-text-main">{a.hora_inicio}</td>
                    <td className="py-2 px-4">
                      <button
                        type="button"
                        onClick={() => setModalDetalhe(a)}
                        className="font-medium text-text-main hover:underline text-left"
                      >
                        {a.nome_cliente}
                      </button>
                    </td>
                    <td className="py-2 px-4">
                      <span className="text-text-muted">{formatPhone(a.telefone_cliente ?? '')}</span>
                      {phoneForWhatsApp(a.telefone_cliente ?? '') && (
                        <a
                          href={`https://wa.me/${phoneForWhatsApp(a.telefone_cliente ?? '')}?text=${encodeURIComponent(`Oi ${a.nome_cliente.split(' ')[0]}! Confirmando seu horário no dia ${new Date(normData(a) + 'T12:00:00').toLocaleDateString('pt-BR')} às ${a.hora_inicio}. 😊`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 inline-flex text-[#25D366] hover:opacity-80"
                          title="WhatsApp"
                        >
                          <span className="material-symbols-outlined text-lg">chat</span>
                        </a>
                      )}
                    </td>
                    <td className="py-2 px-4">{statusBadge(a)}</td>
                    <td className="py-2 px-4 text-right">
                      <div className="flex flex-wrap gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => setModalDetalhe(a)}
                          className="text-xs px-2 py-1 rounded border border-border text-text-muted hover:bg-bg-elevated"
                        >
                          Detalhes
                        </button>
                        {a.status !== 'CANCELADO' && !a.checkin_at && !a.no_show && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCheckin(a.id)}
                              className="text-xs px-2 py-1 rounded bg-badge-pago text-badge-pago-text"
                            >
                              Check-in
                            </button>
                            <button
                              type="button"
                              onClick={() => handleNoShow(a.id)}
                              className={`text-xs px-2 py-1 rounded border ${isPastPlus30(a) ? 'bg-badge-erro/20 border-badge-erro text-badge-erro-text' : 'border-border text-text-muted hover:bg-bg-elevated'}`}
                            >
                              Não veio
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-text-muted">
            <span>
              {total} registro(s) — página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded border border-border disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded border border-border disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal detalhe */}
      {modalDetalhe && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'var(--color-overlay)' }}
          onClick={() => setModalDetalhe(null)}
        >
          <div
            className="bg-bg-elevated border border-border rounded-2xl shadow-xl max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-text-main mb-3">Agendamento</h3>
            <p className="text-sm text-text-muted mb-1">Data e horário</p>
            <p className="text-text-main font-medium mb-3">{new Date(normData(modalDetalhe) + 'T12:00:00').toLocaleDateString('pt-BR')} às {modalDetalhe.hora_inicio}</p>
            <p className="text-sm text-text-muted mb-1">Cliente</p>
            <p className="text-text-main font-medium mb-3">{modalDetalhe.nome_cliente}</p>
            <p className="text-sm text-text-muted mb-1">Telefone</p>
            <p className="text-text-main font-medium mb-3">{formatPhone(modalDetalhe.telefone_cliente ?? '')}</p>
            <p className="text-sm text-text-muted mb-1">Observação</p>
            <p className="text-text-main text-sm mb-4 whitespace-pre-wrap">{modalDetalhe.observacao?.trim() || 'Sem observação'}</p>
            <button
              type="button"
              onClick={() => setModalDetalhe(null)}
              className="w-full py-2 rounded-lg border border-border text-text-muted hover:bg-bg-elevated"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface Agendamento {
  id: string;
  nome_cliente: string;
  telefone_cliente: string;
  observacao: string | null;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  checkin_at?: string | null;
  no_show?: boolean;
}

type TabView = 'MENSAL' | 'SEMANAL' | 'DIÁRIO';

interface Resumo {
  totalHoje: number;
  pendentes: number;
  checkinsHoje?: number;
  noShowsHoje?: number;
  taxaOcupacao?: number;
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function dataStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normData(a: Agendamento): string {
  return typeof a.data === 'string' ? a.data.slice(0, 10) : dataStr(new Date(a.data));
}

/** Formata telefone só dígitos para exibição: (11) 99999-9999 ou (11) 9999-9999 */
function formatPhone(digits: string): string {
  const d = (digits || '').replace(/\D/g, '');
  if (d.length >= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length >= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits || '—';
}

/** Telefone só dígitos para wa.me (55 + DDD + número) */
function phoneForWhatsApp(digits: string): string {
  const d = (digits || '').replace(/\D/g, '');
  if (d.length >= 10) return '55' + d;
  return '';
}

export default function Agendamentos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vistaProximos3 = searchParams.get('vista') === 'proximos3';

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [, setProximos] = useState<Agendamento[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLoadingProximos] = useState(true);
  const [tabView, setTabView] = useState<TabView>('MENSAL');
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(() => dataStr(new Date()));
  const [agendamentosDoDia, setAgendamentosDoDia] = useState<Agendamento[]>([]);
  const [loadingDia, setLoadingDia] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'PENDENTE' | 'CONFIRMADO' | 'CANCELADO'>('todos');
  const [slug, setSlug] = useState<string | null>(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalCliente, setModalCliente] = useState<Agendamento | null>(null);

  const hojeStr = dataStr(new Date());
  const dataParaResumo = diaSelecionado || hojeStr;

  const loadMonth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Agendamento[]>('/agendamentos', { params: { ano, mes } });
      setAgendamentos(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Erro ao carregar agendamentos');
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  const loadProximos = useCallback(async (limitOverride?: number) => {
    setLoadingProximos(true);
    try {
      const limit = limitOverride ?? (vistaProximos3 ? 30 : 10);
      const res = await api.get<Agendamento[]>('/agendamentos/proximos', { params: { limit } });
      setProximos(Array.isArray(res.data) ? res.data : []);
    } catch {
      setProximos([]);
    } finally {
      setLoadingProximos(false);
    }
  }, [vistaProximos3]);

  const loadResumo = useCallback(async (data: string) => {
    try {
      const res = await api.get<Resumo>('/agendamentos/resumo', { params: { data } });
      setResumo(res.data);
    } catch {
      setResumo(null);
    }
  }, []);

  const loadSlug = useCallback(async () => {
    try {
      const res = await api.get<{ agenda_slug?: string }>('/agenda/slug');
      setSlug(res.data?.agenda_slug ?? null);
    } catch {
      setSlug(null);
    }
  }, []);

  const loadAgendamentosDoDia = useCallback(async (data: string) => {
    setLoadingDia(true);
    try {
      const res = await api.get<Agendamento[]>('/agendamentos/dia', { params: { data } });
      setAgendamentosDoDia(Array.isArray(res.data) ? res.data : []);
    } catch {
      setAgendamentosDoDia([]);
    } finally {
      setLoadingDia(false);
    }
  }, []);

  useEffect(() => {
    loadMonth();
    loadSlug();
  }, [loadMonth, loadSlug]);

  useEffect(() => {
    loadProximos();
  }, [loadProximos, vistaProximos3]);

  useEffect(() => {
    loadResumo(dataParaResumo);
  }, [dataParaResumo, loadResumo]);

  useEffect(() => {
    if (diaSelecionado) loadAgendamentosDoDia(diaSelecionado);
    else setAgendamentosDoDia([]);
  }, [diaSelecionado, loadAgendamentosDoDia]);

  const handleStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/agendamentos/${id}/status`, { status });
      toast.success('Status atualizado');
      loadMonth();
      loadProximos();
      if (diaSelecionado) {
        loadResumo(diaSelecionado);
        loadAgendamentosDoDia(diaSelecionado);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Erro ao atualizar');
    }
  };

  const refetchAll = () => {
    loadMonth();
    loadProximos();
    loadResumo(dataParaResumo);
    if (diaSelecionado) loadAgendamentosDoDia(diaSelecionado);
  };

  const handleCheckin = async (id: string) => {
    try {
      await api.patch(`/agendamentos/${id}/checkin`);
      toast.success('Check-in registrado');
      refetchAll();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Erro ao registrar check-in');
    }
  };

  const handleNoShow = async (id: string) => {
    try {
      await api.patch(`/agendamentos/${id}/no-show`);
      toast.success('Marcado como não compareceu');
      refetchAll();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Erro');
    }
  };

  /** Horário do agendamento já passou há mais de 30 min? (para destacar "Marcar no-show") */
  const isPastPlus30 = (a: Agendamento) => {
    const dataStrA = normData(a);
    const [h, m] = a.hora_inicio.split(':').map(Number);
    const agendamentoMin = new Date(dataStrA + 'T12:00:00').setHours(h, m, 0, 0);
    return Date.now() > agendamentoMin + 30 * 60 * 1000;
  };

  const listaFiltrada =
    filtroStatus === 'todos'
      ? agendamentosDoDia
      : agendamentosDoDia.filter((a) => a.status === filtroStatus);

  const statusBadge = (a: Agendamento) => {
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

  const publicUrl = slug ? `${window.location.origin}/agenda/${slug}` : '';
  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    toast.success('Link copiado');
  };

  const diasNoMes = new Date(ano, mes, 0).getDate();
  const primeiroDia = new Date(ano, mes - 1, 1).getDay();

  const agendamentosPorDia: Record<string, Agendamento[]> = {};
  agendamentos.forEach((a) => {
    const d = normData(a);
    if (!agendamentosPorDia[d]) agendamentosPorDia[d] = [];
    agendamentosPorDia[d].push(a);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* A) Header — ordem: Agenda | Tabs | (flex) | Histórico | Novo Agendamento | ⚙️ | 🚫 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:flex-nowrap">
        <div className="flex items-center gap-3 shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-main">Agenda</h1>
          <div className="flex rounded-lg border border-border bg-bg-elevated p-0.5">
            {(['MENSAL', 'SEMANAL', 'DIÁRIO'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTabView(tab)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  tabView === tab
                    ? 'bg-primary text-text-on-primary'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-nowrap shrink-0">
          <button
            type="button"
            onClick={() => navigate('/agendamentos/historico')}
            className="h-11 px-5 rounded-xl border border-border bg-bg-card text-text-main font-medium flex items-center gap-2 hover:bg-bg-elevated transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-xl">history</span>
            Histórico
          </button>
          <button
            type="button"
            onClick={() => setModalNovo(true)}
            className="h-11 px-6 rounded-xl bg-primary hover:bg-primary-hover text-text-on-primary font-medium flex items-center gap-2 shrink-0"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            Novo Agendamento
          </button>
          <button
            type="button"
            onClick={() => navigate('/configuracoes/agendamento')}
            title="Configurações"
            className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-border bg-bg-card text-text-muted hover:bg-bg-elevated hover:text-text-main transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-xl">settings</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/agendamentos/bloqueios')}
            title="Bloqueios"
            className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-border bg-bg-card text-text-muted hover:bg-bg-elevated hover:text-text-main transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-xl">block</span>
          </button>
        </div>
      </div>

      {/* B) Link Público */}
      {slug && (
        <div className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-sm font-medium text-text-muted uppercase tracking-wide">Link público:</span>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <code className="text-sm text-text-main truncate flex-1 bg-input-bg border border-input-border rounded px-2 py-1.5">
              {publicUrl}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 bg-primary hover:bg-primary-hover text-text-on-primary font-medium px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">content_copy</span>
              Copiar
            </button>
          </div>
        </div>
      )}

      {/* C) Cards de métricas (dia selecionado) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-bg-card p-4 shadow-sm">
          <span className="material-symbols-outlined text-text-muted text-2xl">event</span>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted mt-1">Agendados (dia)</p>
          <p className="text-2xl font-bold text-text-main mt-0.5">{resumo?.totalHoje ?? '—'}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4 shadow-sm">
          <span className="material-symbols-outlined text-text-muted text-2xl">check_circle</span>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted mt-1">Check-ins (dia)</p>
          <p className="text-2xl font-bold text-text-main mt-0.5">{resumo?.checkinsHoje ?? '—'}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-4 shadow-sm">
          <span className="material-symbols-outlined text-text-muted text-2xl">cancel_presentation</span>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted mt-1">No-shows (dia)</p>
          <p className="text-2xl font-bold text-text-main mt-0.5">{resumo?.noShowsHoje ?? '—'}</p>
        </div>
      </div>

      {/* D) Duas colunas: calendário + próximos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda: calendário */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <button
                type="button"
                onClick={() => {
                  if (mes <= 1) {
                    setMes(12);
                    setAno((a) => a - 1);
                  } else setMes((m) => m - 1);
                }}
                className="p-2 rounded-lg hover:bg-bg-elevated text-text-main"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="font-semibold text-text-main capitalize">
                {MESES[mes - 1]} {ano}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (mes >= 12) {
                    setMes(1);
                    setAno((a) => a + 1);
                  } else setMes((m) => m + 1);
                }}
                className="p-2 rounded-lg hover:bg-bg-elevated text-text-main"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
            <div className="p-4">
              {loading && (
                <p className="text-sm text-text-muted mb-2">Carregando calendário...</p>
              )}
              <div className="flex gap-4 mb-3 text-xs">
                <span className="flex items-center gap-1.5 text-text-muted">
                  <span className="w-2 h-2 rounded-full bg-badge-pendente-text" /> Pendente
                </span>
                <span className="flex items-center gap-1.5 text-text-muted">
                  <span className="w-2 h-2 rounded-full bg-success" /> Confirmado
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-text-muted py-1">
                    {d}
                  </div>
                ))}
                {Array.from({ length: primeiroDia }, (_, i) => (
                  <div key={`e-${i}`} className="min-h-[80px] sm:min-h-[90px]" />
                ))}
                {Array.from({ length: diasNoMes }, (_, i) => {
                  const day = i + 1;
                  const dataStrDay = `${ano}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const list = agendamentosPorDia[dataStrDay] || [];
                  const isSelected = diaSelecionado === dataStrDay;
                  const isToday = dataStrDay === hojeStr;
                  return (
                    <button
                      key={dataStrDay}
                      type="button"
                      onClick={() => setDiaSelecionado(dataStrDay)}
                      className={`min-h-[80px] sm:min-h-[90px] rounded-lg p-1.5 text-left flex flex-col border transition-colors ${
                        isSelected
                          ? 'bg-primary/20 ring-2 ring-primary text-text-main'
                          : isToday
                            ? 'ring-1 ring-primary/50 text-text-main'
                            : 'hover:bg-bg-elevated text-text-main border-transparent'
                      }`}
                    >
                      <span className="text-sm font-medium">{day}</span>
                      <div className="flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                        {list.slice(0, 2).map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalCliente(a);
                            }}
                            className={`truncate text-[10px] px-1 py-0.5 rounded w-full text-left hover:opacity-90 ${
                              a.no_show ? 'bg-badge-erro/80 text-badge-erro-text' : a.checkin_at ? 'bg-success/20 text-success' : a.status === 'CONFIRMADO' ? 'bg-badge-pago text-badge-pago-text' : 'bg-badge-pendente text-badge-pendente-text'
                            }`}
                            title={`${a.nome_cliente} - ${a.hora_inicio}`}
                          >
                            {a.nome_cliente.split(' ')[0]} - {a.hora_inicio}
                          </button>
                        ))}
                        {list.length > 2 && (
                          <span className="text-[10px] text-text-muted px-1">+ {list.length - 2} mais</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Coluna direita: Lista do dia selecionado + filtros */}
        <div className="rounded-xl border border-border bg-bg-elevated shadow-sm flex flex-col max-h-[600px] lg:max-h-none">
          <h2 className="p-4 border-b border-border font-semibold text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">schedule</span>
            {diaSelecionado
              ? `Agendamentos — ${new Date(diaSelecionado + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}`
              : 'Selecione um dia'}
          </h2>
          {diaSelecionado && (
            <div className="px-4 py-2 border-b border-border flex flex-wrap gap-2">
              {(['todos', 'PENDENTE', 'CONFIRMADO', 'CANCELADO'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltroStatus(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    filtroStatus === f
                      ? 'bg-primary text-text-on-primary'
                      : 'bg-bg-card text-text-muted hover:bg-bg-elevated'
                  }`}
                >
                  {f === 'todos' ? 'Todos' : f === 'PENDENTE' ? 'Pendentes' : f === 'CONFIRMADO' ? 'Confirmados' : 'Cancelados'}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!diaSelecionado ? (
              <p className="text-sm text-text-muted">Clique em um dia no calendário para ver os agendamentos.</p>
            ) : loadingDia ? (
              <p className="text-sm text-text-muted">Carregando...</p>
            ) : listaFiltrada.length === 0 ? (
              <p className="text-sm text-text-muted">
                {filtroStatus === 'todos' ? 'Nenhum agendamento neste dia.' : `Nenhum agendamento ${filtroStatus === 'PENDENTE' ? 'pendente' : filtroStatus === 'CONFIRMADO' ? 'confirmado' : 'cancelado'}.`}
              </p>
            ) : (
              listaFiltrada.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-border bg-bg-card p-3 text-sm"
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    {statusBadge(a)}
                    <span className="text-text-muted font-medium">{a.hora_inicio}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setModalCliente(a)}
                      className="font-semibold text-text-main text-left hover:underline focus:outline-none focus:underline"
                    >
                      {a.nome_cliente}
                    </button>
                    {phoneForWhatsApp(a.telefone_cliente ?? '') && (
                      <a
                        href={`https://wa.me/${phoneForWhatsApp(a.telefone_cliente ?? '')}?text=${encodeURIComponent(`Oi ${a.nome_cliente.split(' ')[0]}! Confirmando seu horário ${diaSelecionado === hojeStr ? 'hoje' : 'no dia'} às ${a.hora_inicio}. 😊`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded bg-[#25D366] text-white hover:opacity-90"
                        title="WhatsApp rápido"
                      >
                        <span className="material-symbols-outlined text-lg">chat</span>
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {a.status !== 'CANCELADO' && !a.checkin_at && !a.no_show && (
                      <button
                        type="button"
                        onClick={() => handleCheckin(a.id)}
                        className="text-xs font-medium px-2 py-1 rounded bg-badge-pago text-badge-pago-text hover:bg-badge-pago/80"
                      >
                        Check-in
                      </button>
                    )}
                    {a.status !== 'CANCELADO' && !a.checkin_at && !a.no_show && (
                      <button
                        type="button"
                        onClick={() => handleNoShow(a.id)}
                        className={`text-xs font-medium px-2 py-1 rounded border ${isPastPlus30(a) ? 'bg-badge-erro/20 border-badge-erro text-badge-erro-text' : 'border-border text-text-muted hover:bg-bg-elevated'}`}
                      >
                        Marcar não veio
                      </button>
                    )}
                    {a.status === 'PENDENTE' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatus(a.id, 'CONFIRMADO')}
                          className="text-xs font-medium px-2 py-1 rounded bg-badge-pendente text-badge-pendente-text hover:bg-badge-pendente/80"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatus(a.id, 'CANCELADO')}
                          className="text-xs font-medium px-2 py-1 rounded border border-border text-text-muted hover:bg-bg-elevated"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal detalhe do cliente (ao clicar no nome) */}
      {modalCliente && (
        <ModalDetalheCliente
          agendamento={modalCliente}
          onClose={() => setModalCliente(null)}
          formatPhone={formatPhone}
          phoneForWhatsApp={phoneForWhatsApp}
          normData={normData}
        />
      )}

      {/* Modal Novo Agendamento Manual */}
      {modalNovo && (
        <ModalNovoAgendamento
          diaInicial={diaSelecionado ?? undefined}
          onClose={() => setModalNovo(false)}
          onSuccess={() => {
            setModalNovo(false);
            refetchAll();
            toast.success('Agendamento criado');
          }}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      )}
    </div>
  );
}

interface ModalDetalheClienteProps {
  agendamento: Agendamento;
  onClose: () => void;
  formatPhone: (d: string) => string;
  phoneForWhatsApp: (d: string) => string;
  normData: (a: Agendamento) => string;
}

function ModalDetalheCliente({ agendamento, onClose, formatPhone, phoneForWhatsApp, normData }: ModalDetalheClienteProps) {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tel = agendamento.telefone_cliente ?? '';
  const wa = phoneForWhatsApp(tel);
  const dataFormatada = normData(agendamento);
  const dataHoraStr = `${dataFormatada} às ${agendamento.hora_inicio}`;

  const handleCopyPhone = () => {
    if (!tel) return;
    const digits = tel.replace(/\D/g, '');
    navigator.clipboard.writeText(digits).then(() => toast.success('Telefone copiado'));
  };

  const handleVerHistorico = () => {
    const q = (tel && tel.replace(/\D/g, '').length >= 4) ? tel.replace(/\D/g, '') : agendamento.nome_cliente;
    onClose();
    navigate(`/agendamentos/historico?q=${encodeURIComponent(q)}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--color-overlay)' }}
      onClick={onClose}
    >
      <div
        className="bg-bg-elevated border border-border-soft rounded-2xl shadow-xl max-w-sm w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-text-main mb-3">Dados do agendamento</h3>
        <p className="text-sm text-text-muted mb-1">Data e horário</p>
        <p className="text-text-main font-medium mb-3">{dataHoraStr}</p>
        <p className="text-sm text-text-muted mb-1">Nome</p>
        <p className="text-text-main font-medium mb-3">{agendamento.nome_cliente}</p>
        <p className="text-sm text-text-muted mb-1">Telefone</p>
        <p className="text-text-main font-medium mb-3">{formatPhone(tel)}</p>
        <p className="text-sm text-text-muted mb-1">Observação</p>
        <p className="text-text-main text-sm mb-4 whitespace-pre-wrap">
          {agendamento.observacao?.trim() || 'Sem observação'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyPhone}
            disabled={!tel}
            className="text-sm font-medium px-3 py-2 rounded-lg bg-bg-card border border-border text-text-main hover:bg-bg-elevated disabled:opacity-50"
          >
            Copiar telefone
          </button>
          {wa && (
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium px-3 py-2 rounded-lg bg-[#25D366] text-white hover:opacity-90"
            >
              Abrir WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={handleVerHistorico}
            className="text-sm font-medium px-3 py-2 rounded-lg border border-primary text-primary hover:bg-primary/10"
          >
            Ver histórico deste cliente
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-sm text-text-muted hover:text-text-main"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

interface ModalNovoProps {
  diaInicial?: string;
  onClose: () => void;
  onSuccess: () => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
}

function ModalNovoAgendamento({ diaInicial, onClose, onSuccess, submitting, setSubmitting }: ModalNovoProps) {
  const [data, setData] = useState(diaInicial ?? '');
  const [hora_inicio, setHoraInicio] = useState('');
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<Array<{ hora_inicio: string; hora_fim: string }>>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [nome_cliente, setNomeCliente] = useState('');
  const [telefone_cliente, setTelefoneCliente] = useState('');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (diaInicial && !data) setData(diaInicial);
  }, [diaInicial, data]);

  useEffect(() => {
    if (!data) {
      setHorariosDisponiveis([]);
      setHoraInicio('');
      return;
    }
    setLoadingHorarios(true);
    setHoraInicio('');
    api
      .get<{ horarios: Array<{ hora_inicio: string; hora_fim: string }> }>('/agendamentos/horarios-disponiveis', { params: { data } })
      .then((r) => {
        setHorariosDisponiveis(r.data.horarios ?? []);
      })
      .catch(() => {
        setHorariosDisponiveis([]);
      })
      .finally(() => setLoadingHorarios(false));
  }, [data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!data || !hora_inicio || !nome_cliente.trim() || !telefone_cliente.trim()) {
      toast.error('Preencha data, horário, nome e telefone.');
      return;
    }
    if (telefone_cliente.replace(/\D/g, '').length < 10) {
      toast.error('Telefone deve ter pelo menos 10 dígitos.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/agendamentos', {
        data,
        hora_inicio,
        nome_cliente: nome_cliente.trim(),
        telefone_cliente: telefone_cliente.replace(/\D/g, '').trim(),
        observacao: observacao.trim() || undefined
      });
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || 'Erro ao criar agendamento');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-overlay)' }} onClick={onClose}>
      <div
        className="bg-bg-elevated border border-border-soft rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-text-main mb-4">Novo Agendamento</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Data</label>
            <input
              type="date"
              required
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input-border bg-input-bg text-text-main"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Horário disponível</label>
            {!data ? (
              <p className="text-sm text-text-muted">Selecione a data primeiro.</p>
            ) : loadingHorarios ? (
              <p className="text-sm text-text-muted">Carregando horários...</p>
            ) : horariosDisponiveis.length === 0 ? (
              <p className="text-sm text-text-muted">Nenhum horário disponível neste dia (bloqueios ou fora do período).</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {horariosDisponiveis.map((h) => (
                  <button
                    key={h.hora_inicio}
                    type="button"
                    onClick={() => setHoraInicio(h.hora_inicio)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${
                      hora_inicio === h.hora_inicio
                        ? 'bg-primary text-text-on-primary'
                        : 'bg-bg-elevated text-text-main border border-border hover:border-primary/30'
                    }`}
                  >
                    {h.hora_inicio}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Nome do cliente</label>
            <input
              type="text"
              required
              minLength={2}
              value={nome_cliente}
              onChange={(e) => setNomeCliente(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input-border bg-input-bg text-text-main"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Telefone</label>
            <input
              type="tel"
              required
              value={telefone_cliente}
              onChange={(e) => setTelefoneCliente(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input-border bg-input-bg text-text-main"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Observação (opcional)</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-input-border bg-input-bg text-text-main resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-text-main hover:bg-bg-elevated">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !hora_inicio || loadingHorarios}
              className="px-4 py-2 rounded-lg bg-primary text-text-on-primary font-medium hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

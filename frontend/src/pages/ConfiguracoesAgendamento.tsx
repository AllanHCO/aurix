import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface DisponibilidadeItem {
  dia_semana: number;
  ativo: boolean;
  hora_inicio: string;
  hora_fim: string;
}

interface ConfigPayload {
  duracao_slot_min: number;
  antecedencia_min_dias: number;
  buffer_min: number;
  limite_maximo_dias?: number;
  servico_padrao_nome?: string | null;
  disponibilidade: DisponibilidadeItem[];
  agenda_slug: string | null;
}

interface Bloqueio {
  id: string;
  tipo: string;
  dia_semana: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
}

const DIAS_LABELS: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado'
};

const DURACAO_OPCOES = [30, 60, 90, 120];

export default function ConfiguracoesAgendamento() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [slugInput, setSlugInput] = useState('');
  const [config, setConfig] = useState<ConfigPayload | null>(null);
  const [snapshot, setSnapshot] = useState<ConfigPayload | null>(null);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [modalBloqueio, setModalBloqueio] = useState(false);

  const load = useCallback(async () => {
    try {
      const [configRes, bloqueiosRes, slugRes] = await Promise.all([
        api.get<ConfigPayload & { hora_inicio_funcionamento?: string; hora_fim_funcionamento?: string }>('/configuracoes/agendamento'),
        api.get<Bloqueio[]>('/bloqueios'),
        api.get<{ agenda_slug: string | null }>('/empresas/slug').catch(() => ({ data: { agenda_slug: null } }))
      ]);
      const d = configRes.data.disponibilidade ?? [];
      const payload: ConfigPayload = {
        duracao_slot_min: configRes.data.duracao_slot_min ?? 30,
        antecedencia_min_dias: configRes.data.antecedencia_min_dias ?? 2,
        buffer_min: configRes.data.buffer_min ?? 10,
        limite_maximo_dias: configRes.data.limite_maximo_dias ?? 30,
        servico_padrao_nome: configRes.data.servico_padrao_nome ?? null,
        disponibilidade: [1, 2, 3, 4, 5, 6].map((dia) => {
          const row = d.find((r: DisponibilidadeItem) => r.dia_semana === dia);
          return row ?? { dia_semana: dia, ativo: false, hora_inicio: '08:00', hora_fim: '18:00' };
        }),
        agenda_slug: slugRes.data?.agenda_slug ?? configRes.data.agenda_slug ?? null
      };
      setConfig(payload);
      setSnapshot(JSON.parse(JSON.stringify(payload)));
      const resolvedSlug = slugRes.data?.agenda_slug ?? configRes.data.agenda_slug ?? null;
      setSlug(resolvedSlug);
      setSlugInput(resolvedSlug ?? '');
      setBloqueios(Array.isArray(bloqueiosRes.data) ? bloqueiosRes.data : []);
    } catch {
      toast.error('Erro ao carregar configurações');
      setConfig(null);
      setSnapshot(null);
      setBloqueios([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const displaySlug = slugInput.trim() || slug || '';
  const publicLink = displaySlug ? `${window.location.origin}/agenda/${displaySlug}` : '';
  const copyLink = () => {
    if (!publicLink) return;
    navigator.clipboard.writeText(publicLink);
    toast.success('Link copiado');
  };

  const handleDescartar = () => {
    if (snapshot) setConfig(JSON.parse(JSON.stringify(snapshot)));
    setSlugInput(slug ?? '');
    toast.success('Alterações descartadas');
  };

  const handleSalvar = async () => {
    if (!config) return;
    for (const d of config.disponibilidade) {
      if (d.ativo) {
        const [hi, mi] = d.hora_inicio.split(':').map(Number);
        const [hf, mf] = d.hora_fim.split(':').map(Number);
        if (hi * 60 + mi >= hf * 60 + mf) {
          toast.error(`${DIAS_LABELS[d.dia_semana]}: horário de início deve ser antes do fim`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const slugChanged = slugInput.trim() && slugInput.trim() !== (slug ?? '');
      if (slugChanged) {
        const slugRes = await api.put<{ agenda_slug: string }>('/empresas/slug', { slug: slugInput.trim() });
        setSlug(slugRes.data.agenda_slug);
        setSlugInput(slugRes.data.agenda_slug);
        if (config) setConfig((c) => (c ? { ...c, agenda_slug: slugRes.data.agenda_slug } : c));
        if (snapshot) setSnapshot((s) => (s ? { ...s, agenda_slug: slugRes.data.agenda_slug } : s));
      }
      await api.put('/configuracoes/agendamento', {
        duracao_slot_min: config.duracao_slot_min,
        antecedencia_min_dias: config.antecedencia_min_dias,
        buffer_min: config.buffer_min,
        servico_padrao_nome: config.servico_padrao_nome ?? null,
        disponibilidade: config.disponibilidade
      });
      setSnapshot(JSON.parse(JSON.stringify(config)));
      toast.success('Salvo com sucesso');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string }; status?: number } };
      toast.error(e.response?.data?.error || (e.response?.status === 409 ? 'Este endereço já está em uso. Escolha outro.' : 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBloqueio = async (id: string) => {
    if (!confirm('Remover este bloqueio?')) return;
    try {
      await api.delete(`/bloqueios/${id}`);
      toast.success('Bloqueio removido');
      setBloqueios((prev) => prev.filter((b) => b.id !== id));
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const updateDisponibilidade = (dia_semana: number, patch: Partial<DisponibilidadeItem>) => {
    setConfig((c) =>
      c
        ? {
            ...c,
            disponibilidade: c.disponibilidade.map((d) =>
              d.dia_semana === dia_semana ? { ...d, ...patch } : d
            )
          }
        : c
    );
  };

  const resetDia = (dia_semana: number) => {
    updateDisponibilidade(dia_semana, { ativo: false, hora_inicio: '08:00', hora_fim: '18:00' });
  };

  if (loading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center text-text-muted">
        Carregando...
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-text-main">
        <p>Não foi possível carregar as configurações.</p>
        <button type="button" onClick={() => load()} className="mt-2 text-primary hover:underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Cabeçalho (não fixo ao rolar) */}
      <div className="-mx-4 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 bg-background-light border-b border-border-light flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <nav className="text-sm text-text-muted mb-1 flex items-center gap-1 flex-wrap">
            <Link to="/dashboard" className="hover:text-text-main">Home</Link>
            <span>›</span>
            <Link to="/configuracoes" className="hover:text-text-main">Configurações</Link>
            <span>›</span>
            <span className="text-text-main">Agendamento</span>
            <button
              type="button"
              onClick={() => navigate('/configuracoes')}
              className="ml-2 text-xs text-text-muted hover:text-text-main flex items-center gap-0.5"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar
            </button>
          </nav>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main">Configurações de Agendamento</h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDescartar}
            className="px-4 py-2 rounded-lg border border-border-light bg-surface-light text-text-main hover:bg-surface-elevated font-medium"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-text-on-primary font-medium hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* Seção 1 — Link público */}
      <div className="rounded-xl border border-border-light bg-surface-light shadow-sm overflow-hidden">
        <div className="flex">
          <div className="w-1 bg-primary shrink-0" />
          <div className="p-4 sm:p-6 flex-1 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Seu link público de agendamento
            </h2>
            <p className="text-sm text-text-muted">
              O link completo que seus clientes usam para agendar. Você pode alterar o apelido (slug) abaixo.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicLink || ''}
                placeholder={!displaySlug ? 'Carregando...' : ''}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-border-light bg-input-bg text-text-main text-sm placeholder:text-text-muted"
              />
              <button
                type="button"
                onClick={copyLink}
                disabled={!publicLink}
                className="p-2 rounded-lg border border-border-light hover:bg-surface-elevated text-text-main shrink-0 disabled:opacity-50"
                title="Copiar link"
              >
                <span className="material-symbols-outlined">content_copy</span>
              </button>
              <a
                href={publicLink || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg border border-border-light hover:bg-surface-elevated text-text-main shrink-0"
                title="Abrir página"
              >
                <span className="material-symbols-outlined">open_in_new</span>
              </a>
            </div>
            <div className="pt-2 border-t border-border-light">
              <label className="block text-xs font-medium text-text-muted mb-1" htmlFor="slug-input">Apelido do link (slug)</label>
              <input
                id="slug-input"
                type="text"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                placeholder="ex: minha-empresa"
                className="w-full max-w-xs px-3 py-2 rounded-lg border border-border-light bg-input-bg text-text-main text-sm placeholder:text-text-muted"
              />
              <p className="text-xs text-text-muted mt-1">Altere o apelido e use &quot;Salvar Alterações&quot; no topo da página.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid principal: 2 col + 1 col */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Esquerda (2 col): Dias e Horários */}
        <div className="lg:col-span-2 rounded-xl border border-border-light bg-surface-light shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-text-main">Dias e Horários de Atendimento</h2>
              <p className="text-sm text-text-muted">Defina sua disponibilidade semanal</p>
            </div>
            <span className="material-symbols-outlined text-text-muted">schedule</span>
          </div>
          <ul className="space-y-3">
            {config.disponibilidade.map((d) => (
              <li
                key={d.dia_semana}
                className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border-light hover:bg-surface-elevated/50 transition-colors"
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={d.ativo}
                  onClick={() => updateDisponibilidade(d.dia_semana, { ativo: !d.ativo })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    d.ativo ? 'bg-success' : 'bg-border-light'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface-light shadow transition-transform ${
                      d.ativo ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="w-24 text-sm font-medium text-text-main">{DIAS_LABELS[d.dia_semana]}</span>
                {d.ativo ? (
                  <>
                    <input
                      type="time"
                      value={d.hora_inicio}
                      onChange={(e) => updateDisponibilidade(d.dia_semana, { hora_inicio: e.target.value })}
                      className="px-2 py-1.5 rounded border border-border-light bg-input-bg text-text-main text-sm"
                    />
                    <span className="text-text-muted text-sm">até</span>
                    <input
                      type="time"
                      value={d.hora_fim}
                      onChange={(e) => updateDisponibilidade(d.dia_semana, { hora_fim: e.target.value })}
                      className="px-2 py-1.5 rounded border border-border-light bg-input-bg text-text-main text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => resetDia(d.dia_semana)}
                      className="p-1.5 rounded text-text-muted hover:bg-badge-erro/20 hover:text-error"
                      title="Fechar dia"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-text-muted">Fechado</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Direita (1 col): Parâmetros + Regras */}
        <div className="space-y-6">
          {/* Parâmetros de Tempo */}
          <div className="rounded-xl border border-border-light bg-surface-light shadow-sm p-6">
            <h2 className="text-lg font-semibold text-text-main mb-1">Parâmetros de Tempo</h2>
            <p className="text-sm text-text-muted mb-4">Controle o ritmo da sua agenda</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1">
                  Duração do slot
                </label>
                <select
                  value={config.duracao_slot_min}
                  onChange={(e) => setConfig((c) => c ? { ...c, duracao_slot_min: Number(e.target.value) } : c)}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-input-bg text-text-main"
                >
                  {DURACAO_OPCOES.map((m) => (
                    <option key={m} value={m}>
                      {m} minutos
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1">
                  Antecedência (lead time)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={config.antecedencia_min_dias}
                    onChange={(e) =>
                      setConfig((c) => c ? { ...c, antecedencia_min_dias: Number(e.target.value) } : c)
                    }
                    className="w-20 px-3 py-2 rounded-lg border border-border-light bg-input-bg text-text-main"
                  />
                  <span className="text-sm text-text-muted">dias</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1">
                  Intervalo entre agendamentos
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={config.buffer_min}
                    onChange={(e) => setConfig((c) => c ? { ...c, buffer_min: Number(e.target.value) } : c)}
                    className="w-20 px-3 py-2 rounded-lg border border-border-light bg-input-bg text-text-main"
                  />
                  <span className="text-sm text-text-muted">min</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1">
                  Nome do serviço padrão (página pública)
                </label>
                <input
                  type="text"
                  value={config.servico_padrao_nome ?? ''}
                  onChange={(e) => setConfig((c) => c ? { ...c, servico_padrao_nome: e.target.value || null } : c)}
                  placeholder="ex: Corte de Cabelo & Barba"
                  maxLength={200}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-input-bg text-text-main"
                />
              </div>
            </div>
          </div>

          {/* Regras de Bloqueio */}
          <div className="rounded-xl border border-border-light bg-surface-light shadow-sm p-6">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-text-main">Regras de Bloqueio</h2>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-badge-erro text-badge-erro-text">
                NOVO
              </span>
            </div>
            <p className="text-sm text-text-muted mb-4">Bloqueie datas ou horários específicos</p>
            {bloqueios.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">Nenhum bloqueio ativo no momento.</p>
            ) : (
              <ul className="space-y-2 mb-4">
                {bloqueios.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-surface-elevated border border-border-light"
                  >
                    <span className="text-sm text-text-main truncate">
                      {b.tipo === 'RECORRENTE' && (
                        <>{(['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'])[b.dia_semana ?? 0]} {b.hora_inicio} – {b.hora_fim}</>
                      )}
                      {b.tipo === 'INTERVALO_DATA' && (
                        <>
                          {b.data_inicio?.slice(0, 10)} até {b.data_fim?.slice(0, 10)}
                          {b.hora_inicio ? ` ${b.hora_inicio}–${b.hora_fim}` : ' Dia inteiro'}
                        </>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteBloqueio(b.id)}
                      className="p-1 rounded text-text-muted hover:bg-badge-erro/20 hover:text-error shrink-0"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setModalBloqueio(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-text-on-primary font-medium hover:bg-primary-hover"
            >
              <span className="material-symbols-outlined">add</span>
              Novo Intervalo
            </button>
          </div>
        </div>
      </div>

      {modalBloqueio && (
        <ModalNovoBloqueio
          onClose={() => setModalBloqueio(false)}
          onSuccess={(b) => {
            setModalBloqueio(false);
            setBloqueios((prev) => [...prev, b]);
            toast.success('Bloqueio criado');
          }}
        />
      )}
    </div>
  );
}

function ModalNovoBloqueio({
  onClose,
  onSuccess
}: {
  onClose: () => void;
  onSuccess: (b: Bloqueio) => void;
}) {
  const [tipo, setTipo] = useState<'RECORRENTE' | 'INTERVALO_DATA'>('INTERVALO_DATA');
  const [dia_semana, setDiaSemana] = useState(1);
  const [hora_inicio, setHoraInicio] = useState('08:00');
  const [hora_fim, setHoraFim] = useState('12:00');
  const [data_inicio, setDataInicio] = useState('');
  const [data_fim, setDataFim] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (tipo === 'RECORRENTE') {
        const res = await api.post<Bloqueio>('/bloqueios', {
          tipo: 'RECORRENTE',
          dia_semana,
          hora_inicio,
          hora_fim
        });
        onSuccess(res.data);
      } else {
        if (!data_inicio || !data_fim) {
          toast.error('Informe data início e fim');
          setSubmitting(false);
          return;
        }
        const res = await api.post<Bloqueio>('/bloqueios', {
          tipo: 'INTERVALO_DATA',
          data_inicio,
          data_fim
        });
        onSuccess(res.data);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || 'Erro ao criar bloqueio');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-surface-light border border-border-light rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-text-main mb-4">Novo Intervalo</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as 'RECORRENTE' | 'INTERVALO_DATA')}
              className="w-full px-3 py-2 rounded-lg border border-border-light bg-input-bg text-text-main"
            >
              <option value="INTERVALO_DATA">Por data (intervalo)</option>
              <option value="RECORRENTE">Recorrente (dia da semana)</option>
            </select>
          </div>
          {tipo === 'RECORRENTE' && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Dia da semana</label>
                <select
                  value={dia_semana}
                  onChange={(e) => setDiaSemana(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-input-bg text-text-main"
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <option key={d} value={d}>
                      {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Hora início</label>
                  <input
                    type="time"
                    value={hora_inicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-input-bg text-text-main"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Hora fim</label>
                  <input
                    type="time"
                    value={hora_fim}
                    onChange={(e) => setHoraFim(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-input-bg text-text-main"
                  />
                </div>
              </div>
            </>
          )}
          {tipo === 'INTERVALO_DATA' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Data início</label>
                <input
                  type="date"
                  value={data_inicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-input-bg text-text-main"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Data fim</label>
                <input
                  type="date"
                  value={data_fim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-input-bg text-text-main"
                />
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border-light text-text-main hover:bg-surface-elevated">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-primary text-text-on-primary font-medium hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

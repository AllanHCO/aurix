import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface Branding {
  empresaId: string;
  nomeOrganizacao: string;
  nomeUnidade?: string;
  logoUrl?: string;
  corPrimariaHex?: string;
  statusOperacao?: string;
}

interface PublicConfig {
  nomeOrganizacao: string;
  nomeUnidade?: string;
  duracao_slot_min: number;
  buffer_min: number;
  antecedencia_min_dias: number;
  limite_maximo_dias: number;
  servico_padrao_nome?: string;
}

const BRAND_PRIMARY_FALLBACK = '#2563eb';
const OBSERVACAO_MAX = 500;

/** Sanitiza texto: trim e remove tags/scripts. */
function sanitizeObservacao(s: string): string {
  return s
    .trim()
    .replace(/<[^>]*>/g, '')
    .slice(0, OBSERVACAO_MAX);
}
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export default function AgendaPublica() {
  const { slug } = useParams<{ slug: string }>();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);
  const [brandingError, setBrandingError] = useState(false);
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [mes, setMes] = useState(() => new Date().getMonth() + 1);
  const [dias, setDias] = useState<string[]>([]);
  const [diasMes, setDiasMes] = useState<Array<{ data: string; status: 'DISPONIVEL' | 'INDISPONIVEL'; motivo?: string }>>([]);
  const [loadingDias, setLoadingDias] = useState(false);
  const [horarios, setHorarios] = useState<Array<{ hora_inicio: string; hora_fim: string }>>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [dataEscolhida, setDataEscolhida] = useState('');
  const [horaEscolhida, setHoraEscolhida] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sucesso, setSucesso] = useState<{
    whatsappUrl?: string;
    whatsapp_url?: string;
    data?: string;
    hora_inicio?: string;
    mensagem?: string;
  } | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setBrandingError(false);
    const opts = { timeout: 65000 };
    const urlBranding = `/public/agenda/${slug}/branding`;
    const urlConfig = `/public/agenda/${slug}/public-config`;
    Promise.all([
      api.get<Branding>(urlBranding, opts),
      api.get<PublicConfig>(urlConfig, opts).catch((e) => {
        console.warn('[AgendaPublica] public-config falhou (usando defaults):', urlConfig, e.response?.status, e.response?.data?.error || e.message);
        return null;
      })
    ])
      .then(([brandRes, configRes]) => {
        if (cancelled) return;
        setBranding(brandRes.data);
        setPublicConfig(configRes?.data ?? null);
        document.title = `Agendamento - ${brandRes.data.nomeOrganizacao}`;
        if (process.env.NODE_ENV === 'development') console.log('[AgendaPublica] branding + config OK para slug:', slug);
      })
      .catch((err: { response?: { status: number; data?: { error?: string } }; message?: string }) => {
        if (!cancelled) {
          console.error('[AgendaPublica] Falha ao carregar agenda:', urlBranding, 'status:', err.response?.status, 'erro:', err.response?.data?.error || err.message);
          setBranding(null);
          setPublicConfig(null);
          setBrandingError(true);
          document.title = 'Agendamento';
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  // Timeout alto para aguardar backend acordar (ex.: Render free tier)
  const PUBLIC_AGENDA_TIMEOUT = 65000;

  useEffect(() => {
    if (!slug) return;
    setLoadingDias(true);
    api
      .get<{ ano: number; mes: number; dias: Array<{ data: string; status: 'DISPONIVEL' | 'INDISPONIVEL'; temBloqueios?: boolean; motivo?: string }> }>(
        `/public/agenda/${slug}/mes`,
        { params: { ano, mes }, timeout: PUBLIC_AGENDA_TIMEOUT }
      )
      .then((r) => {
        const lista = r.data.dias || [];
        setDiasMes(lista);
        setDias(lista.filter((d) => d.status === 'DISPONIVEL').map((d) => d.data));
      })
      .catch(() => {
        setDiasMes([]);
        setDias([]);
        toast.error('Não foi possível carregar os dias disponíveis.');
      })
      .finally(() => setLoadingDias(false));
  }, [slug, ano, mes]);

  // Prefetch próximo mês (aquece cache do backend)
  useEffect(() => {
    if (!slug) return;
    const t = setTimeout(() => {
      const nextMes = mes === 12 ? 1 : mes + 1;
      const nextAno = mes === 12 ? ano + 1 : ano;
      api.get(`/public/agenda/${slug}/mes`, { params: { ano: nextAno, mes: nextMes }, timeout: 65000 }).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [slug, ano, mes]);

  useEffect(() => {
    if (!slug || !dataEscolhida) {
      setHorarios([]);
      return;
    }
    setLoadingHorarios(true);
    api.get<{ horarios: Array<{ hora_inicio: string; hora_fim: string }> }>(`/public/agenda/${slug}/horarios`, { params: { data: dataEscolhida }, timeout: PUBLIC_AGENDA_TIMEOUT })
      .then((r) => setHorarios(r.data.horarios || []))
      .catch((err: { response?: { data?: { error?: string }; status?: number } }) => {
        setHorarios([]);
        if (err.response?.status === 400 && err.response?.data?.error) {
          toast.error(err.response.data.error);
        }
      })
      .finally(() => setLoadingHorarios(false));
  }, [slug, dataEscolhida]);

  const diasSet = useMemo(() => new Set(dias), [dias]);

  const handleSelectDay = (dataStr: string) => {
    if (!diasSet.has(dataStr)) return;
    setDataEscolhida(dataStr);
    setHoraEscolhida('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTrim = nome.trim();
    const telDigits = telefone.replace(/\D/g, '');
    if (!slug || !dataEscolhida || !horaEscolhida || nomeTrim.length < 2 || telDigits.length < 10) {
      toast.error('Preencha nome (mín. 2 caracteres), telefone (mín. 10 dígitos), data e horário.');
      return;
    }
    if (observacao.trim().length > OBSERVACAO_MAX) {
      toast.error(`Observação deve ter no máximo ${OBSERVACAO_MAX} caracteres.`);
      return;
    }
    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID?.() ?? `ag-${Date.now()}`;
      const res = await api.post(
        `/public/agenda/${slug}/agendamentos`,
        {
          data: dataEscolhida,
          hora_inicio: horaEscolhida,
          nome_cliente: nomeTrim,
          telefone_cliente: telDigits,
          observacao: observacao ? sanitizeObservacao(observacao) || undefined : undefined
        },
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
      const data = res.data as {
        whatsappUrl?: string;
        whatsapp_url?: string;
        mensagem?: string;
        message?: string;
        agendamento?: { data?: string; hora_inicio?: string };
      };
      const ag = data.agendamento;
      setSucesso({
        whatsappUrl: data.whatsappUrl ?? data.whatsapp_url,
        whatsapp_url: data.whatsapp_url ?? data.whatsappUrl,
        data: ag?.data ?? dataEscolhida,
        hora_inicio: ag?.hora_inicio ?? horaEscolhida,
        mensagem: data.mensagem ?? data.message
      });
      toast.success(data.mensagem ?? data.message ?? 'Agendamento solicitado!');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      toast.error(ax.response?.data?.error || 'Erro ao agendar');
    } finally {
      setSubmitting(false);
    }
  };

  const brandColor = branding?.corPrimariaHex || BRAND_PRIMARY_FALLBACK;
  const wrapperStyle = { ['--brand-primary' as string]: brandColor } as React.CSSProperties;
  const nomeExibicao = branding?.nomeOrganizacao ?? publicConfig?.nomeOrganizacao ?? 'Agendamento';
  const unidadeOuOrg = branding?.nomeUnidade ?? publicConfig?.nomeUnidade ?? nomeExibicao;
  const anoAtual = new Date().getFullYear();

  const config = publicConfig ?? { duracao_slot_min: 30, buffer_min: 0, antecedencia_min_dias: 0, limite_maximo_dias: 30, servico_padrao_nome: undefined };
  const antecedenciaDias = publicConfig?.antecedencia_min_dias ?? 0;
  const diasPorData = useMemo(() => {
    const m = new Map<string, { status: string; motivo?: string }>();
    diasMes.forEach((d) => m.set(d.data, { status: d.status, motivo: d.motivo }));
    return m;
  }, [diasMes]);
  const horaFimCalculada = dataEscolhida && horaEscolhida ? addMinutesToTime(horaEscolhida, config.duracao_slot_min) : '';
  const dataPorExtenso = dataEscolhida
    ? new Date(dataEscolhida + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  const podeConfirmar = Boolean(
    dataEscolhida && horaEscolhida && nome.trim().length >= 2 && telefone.replace(/\D/g, '').length >= 10
  );

  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const celulasCalendario = useMemo(() => {
    const v: { type: 'empty' | 'day'; day?: number; dataStr?: string; disponivel: boolean }[] = [];
    for (let i = 0; i < primeiroDiaSemana; i++) v.push({ type: 'empty', disponivel: false });
    for (let day = 1; day <= ultimoDia; day++) {
      const dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      v.push({ type: 'day', day, dataStr, disponivel: diasSet.has(dataStr) });
    }
    return v;
  }, [ano, mes, primeiroDiaSemana, ultimoDia, diasSet]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main text-text-muted p-4">
        <div className="animate-pulse space-y-4 w-full max-w-md">
          <div className="h-8 bg-surface-elevated rounded w-3/4" />
          <div className="h-32 bg-surface-elevated rounded" />
          <div className="h-24 bg-surface-elevated rounded" />
        </div>
      </div>
    );
  }
  if (brandingError || !branding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-main p-6">
        <p className="text-text-main text-center text-lg mb-2">Link de agendamento inválido ou desativado.</p>
        <p className="text-text-muted text-center text-sm mb-6 max-w-sm">
          Verifique o endereço ou entre em contato com o estabelecimento para obter o link correto.
        </p>
        {typeof window !== 'undefined' && window.location.origin.includes('localhost') && slug && (
          <p className="text-text-muted text-xs mb-4">Slug acessado: &quot;{slug}&quot;</p>
        )}
      </div>
    );
  }

  if (sucesso) {
    const whatsappUrl = sucesso.whatsappUrl ?? sucesso.whatsapp_url;
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main p-4" style={wrapperStyle}>
        <div className="bg-bg-card rounded-xl border border-border shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-[var(--color-text-on-primary)]" style={{ backgroundColor: brandColor }}>
            <span className="material-symbols-outlined text-3xl">check</span>
          </div>
          <h1 className="text-xl font-bold text-text-main mb-2">Agendamento solicitado!</h1>
          <p className="text-text-muted text-sm mb-4">
            {sucesso.data && sucesso.hora_inicio && (
              <> {new Date(sucesso.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} às {sucesso.hora_inicio} </>
            )}
          </p>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-success hover:bg-success/90 text-text-on-primary font-medium px-5 py-3 rounded-lg"
            >
              Enviar via WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main p-4 sm:p-6" style={wrapperStyle}>
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="" className="w-10 h-10 rounded-lg object-contain" />
            ) : (
              <span className="material-symbols-outlined text-3xl" style={{ color: brandColor }}>diamond</span>
            )}
            <h1 className="text-2xl font-bold text-text-main">{nomeExibicao}</h1>
          </div>
          {(branding.nomeUnidade ?? publicConfig?.nomeUnidade) && (
            <p className="text-text-muted text-sm">{branding.nomeUnidade ?? publicConfig?.nomeUnidade}</p>
          )}
          {branding.statusOperacao && (
            <p className="text-text-muted text-xs mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              {branding.statusOperacao}
            </p>
          )}
          <p className="text-text-muted text-sm mt-2">Selecione o dia e horário de sua preferência.</p>
        </header>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna esquerda: Calendário mensal */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-border bg-bg-card shadow-sm overflow-hidden">
              <h2 className="text-lg font-semibold text-text-main p-4 pb-2">Selecione a Data</h2>
              <div className="flex items-center justify-between px-4 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    if (mes <= 1) { setMes(12); setAno((a) => a - 1); } else setMes((m) => m - 1);
                  }}
                  className="p-2 rounded-lg hover:bg-surface-elevated text-text-main"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <span className="font-medium text-text-main capitalize">{MESES[mes - 1]} {ano}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (mes >= 12) { setMes(1); setAno((a) => a + 1); } else setMes((m) => m + 1);
                  }}
                  className="p-2 rounded-lg hover:bg-surface-elevated text-text-main"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
              {loadingDias ? (
                <div className="p-4 grid grid-cols-7 gap-1 animate-pulse">
                  {Array.from({ length: 35 }, (_, i) => (
                    <div key={i} className="aspect-square rounded-lg bg-surface-elevated" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-1 px-4 pb-2">
                    {DIAS_SEMANA.map((d) => (
                      <div key={d} className="text-center text-xs font-medium text-text-muted py-1">
                        {d}
                      </div>
                    ))}
                    {celulasCalendario.map((c, i) => {
                      if (c.type === 'empty') {
                        return <div key={`e-${i}`} className="aspect-square" />;
                      }
                      const dataStr = c.dataStr!;
                      const selecionado = dataEscolhida === dataStr;
                      const info = diasPorData.get(dataStr);
                      const tooltipIndisponivel =
                        !c.disponivel && info?.motivo === 'FORA_DA_ANTECEDENCIA' && antecedenciaDias > 0
                          ? `Precisa de ${antecedenciaDias} dias de antecedência`
                          : !c.disponivel
                            ? 'Indisponível'
                            : undefined;
                      return (
                        <button
                          key={dataStr}
                          type="button"
                          disabled={!c.disponivel}
                          onClick={() => handleSelectDay(dataStr)}
                          title={tooltipIndisponivel}
                          className={`aspect-square rounded-lg text-sm font-medium flex items-center justify-center ${
                            selecionado
                              ? 'text-text-on-primary'
                              : c.disponivel
                                ? 'bg-surface-elevated text-text-main hover:ring-2 ring-offset-2 ring-offset-surface-light'
                                : 'bg-surface-elevated/50 text-text-muted cursor-not-allowed opacity-60'
                          }`}
                          style={selecionado ? { backgroundColor: brandColor } : c.disponivel ? {} : undefined}
                        >
                          {c.day}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-3 px-4 py-3 border-t border-border text-xs text-text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandColor }} />
                      Selecionado
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-surface-elevated border border-border" />
                      Disponível
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-surface-elevated/50 opacity-60" />
                      Indisponível
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Coluna direita: Horários, Resumo, Form, CTA */}
          <div className="lg:col-span-2 space-y-4">
            {/* Horários disponíveis */}
            <div className="rounded-xl border border-border bg-bg-card shadow-sm p-4">
              <h2 className="text-lg font-semibold text-text-main mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-xl">schedule</span>
                Horários disponíveis
              </h2>
              {!dataEscolhida ? (
                <p className="text-text-muted text-sm">Selecione um dia no calendário.</p>
              ) : loadingHorarios ? (
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="w-14 h-9 rounded-lg bg-surface-elevated animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-text-muted text-sm mb-3">{dataPorExtenso}</p>
                  {horarios.length === 0 ? (
                    <p className="text-text-muted text-sm">Nenhum horário disponível para este dia.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {horarios.map((h) => (
                        <button
                          key={h.hora_inicio}
                          type="button"
                          onClick={() => setHoraEscolhida(h.hora_inicio)}
                          className={`py-2 rounded-lg text-sm font-medium ${
                            horaEscolhida === h.hora_inicio ? 'text-text-on-primary' : 'bg-surface-elevated text-text-main border border-border hover:border-primary/30'
                          }`}
                          style={horaEscolhida === h.hora_inicio ? { backgroundColor: brandColor } : undefined}
                        >
                          {h.hora_inicio}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Resumo da seleção */}
            {dataEscolhida && horaEscolhida && (
              <div className="rounded-xl border border-border bg-bg-card shadow-sm p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg" style={{ color: brandColor }}>check_circle</span>
                  Resumo da seleção
                </h2>
                {config.servico_padrao_nome && (
                  <p className="text-text-main font-medium mb-1">{config.servico_padrao_nome}</p>
                )}
                <p className="text-text-main">{dataPorExtenso} às {horaEscolhida}</p>
                <p className="text-text-muted text-sm mt-1">Duração: {config.duracao_slot_min} minutos</p>
                <p className="text-text-muted text-sm">Hora fim: {horaFimCalculada}</p>
                {config.buffer_min > 0 && (
                  <p className="text-text-tertiary text-xs mt-1">Intervalo entre atendimentos: {config.buffer_min} min</p>
                )}
              </div>
            )}

            {/* Seus dados */}
            <div className="rounded-xl border border-border bg-bg-card shadow-sm p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-2">Seus dados</h2>
              <p className="text-text-muted text-sm mb-4">Preencha para confirmar seu agendamento na unidade {unidadeOuOrg}.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Nome completo *</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    minLength={2}
                    required
                    placeholder="Seu nome"
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-bg text-text-main"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Telefone / WhatsApp *</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))}
                    required
                    placeholder="11999999999"
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-bg text-text-main"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Observação (opcional)</label>
                  <textarea
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value.slice(0, OBSERVACAO_MAX))}
                    rows={2}
                    maxLength={OBSERVACAO_MAX}
                    placeholder="Alguma observação?"
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-bg text-text-main resize-none"
                  />
                  <p className="text-xs text-text-muted mt-0.5">{observacao.length}/{OBSERVACAO_MAX}</p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !podeConfirmar}
              className="w-full font-bold py-4 rounded-xl disabled:opacity-50 text-text-on-primary flex items-center justify-center gap-2 text-lg"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? (
                'Enviando...'
              ) : (
                <>
                  Confirmar agendamento
                  <span className="material-symbols-outlined">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </form>

        <footer className="mt-8 pt-6 border-t border-border text-center text-text-muted text-sm">
          <p>© {anoAtual} {nomeExibicao}</p>
          <p className="text-[10px] opacity-70 mt-1">Powered by Aurix</p>
        </footer>
      </div>
    </div>
  );
}

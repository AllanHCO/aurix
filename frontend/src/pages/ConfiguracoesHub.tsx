import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const SLUG_REGEX = /^[a-z0-9-]+$/;
const DEFAULT_MSG_ATENCAO = 'Olá {NOME}! Tudo bem? Faz {DIAS} dias que você não aparece. Quer marcar um horário essa semana? 🙂';
const DEFAULT_MSG_INATIVO = 'Olá {NOME}! Tudo bem? Faz {DIAS} dias que você não aparece. Posso te ajudar a agendar um horário? 🙂';

interface ConfigResponse {
  empresa: { slug: string | null; link_preview: string | null };
  retencao: { dias_atencao: number; dias_inativo: number };
  mensagens: {
    msg_whatsapp_atencao: string;
    msg_whatsapp_inativo: string;
    msg_whatsapp_pos_venda: string | null;
    msg_whatsapp_confirmacao_agenda: string | null;
    msg_whatsapp_lembrete_agenda: string | null;
  };
  agendamentos: { configurado: boolean };
  plano: {
    plano: string;
    trial_ends_at: string | null;
    is_active: boolean;
    blocked_reason: string | null;
  };
  meta: { meta_faturamento_mes: number | null };
}

export default function ConfiguracoesHub() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ConfigResponse | null>(null);

  const [slug, setSlug] = useState('');
  const [diasAtencao, setDiasAtencao] = useState(30);
  const [diasInativo, setDiasInativo] = useState(45);
  const [msgAtencao, setMsgAtencao] = useState(DEFAULT_MSG_ATENCAO);
  const [msgInativo, setMsgInativo] = useState(DEFAULT_MSG_INATIVO);
  const [msgPosVenda, setMsgPosVenda] = useState('');
  const [msgConfirmacaoAgenda, setMsgConfirmacaoAgenda] = useState('');
  const [msgLembreteAgenda, setMsgLembreteAgenda] = useState('');
  const [plano, setPlano] = useState<string>('FREE');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [blockedReason, setBlockedReason] = useState('');
  const [metaFaturamentoMes, setMetaFaturamentoMes] = useState<number | ''>('');

  const [slugError, setSlugError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<ConfigResponse>('/configuracoes');
      const d = res.data;
      setData(d);
      setSlug(d.empresa.slug ?? '');
      setDiasAtencao(d.retencao.dias_atencao);
      setDiasInativo(d.retencao.dias_inativo);
      setMsgAtencao(d.mensagens.msg_whatsapp_atencao ?? DEFAULT_MSG_ATENCAO);
      setMsgInativo(d.mensagens.msg_whatsapp_inativo ?? DEFAULT_MSG_INATIVO);
      setMsgPosVenda(d.mensagens.msg_whatsapp_pos_venda ?? '');
      setMsgConfirmacaoAgenda(d.mensagens.msg_whatsapp_confirmacao_agenda ?? '');
      setMsgLembreteAgenda(d.mensagens.msg_whatsapp_lembrete_agenda ?? '');
      setPlano(d.plano.plano ?? 'FREE');
      setTrialEndsAt(d.plano.trial_ends_at ?? '');
      setIsActive(d.plano.is_active ?? true);
      setBlockedReason(d.plano.blocked_reason ?? '');
      setMetaFaturamentoMes(d.meta?.meta_faturamento_mes ?? '');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const validateSlug = (value: string): string | null => {
    const v = value.trim().toLowerCase();
    if (!v) return null;
    if (v.length > 120) return 'Máximo 120 caracteres.';
    if (!SLUG_REGEX.test(v)) return 'Use apenas letras minúsculas, números e hífen.';
    return null;
  };

  const getLinkPreview = () => {
    const v = slug.trim().toLowerCase();
    if (!v) return null;
    if (validateSlug(v)) return null;
    const base = window.location.origin.replace(/\/$/, '');
    return `${base}/agenda/${v}`;
  };

  const handleSave = async () => {
    const err = slug.trim() ? validateSlug(slug) : null;
    if (err) {
      setSlugError(err);
      toast.error(err);
      return;
    }
    if (diasAtencao >= diasInativo) {
      toast.error('Dias para Atenção deve ser menor que Dias para Inativo.');
      return;
    }
    if (diasAtencao < 1 || diasAtencao > 365 || diasInativo < 1 || diasInativo > 365) {
      toast.error('Dias devem estar entre 1 e 365.');
      return;
    }
    setSlugError(null);
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        retencao: { dias_atencao: diasAtencao, dias_inativo: diasInativo },
        mensagens: {
          msg_whatsapp_atencao: msgAtencao.trim() || null,
          msg_whatsapp_inativo: msgInativo.trim() || null,
          msg_whatsapp_pos_venda: msgPosVenda.trim() || null,
          msg_whatsapp_confirmacao_agenda: msgConfirmacaoAgenda.trim() || null,
          msg_whatsapp_lembrete_agenda: msgLembreteAgenda.trim() || null
        },
        plano: {
          plano: plano as 'FREE' | 'TRIAL' | 'PAID',
          trial_ends_at: trialEndsAt.trim() || null,
          is_active: isActive,
          blocked_reason: blockedReason.trim() || null
        }
      };
      if (slug.trim()) payload.empresa = { slug: slug.trim().toLowerCase() };
      payload.meta = { meta_faturamento_mes: metaFaturamentoMes === '' ? null : Number(metaFaturamentoMes) };
      await api.put('/configuracoes', payload);
      toast.success('Configurações salvas com sucesso.');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center py-12">
        <span className="text-text-muted">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-main">Configurações</h1>
        <p className="text-text-muted mt-1">Regras do sistema por empresa. Altere e salve ao final.</p>
      </header>

      {/* 1. Empresa */}
      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6">
        <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">business</span>
          Empresa
        </h2>
        <p className="text-sm text-text-muted mt-1 mb-4">Link público para seus clientes agendarem.</p>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-main">Slug da empresa</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
              setSlugError(null);
            }}
            placeholder="minha-empresa"
            className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {slugError && <p className="text-sm text-red-500">{slugError}</p>}
          {getLinkPreview() && (
            <p className="text-sm text-text-muted">
              Preview: <a href={getLinkPreview()!} target="_blank" rel="noopener noreferrer" className="text-primary underline">{getLinkPreview()}</a>
            </p>
          )}
        </div>
      </section>

      {/* 2. Retenção */}
      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6">
        <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">trending_up</span>
          Retenção de Clientes
        </h2>
        <p className="text-sm text-text-muted mt-1 mb-4">Define quando o cliente entra em “Atenção” e “Inativo” no Dashboard e na lista de clientes.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Dias para Atenção</label>
            <input
              type="number"
              min={1}
              max={365}
              value={diasAtencao}
              onChange={(e) => setDiasAtencao(Number(e.target.value) || 30)}
              className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Dias para Inativo</label>
            <input
              type="number"
              min={1}
              max={365}
              value={diasInativo}
              onChange={(e) => setDiasInativo(Number(e.target.value) || 45)}
              className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
            />
          </div>
        </div>
        <p className="text-xs text-text-muted mt-2">Atenção deve ser menor que Inativo. Valores entre 1 e 365.</p>
      </section>

      {/* Meta de faturamento (mensal) */}
      <section className="rounded-2xl border border-border bg-bg-card shadow-sm hover:shadow-md transition-shadow p-6">
        <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">savings</span>
          Meta de faturamento
        </h2>
        <p className="text-sm text-text-muted mt-1 mb-4">Meta mensal em R$ usada no Dashboard para a barra de progresso do faturamento.</p>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Meta de faturamento (R$ mensal)</label>
          <input
            type="number"
            min={0}
            step={100}
            value={metaFaturamentoMes}
            onChange={(e) => setMetaFaturamentoMes(e.target.value === '' ? '' : Number(e.target.value) || 0)}
            placeholder="Ex: 50000"
            className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted"
          />
        </div>
      </section>

      {/* 3. Mensagens WhatsApp */}
      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6">
        <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">chat</span>
          Mensagens WhatsApp
        </h2>
        <p className="text-sm text-text-muted mt-1 mb-2">Templates usados nos botões de WhatsApp (Clientes). Variáveis: {'{NOME}'}, {'{DIAS}'}, {'{DATA}'}, {'{HORA}'}. Vazio = usa texto padrão.</p>
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Mensagem para Atenção</label>
            <textarea
              value={msgAtencao}
              onChange={(e) => setMsgAtencao(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted resize-y"
              placeholder={DEFAULT_MSG_ATENCAO}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Mensagem para Inativo</label>
            <textarea
              value={msgInativo}
              onChange={(e) => setMsgInativo(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted resize-y"
              placeholder={DEFAULT_MSG_INATIVO}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Mensagem pós-venda (opcional)</label>
            <textarea
              value={msgPosVenda}
              onChange={(e) => setMsgPosVenda(e.target.value)}
              rows={2}
              placeholder="Ex: Olá {NOME}! Como foi sua última visita?"
              className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Mensagem confirmação agendamento</label>
            <textarea
              value={msgConfirmacaoAgenda}
              onChange={(e) => setMsgConfirmacaoAgenda(e.target.value)}
              rows={2}
              placeholder="Ex: Olá {NOME}! Seu horário foi confirmado para {DATA} às {HORA}."
              className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Mensagem lembrete agendamento (opcional)</label>
            <textarea
              value={msgLembreteAgenda}
              onChange={(e) => setMsgLembreteAgenda(e.target.value)}
              rows={2}
              placeholder="Ex: Olá {NOME}! Lembrete: seu horário é amanhã às {HORA}."
              className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted resize-y"
            />
          </div>
        </div>
      </section>

      {/* 4. Agendamentos */}
      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6">
        <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">schedule</span>
          Agendamentos
        </h2>
        <p className="text-sm text-text-muted mt-1 mb-4">
          Dias da semana, horários, duração do slot, buffer, antecedência e bloqueios.
        </p>
        <Link
          to="/configuracoes/agendamento"
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-[var(--color-text-on-primary)] px-4 py-2 text-sm font-medium hover:bg-primary/90"
        >
          Abrir configuração de agendamento
          <span className="material-symbols-outlined text-lg">arrow_forward</span>
        </Link>
        {data?.agendamentos.configurado && (
          <p className="text-sm text-green-600 mt-2">Agenda já configurada.</p>
        )}
      </section>

      {/* 5. Segurança e Limites */}
      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6">
        <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">shield</span>
          Segurança e Limites
        </h2>
        <div className="text-sm text-text-muted mt-2 space-y-2">
          <p>• <strong>Rate limit:</strong> Endpoints públicos (agendamento) e sensíveis (login) possuem limite de requisições para evitar abuso.</p>
          <p>• <strong>Anti-duplo clique:</strong> O backend usa idempotência e locks onde necessário para evitar ações duplicadas.</p>
          <p>• <strong>Validações:</strong> Apenas campos esperados são aceitos; há sanitização e verificação de ownership por empresa em todas as rotas protegidas.</p>
        </div>
      </section>

      {/* 6. Plano / Cobrança */}
      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6">
        <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">payments</span>
          Plano / Cobrança
        </h2>
        <p className="text-sm text-text-muted mt-1 mb-4">Preparado para futura integração de cobrança. Não implemente gateway de pagamento aqui.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Plano</label>
            <select
              value={plano}
              onChange={(e) => setPlano(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
            >
              <option value="FREE">FREE</option>
              <option value="TRIAL">TRIAL</option>
              <option value="PAID">PAID</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Trial termina em (AAAA-MM-DD)</label>
            <input
              type="date"
              value={trialEndsAt}
              onChange={(e) => setTrialEndsAt(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="is_active" className="text-sm text-text-main">Assinatura ativa (PAID)</label>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-text-main mb-1">Motivo do bloqueio (exibido ao usuário)</label>
            <input
              type="text"
              value={blockedReason}
              onChange={(e) => setBlockedReason(e.target.value)}
              placeholder="Ex: Assinatura vencida."
              className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted"
            />
          </div>
        </div>
      </section>

      {/* Salvar */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary text-[var(--color-text-on-primary)] px-6 py-2.5 font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? 'Salvando...' : 'Salvar configurações'}
          <span className="material-symbols-outlined text-lg">save</span>
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import ToggleSwitch from '../../components/ToggleSwitch';

const DEFAULT_MSG_ATENCAO = 'Olá {NOME}! Tudo bem? Faz {DIAS} dias que você não aparece. Quer marcar um horário essa semana? 🙂';
const DEFAULT_MSG_INATIVO = 'Olá {NOME}! Tudo bem? Faz {DIAS} dias que você não aparece. Posso te ajudar a agendar um horário? 🙂';

interface ConfigResponse {
  mensagens: {
    msg_whatsapp_atencao: string;
    msg_whatsapp_inativo: string;
    msg_whatsapp_pos_venda: string | null;
    msg_whatsapp_confirmacao_agenda: string | null;
    msg_whatsapp_lembrete_agenda: string | null;
  };
}

interface PersonalizacaoModulos {
  marketing: { mostrar_clientes_inativos: boolean; mostrar_receita_em_risco: boolean; mostrar_recuperacao_clientes: boolean };
  [key: string]: unknown;
}

export default function ConfiguracaoMarketing() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msgAtencao, setMsgAtencao] = useState(DEFAULT_MSG_ATENCAO);
  const [msgInativo, setMsgInativo] = useState(DEFAULT_MSG_INATIVO);
  const [msgPosVenda, setMsgPosVenda] = useState('');
  const [msgConfirmacaoAgenda, setMsgConfirmacaoAgenda] = useState('');
  const [msgLembreteAgenda, setMsgLembreteAgenda] = useState('');
  const [mostrarClientesInativos, setMostrarClientesInativos] = useState(true);
  const [mostrarReceitaEmRisco, setMostrarReceitaEmRisco] = useState(true);
  const [mostrarRecuperacaoClientes, setMostrarRecuperacaoClientes] = useState(true);

  const load = useCallback(async () => {
    try {
      const [configRes, persRes] = await Promise.all([
        api.get<ConfigResponse>('/configuracoes'),
        api.get<{ modulos: PersonalizacaoModulos }>('/configuracoes/personalizacao')
      ]);
      const m = configRes.data.mensagens;
      setMsgAtencao(m.msg_whatsapp_atencao ?? DEFAULT_MSG_ATENCAO);
      setMsgInativo(m.msg_whatsapp_inativo ?? DEFAULT_MSG_INATIVO);
      setMsgPosVenda(m.msg_whatsapp_pos_venda ?? '');
      setMsgConfirmacaoAgenda(m.msg_whatsapp_confirmacao_agenda ?? '');
      setMsgLembreteAgenda(m.msg_whatsapp_lembrete_agenda ?? '');
      const mk = persRes.data.modulos.marketing;
      setMostrarClientesInativos(mk.mostrar_clientes_inativos);
      setMostrarReceitaEmRisco(mk.mostrar_receita_em_risco);
      setMostrarRecuperacaoClientes(mk.mostrar_recuperacao_clientes);
    } catch {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/configuracoes', {
        mensagens: {
          msg_whatsapp_atencao: msgAtencao.trim() || null,
          msg_whatsapp_inativo: msgInativo.trim() || null,
          msg_whatsapp_pos_venda: msgPosVenda.trim() || null,
          msg_whatsapp_confirmacao_agenda: msgConfirmacaoAgenda.trim() || null,
          msg_whatsapp_lembrete_agenda: msgLembreteAgenda.trim() || null
        }
      });
      const persRes = await api.get<{ modo: string; modulos: PersonalizacaoModulos }>('/configuracoes/personalizacao');
      const { modo, modulos } = persRes.data;
      await api.put('/configuracoes/personalizacao', {
        modo,
        modulos: {
          ...modulos,
          marketing: {
            ...modulos.marketing,
            mostrar_clientes_inativos: mostrarClientesInativos,
            mostrar_receita_em_risco: mostrarReceitaEmRisco,
            mostrar_recuperacao_clientes: mostrarRecuperacaoClientes
          }
        }
      });
      toast.success('Configurações salvas.');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-text-muted">Carregando...</div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link to="/configuracoes" className="hover:text-text-main">Configurações</Link>
        <span>/</span>
        <span className="text-text-main">Marketing</span>
      </div>
      <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">campaign</span>
        Marketing
      </h1>
      <p className="text-text-muted">Templates WhatsApp e exibição de reativação no Dashboard.</p>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <h3 className="font-medium text-text-main">Templates WhatsApp</h3>
        <p className="text-xs text-text-muted">Variáveis: {'{NOME}'}, {'{DIAS}'}, {'{DATA}'}, {'{HORA}'}. Vazio = texto padrão.</p>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Mensagem para Atenção</label>
          <textarea value={msgAtencao} onChange={(e) => setMsgAtencao(e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main resize-y" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Mensagem para Inativo</label>
          <textarea value={msgInativo} onChange={(e) => setMsgInativo(e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main resize-y" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Mensagem pós-venda (opcional)</label>
          <textarea value={msgPosVenda} onChange={(e) => setMsgPosVenda(e.target.value)} rows={2} placeholder="Ex: Olá {NOME}! Como foi sua última visita?" className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted resize-y" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Confirmação de agendamento</label>
          <textarea value={msgConfirmacaoAgenda} onChange={(e) => setMsgConfirmacaoAgenda(e.target.value)} rows={2} placeholder="Ex: Olá {NOME}! Confirmado para {DATA} às {HORA}." className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted resize-y" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Lembrete de agendamento (opcional)</label>
          <textarea value={msgLembreteAgenda} onChange={(e) => setMsgLembreteAgenda(e.target.value)} rows={2} placeholder="Ex: Lembrete: amanhã às {HORA}." className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted resize-y" />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <h3 className="font-medium text-text-main">Exibição no Dashboard</h3>
        <ToggleSwitch checked={mostrarClientesInativos} onChange={setMostrarClientesInativos} label="Exibir clientes inativos" />
        <ToggleSwitch checked={mostrarReceitaEmRisco} onChange={setMostrarReceitaEmRisco} label="Exibir receita em risco" />
        <ToggleSwitch checked={mostrarRecuperacaoClientes} onChange={setMostrarRecuperacaoClientes} label="Exibir recuperação de clientes" />
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-primary text-[var(--color-text-on-primary)] px-6 py-2.5 font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
          {saving ? 'Salvando...' : 'Salvar'}
          <span className="material-symbols-outlined text-lg">save</span>
        </button>
      </div>
    </div>
  );
}

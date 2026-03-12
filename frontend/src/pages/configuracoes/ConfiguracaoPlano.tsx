import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import ToggleSwitch from '../../components/ToggleSwitch';

interface ConfigResponse {
  plano: {
    plano: string;
    trial_ends_at: string | null;
    is_active: boolean;
    blocked_reason: string | null;
  };
}

export default function ConfiguracaoPlano() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plano, setPlano] = useState('FREE');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [blockedReason, setBlockedReason] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get<ConfigResponse>('/configuracoes');
      setPlano(res.data.plano.plano ?? 'FREE');
      setTrialEndsAt(res.data.plano.trial_ends_at ?? '');
      setIsActive(res.data.plano.is_active ?? true);
      setBlockedReason(res.data.plano.blocked_reason ?? '');
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
        plano: {
          plano: plano as 'FREE' | 'TRIAL' | 'PAID',
          trial_ends_at: trialEndsAt.trim() || null,
          is_active: isActive,
          blocked_reason: blockedReason.trim() || null
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

  if (loading) return <div className="max-w-2xl mx-auto py-12 text-text-muted">Carregando...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link to="/configuracoes" className="hover:text-text-main">Configurações</Link>
        <span>/</span>
        <span className="text-text-main">Plano / Cobrança</span>
      </div>
      <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">payments</span>
        Plano / Cobrança
      </h1>
      <p className="text-text-muted">Status da assinatura e trial (preparado para integração de cobrança).</p>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Plano atual</label>
          <select value={plano} onChange={(e) => setPlano(e.target.value)} className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main">
            <option value="FREE">FREE</option>
            <option value="TRIAL">TRIAL</option>
            <option value="PAID">PAID</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Trial termina em (AAAA-MM-DD)</label>
          <input type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)} className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main" />
        </div>
        <ToggleSwitch checked={isActive} onChange={setIsActive} label="Assinatura ativa" />
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Motivo do bloqueio (exibido ao usuário)</label>
          <input type="text" value={blockedReason} onChange={(e) => setBlockedReason(e.target.value)} placeholder="Ex: Assinatura vencida." className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted" />
        </div>
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

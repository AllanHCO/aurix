import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { usePersonalizacao } from '../contexts/PersonalizacaoContext';
import SearchableSelect from '../components/SearchableSelect';
import ThemeToggle from '../components/ThemeToggle';

export default function OnboardingNicho() {
  const navigate = useNavigate();
  const { config, loading, refetch } = usePersonalizacao();
  const [nichoId, setNichoId] = useState('');
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loadingNichos, setLoadingNichos] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ nichos: { id: string; label: string }[] }>('/configuracoes/nichos-negocio');
        if (!cancelled) {
          setOptions(
            (res.data.nichos ?? []).map((n) => ({
              value: n.id,
              label: n.label
            }))
          );
        }
      } catch {
        if (!cancelled) toast.error('Não foi possível carregar os tipos de negócio.');
      } finally {
        if (!cancelled) setLoadingNichos(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleContinuar = async () => {
    if (!nichoId.trim()) {
      toast.error('Selecione o tipo do seu negócio para continuar.');
      return;
    }
    try {
      setSaving(true);
      await api.post('/configuracoes/personalizacao/onboarding-nicho', { nichoId: nichoId.trim() });
      await refetch();
      toast.success('Tudo certo! Seu sistema foi adaptado.');
      navigate('/dashboard', { replace: true });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao salvar. Tente novamente.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-bg-main p-4">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  if (config?.onboarding_nicho_concluido !== false) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-bg-main safe-area-pad">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-text-on-primary shadow-lg mx-auto mb-4">
              <span className="material-symbols-outlined text-2xl sm:text-3xl">diamond</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-main">Qual é o tipo do seu negócio?</h1>
            <p className="text-sm sm:text-base text-text-muted mt-3 leading-relaxed">
              Vamos adaptar o sistema para ficar mais fácil de usar no seu dia a dia.
            </p>
          </div>

          <div className="bg-bg-card rounded-xl shadow-sm border border-border p-5 sm:p-8 space-y-6">
            <div>
              <SearchableSelect
                id="onboarding-nicho"
                label="Tipo de negócio"
                options={options}
                value={nichoId}
                onChange={setNichoId}
                placeholder="Pesquisar ou escolher..."
                emptyMessage="Nenhum resultado"
                loading={loadingNichos}
                disabled={saving || loadingNichos}
              />
            </div>
            <button
              type="button"
              onClick={handleContinuar}
              disabled={saving || loadingNichos || !nichoId}
              className="w-full min-h-[48px] rounded-lg bg-primary hover:bg-primary-hover text-text-on-primary font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation transition-colors"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                  Salvando...
                </>
              ) : (
                <>
                  Continuar
                  <span className="material-symbols-outlined text-xl">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

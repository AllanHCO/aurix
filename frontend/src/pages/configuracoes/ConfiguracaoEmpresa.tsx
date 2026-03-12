import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

const SLUG_REGEX = /^[a-z0-9-]+$/;

interface ConfigResponse {
  empresa: { slug: string | null; link_preview: string | null };
  meta: { meta_faturamento_mes: number | null };
}

export default function ConfiguracaoEmpresa() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState('');
  const [metaFaturamentoMes, setMetaFaturamentoMes] = useState<number | ''>('');
  const [slugError, setSlugError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ConfigResponse>('/configuracoes');
      setSlug(res.data.empresa.slug ?? '');
      setMetaFaturamentoMes(res.data.meta?.meta_faturamento_mes ?? '');
    } catch {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const validateSlug = (v: string): string | null => {
    const s = v.trim().toLowerCase();
    if (!s) return null;
    if (s.length > 120) return 'Máximo 120 caracteres.';
    if (!SLUG_REGEX.test(s)) return 'Use apenas letras minúsculas, números e hífen.';
    return null;
  };

  const linkPreview = (() => {
    const s = slug.trim().toLowerCase();
    if (!s || validateSlug(s)) return null;
    return `${window.location.origin.replace(/\/$/, '')}/agenda/${s}`;
  })();

  const handleSave = async () => {
    const err = slug.trim() ? validateSlug(slug) : null;
    if (err) {
      setSlugError(err);
      toast.error(err);
      return;
    }
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        meta: { meta_faturamento_mes: metaFaturamentoMes === '' ? null : Number(metaFaturamentoMes) }
      };
      if (slug.trim()) payload.empresa = { slug: slug.trim().toLowerCase() };
      await api.put('/configuracoes', payload);
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
        <span className="text-text-main">Empresa</span>
      </div>
      <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">business</span>
        Empresa
      </h1>
      <p className="text-text-muted">Dados gerais e link público para agendamento.</p>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Slug da empresa</label>
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
          {slugError && <p className="text-sm text-red-500 mt-1">{slugError}</p>}
        </div>
        {linkPreview && (
          <p className="text-sm text-text-muted">
            Preview do link: <a href={linkPreview} target="_blank" rel="noopener noreferrer" className="text-primary underline">{linkPreview}</a>
          </p>
        )}
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Meta de faturamento (R$/mês)</label>
          <input
            type="number"
            min={0}
            step={100}
            value={metaFaturamentoMes}
            onChange={(e) => setMetaFaturamentoMes(e.target.value === '' ? '' : Number(e.target.value) || 0)}
            placeholder="Ex: 50000"
            className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted"
          />
          <p className="text-xs text-text-muted mt-1">Usado no Dashboard para a barra de progresso.</p>
        </div>
        <p className="text-xs text-text-muted">Nome da empresa, logo e cor da marca: em breve.</p>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary text-[var(--color-text-on-primary)] px-6 py-2.5 font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? 'Salvando...' : 'Salvar'}
          <span className="material-symbols-outlined text-lg">save</span>
        </button>
      </div>
    </div>
  );
}

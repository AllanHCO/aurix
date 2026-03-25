import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

export type LogoBandStyle = 'highlight' | 'compact';

export interface DocumentBrandingState {
  logo_path: string | null;
  logo_band_style: LogoBandStyle;
  logo_offset_x: number;
  logo_offset_y: number;
}

/** Alturas aproximadas do preview (px) alinhadas à proporção PDF */
const BAND_CONTENT_H: Record<LogoBandStyle, string> = {
  highlight: 'min-h-[52px] max-h-[56px]',
  compact: 'min-h-[34px] max-h-[38px]'
};

export default function ConfiguracaoDocumentosPdf() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [branding, setBranding] = useState<DocumentBrandingState | null>(null);
  const [draft, setDraft] = useState<DocumentBrandingState | null>(null);
  const [logoBlobUrl, setLogoBlobUrl] = useState<string | null>(null);

  const normalize = useCallback((raw: Record<string, unknown>): DocumentBrandingState => {
    const band = raw.logo_band_style;
    const style: LogoBandStyle =
      band === 'compact' || band === 'highlight'
        ? band
        : raw.logo_size === 'small'
          ? 'compact'
          : 'highlight';
    return {
      logo_path: typeof raw.logo_path === 'string' ? raw.logo_path : null,
      logo_band_style: style,
      logo_offset_x: typeof raw.logo_offset_x === 'number' ? raw.logo_offset_x : 0,
      logo_offset_y: typeof raw.logo_offset_y === 'number' ? raw.logo_offset_y : 0
    };
  }, []);

  const loadLogoPreview = useCallback(async () => {
    try {
      const res = await api.get('/configuracoes/documentos/pdf-branding/logo-file', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setLogoBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      setLogoBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<Record<string, unknown>>('/configuracoes/documentos/pdf-branding');
      const n = normalize(res.data);
      setBranding(n);
      setDraft(n);
      if (n.logo_path) await loadLogoPreview();
      else {
        setLogoBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }
    } catch {
      toast.error('Erro ao carregar configurações de documentos');
    } finally {
      setLoading(false);
    }
  }, [loadLogoPreview, normalize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (logoBlobUrl) URL.revokeObjectURL(logoBlobUrl);
    };
  }, [logoBlobUrl]);

  const dirty = useMemo(() => {
    if (!branding || !draft) return false;
    return (
      branding.logo_band_style !== draft.logo_band_style ||
      branding.logo_offset_x !== draft.logo_offset_x ||
      branding.logo_offset_y !== draft.logo_offset_y
    );
  }, [branding, draft]);

  const saveLayout = async () => {
    if (!draft) return;
    try {
      setSaving(true);
      await api.put('/configuracoes/documentos/pdf-branding', {
        logo_band_style: draft.logo_band_style,
        logo_offset_x: draft.logo_offset_x,
        logo_offset_y: draft.logo_offset_y
      });
      const res = await api.get<Record<string, unknown>>('/configuracoes/documentos/pdf-branding');
      const n = normalize(res.data);
      setBranding(n);
      setDraft(n);
      toast.success('Configuração salva.');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ok = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type);
    if (!ok) {
      toast.error('Use PNG, JPG ou WEBP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 2 MB.');
      return;
    }
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      await api.post('/configuracoes/documentos/pdf-branding/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Logo enviada.');
      await load();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      toast.error(e2.response?.data?.error || 'Erro no upload');
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!window.confirm('Remover a logo do PDF?')) return;
    try {
      setUploading(true);
      await api.delete('/configuracoes/documentos/pdf-branding/logo');
      toast.success('Logo removida.');
      await load();
    } catch {
      toast.error('Erro ao remover');
    } finally {
      setUploading(false);
    }
  };

  if (loading || !draft) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-text-muted">Carregando...</div>
    );
  }

  const hasLogo = !!draft.logo_path;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 px-1">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link to="/configuracoes" className="hover:text-text-main">
          Configurações
        </Link>
        <span>/</span>
        <span className="text-text-main">Documentos (PDF)</span>
      </div>
      <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">description</span>
        Documentos — PDF
      </h1>
      <p className="text-text-muted text-sm">
        A logo aparece numa <strong className="text-text-main">faixa em destaque abaixo do título</strong> no PDF da Ordem de Serviço (largura total, centralizada, sem deformar).
      </p>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-main">Logo da Ordem de Serviço</h2>
        <p className="text-sm text-text-muted">
          Envie PNG, JPG ou WEBP (até 2 MB). Escolha entre faixa <strong>destacada</strong> ou <strong>compacta</strong>. Use os deslizadores para ajuste fino.
        </p>

        <div className="flex flex-wrap gap-3 items-center">
          <label className="inline-flex items-center gap-2 rounded-lg bg-primary text-[var(--color-text-on-primary)] px-4 py-2 text-sm font-medium cursor-pointer hover:bg-primary/90 disabled:opacity-50">
            <span className="material-symbols-outlined text-lg">upload</span>
            {uploading ? 'Enviando...' : 'Enviar logo'}
            <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
          {draft.logo_path && (
            <button
              type="button"
              onClick={removeLogo}
              disabled={uploading}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-main hover:bg-bg-main disabled:opacity-50"
            >
              Remover logo
            </button>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-text-main">Tamanho da faixa da logo</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDraft((d) => (d ? { ...d, logo_band_style: 'highlight' } : d))}
              className={`rounded-lg px-3 py-1.5 text-sm border ${
                draft.logo_band_style === 'highlight'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-text-muted hover:border-primary/40'
              }`}
            >
              Destacada
            </button>
            <button
              type="button"
              onClick={() => setDraft((d) => (d ? { ...d, logo_band_style: 'compact' } : d))}
              className={`rounded-lg px-3 py-1.5 text-sm border ${
                draft.logo_band_style === 'compact'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-text-muted hover:border-primary/40'
              }`}
            >
              Compacta
            </button>
          </div>
          <p className="text-xs text-text-muted">
            Destacada: altura maior na faixa. Compacta: faixa mais baixa — útil para logos pequenas ou para economizar espaço vertical.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Ajuste fino horizontal (pt)</label>
            <input
              type="range"
              min={-18}
              max={18}
              value={draft.logo_offset_x}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, logo_offset_x: Number(e.target.value) } : d))
              }
              className="w-full"
            />
            <p className="text-xs text-text-muted mt-1">{draft.logo_offset_x}</p>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Ajuste fino vertical (pt)</label>
            <input
              type="range"
              min={-18}
              max={18}
              value={draft.logo_offset_y}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, logo_offset_y: Number(e.target.value) } : d))
              }
              className="w-full"
            />
            <p className="text-xs text-text-muted mt-1">{draft.logo_offset_y}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-text-main mb-2">Preview do cabeçalho</p>
          <div className="rounded-lg border-2 border-border bg-white overflow-hidden shadow-inner">
            {/* Linha 1: título + Nº OS */}
            <div
              className={`flex items-center justify-between gap-2 px-3 border-b border-border ${hasLogo ? '' : 'pb-2'}`}
              style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
            >
              <span className="text-sm font-bold text-black shrink-0">ORDEM DE SERVIÇO</span>
              <span className="text-xs font-bold text-black whitespace-nowrap">Nº OS: 00001</span>
            </div>
            {/* Linha 2: faixa da logo (só com logo) */}
            {hasLogo && (
              <div
                className={`w-full flex items-center justify-center bg-[#f4f4f4] px-3 py-2 ${BAND_CONTENT_H[draft.logo_band_style]}`}
              >
                {logoBlobUrl ? (
                  <img
                    src={logoBlobUrl}
                    alt=""
                    className="max-w-full w-full object-contain"
                    style={{
                      maxHeight: draft.logo_band_style === 'highlight' ? 56 : 36,
                      transform: `translate(${draft.logo_offset_x * 1.1}px, ${draft.logo_offset_y * 1.1}px)`
                    }}
                  />
                ) : (
                  <span className="text-xs text-text-muted">Carregando preview…</span>
                )}
              </div>
            )}
            {!hasLogo && (
              <div className="px-3 py-2 text-[11px] text-text-muted border-t border-transparent">
                Sem logo: o PDF mostra só a linha do título e o número — sem faixa cinza.
              </div>
            )}
          </div>
          <p className="text-xs text-text-muted mt-2">
            No PDF, a logo usa toda a larg útil (contain), altura máxima fixa conforme o modo destacada/compacta.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={saveLayout}
            disabled={saving || !dirty}
            className="rounded-lg bg-primary text-[var(--color-text-on-primary)] px-6 py-2.5 font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? 'Salvando...' : 'Salvar configuração'}
            <span className="material-symbols-outlined text-lg">save</span>
          </button>
        </div>
      </section>
    </div>
  );
}

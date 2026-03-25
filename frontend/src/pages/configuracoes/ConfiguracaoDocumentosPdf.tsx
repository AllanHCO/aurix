import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

export type LogoAlignment = 'left' | 'center' | 'right';
export type LogoSizePreset = 'small' | 'medium' | 'large';

export interface DocumentBrandingState {
  logo_path: string | null;
  logo_alignment: LogoAlignment;
  logo_size: LogoSizePreset;
  logo_offset_x: number;
  logo_offset_y: number;
}

const SIZE_PREVIEW: Record<LogoSizePreset, string> = {
  small: 'max-h-[22px] max-w-[72px]',
  medium: 'max-h-[30px] max-w-[88px]',
  large: 'max-h-[38px] max-w-[100px]'
};

export default function ConfiguracaoDocumentosPdf() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [branding, setBranding] = useState<DocumentBrandingState | null>(null);
  const [draft, setDraft] = useState<DocumentBrandingState | null>(null);
  const [logoBlobUrl, setLogoBlobUrl] = useState<string | null>(null);

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
      const res = await api.get<DocumentBrandingState>('/configuracoes/documentos/pdf-branding');
      setBranding(res.data);
      setDraft(res.data);
      if (res.data.logo_path) await loadLogoPreview();
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
  }, [loadLogoPreview]);

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
      branding.logo_alignment !== draft.logo_alignment ||
      branding.logo_size !== draft.logo_size ||
      branding.logo_offset_x !== draft.logo_offset_x ||
      branding.logo_offset_y !== draft.logo_offset_y
    );
  }, [branding, draft]);

  const saveLayout = async () => {
    if (!draft) return;
    try {
      setSaving(true);
      await api.put('/configuracoes/documentos/pdf-branding', {
        logo_alignment: draft.logo_alignment,
        logo_size: draft.logo_size,
        logo_offset_x: draft.logo_offset_x,
        logo_offset_y: draft.logo_offset_y
      });
      const res = await api.get<DocumentBrandingState>('/configuracoes/documentos/pdf-branding');
      setBranding(res.data);
      setDraft(res.data);
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

  const companyName = 'Nome da empresa';

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
        A logo configurada aqui é usada no <strong className="text-text-main">PDF da Ordem de Serviço</strong>. O mesmo padrão poderá ser reutilizado
        futuramente no PDF de pedido/venda.
      </p>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-main">Logo da Ordem de Serviço</h2>
        <p className="text-sm text-text-muted">
          Envie PNG, JPG ou WEBP (até 2 MB). A imagem é otimizada automaticamente. Ajuste posição e tamanho no preview e salve.
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
          <p className="text-sm font-medium text-text-main">Alinhamento horizontal da logo</p>
          <div className="flex flex-wrap gap-2">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setDraft((d) => (d ? { ...d, logo_alignment: a } : d))}
                className={`rounded-lg px-3 py-1.5 text-sm border ${
                  draft.logo_alignment === a ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted hover:border-primary/40'
                }`}
              >
                {a === 'left' ? 'Esquerda' : a === 'center' ? 'Centro' : 'Direita'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-text-main">Tamanho da logo</p>
          <div className="flex flex-wrap gap-2">
            {(['small', 'medium', 'large'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDraft((d) => (d ? { ...d, logo_size: s } : d))}
                className={`rounded-lg px-3 py-1.5 text-sm border ${
                  draft.logo_size === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted hover:border-primary/40'
                }`}
              >
                {s === 'small' ? 'Pequeno' : s === 'medium' ? 'Médio' : 'Grande'}
              </button>
            ))}
          </div>
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
          <p className="text-sm font-medium text-text-main mb-2">Preview do cabeçalho (simulação)</p>
          <div className="rounded-lg border-2 border-border bg-white overflow-hidden shadow-inner">
            <div
              className="flex items-stretch min-h-[88px] px-3 py-3 gap-3"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
            >
              {draft.logo_path && (
                <div
                  className="shrink-0 flex items-center border border-dashed border-border/80 bg-bg-main/80 rounded"
                  style={{
                    width: 118,
                    height: 52,
                    justifyContent:
                      draft.logo_alignment === 'center' ? 'center' : draft.logo_alignment === 'right' ? 'flex-end' : 'flex-start'
                  }}
                >
                  {logoBlobUrl ? (
                    <img
                      src={logoBlobUrl}
                      alt=""
                      className={`object-contain ${SIZE_PREVIEW[draft.logo_size]}`}
                      style={{
                        transform: `translate(${draft.logo_offset_x * 1.2}px, ${draft.logo_offset_y * 1.2}px)`
                      }}
                    />
                  ) : (
                    <span className="text-[10px] text-text-muted px-1">Logo</span>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold text-black leading-tight">ORDEM DE SERVIÇO</span>
                  <span className="text-xs font-bold text-black whitespace-nowrap">Nº OS: 00001</span>
                </div>
                <span className="text-[11px] text-gray-700 truncate">{companyName}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-2">
            {draft.logo_path
              ? 'Preview aproximado; o PDF final segue a mesma área fixa e proporções.'
              : 'Sem logo, o PDF exibe apenas título, empresa e número da OS — sem espaço vazio estranho.'}
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

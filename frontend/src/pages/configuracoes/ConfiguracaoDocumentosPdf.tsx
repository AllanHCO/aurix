import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import OsBannerCropModal, { type OsBannerCropModalSource } from '../../components/OsBannerCropModal';
import {
  clampPan,
  clampZoom,
  computeOsBannerLayout,
  getOsBannerHeightPt,
  OS_BANNER_HEIGHT_PT,
  type LogoBandStyle
} from '../../lib/osBannerLayout';

export type { LogoBandStyle };

export interface DocumentBrandingState {
  logo_path: string | null;
  logo_band_style: LogoBandStyle;
  logo_offset_x: number;
  logo_offset_y: number;
  logo_zoom: number;
}

export default function ConfiguracaoDocumentosPdf() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<DocumentBrandingState | null>(null);
  const [logoBlobUrl, setLogoBlobUrl] = useState<string | null>(null);
  const [imgLoadError, setImgLoadError] = useState(false);

  const [cropSource, setCropSource] = useState<OsBannerCropModalSource | null>(null);
  const [cropApplying, setCropApplying] = useState(false);

  const bannerRef = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const pendingObjectUrlRef = useRef<string | null>(null);

  const normalize = useCallback((raw: Record<string, unknown>): DocumentBrandingState => {
    const band = raw.logo_band_style;
    const style: LogoBandStyle =
      band === 'compact' || band === 'highlight'
        ? band
        : raw.logo_size === 'small'
          ? 'compact'
          : 'highlight';
    const ox = (x: unknown): number => {
      if (typeof x !== 'number' || !Number.isFinite(x)) return 0;
      if (Math.abs(x) <= 1.0001) return clampPan(x);
      return clampPan(x / 18);
    };
    const z =
      typeof raw.logo_zoom === 'number' && Number.isFinite(raw.logo_zoom) ? clampZoom(raw.logo_zoom) : 1;
    return {
      logo_path: typeof raw.logo_path === 'string' ? raw.logo_path : null,
      logo_band_style: style,
      logo_offset_x: ox(raw.logo_offset_x),
      logo_offset_y: ox(raw.logo_offset_y),
      logo_zoom: z
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
      setImgLoadError(false);
    } catch {
      setLogoBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setImgLoadError(true);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<Record<string, unknown>>('/configuracoes/documentos/pdf-branding');
      const n = normalize(res.data);
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
      if (pendingObjectUrlRef.current) URL.revokeObjectURL(pendingObjectUrlRef.current);
    };
  }, [logoBlobUrl]);

  useEffect(() => {
    setNaturalSize(null);
    setImgLoadError(false);
  }, [logoBlobUrl]);

  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBoxSize({ w: r.width, h: r.height });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [draft?.logo_path, draft?.logo_band_style]);

  const closeCropModal = () => {
    if (cropSource?.kind === 'file') {
      URL.revokeObjectURL(cropSource.objectUrl);
      pendingObjectUrlRef.current = null;
    }
    setCropSource(null);
  };

  const openEditModal = () => {
    if (!draft?.logo_path || !logoBlobUrl) {
      toast.error('Carregue uma imagem primeiro.');
      return;
    }
    setCropSource({ kind: 'remote', url: logoBlobUrl });
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (pendingObjectUrlRef.current) {
      URL.revokeObjectURL(pendingObjectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    pendingObjectUrlRef.current = url;
    setCropSource({ kind: 'file', file, objectUrl: url });
  };

  const handleCropApply = async (payload: {
    logo_band_style: LogoBandStyle;
    logo_offset_x: number;
    logo_offset_y: number;
    logo_zoom: number;
    file?: File;
  }) => {
    try {
      setCropApplying(true);
      if (payload.file) {
        const fd = new FormData();
        fd.append('file', payload.file);
        await api.post('/configuracoes/documentos/pdf-branding/logo', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      await api.put('/configuracoes/documentos/pdf-branding', {
        logo_band_style: payload.logo_band_style,
        logo_offset_x: payload.logo_offset_x,
        logo_offset_y: payload.logo_offset_y,
        logo_zoom: payload.logo_zoom
      });
      await load();
      toast.success(payload.file ? 'Imagem e enquadramento salvos.' : 'Enquadramento salvo.');
      closeCropModal();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      toast.error(e2.response?.data?.error || 'Erro ao salvar');
    } finally {
      setCropApplying(false);
    }
  };

  const removeLogo = async () => {
    if (!window.confirm('Remover a imagem do banner no PDF?')) return;
    try {
      setUploading(true);
      await api.delete('/configuracoes/documentos/pdf-branding/logo');
      toast.success('Imagem removida.');
      await load();
    } catch {
      toast.error('Erro ao remover');
    } finally {
      setUploading(false);
    }
  };

  if (loading || !draft) {
    return <div className="max-w-3xl mx-auto py-12 text-text-muted">Carregando...</div>;
  }

  const hasLogo = !!draft.logo_path;
  const bannerH = OS_BANNER_HEIGHT_PT[draft.logo_band_style];

  const layout =
    hasLogo && naturalSize && boxSize.w > 0 && boxSize.h > 0 && !imgLoadError
      ? computeOsBannerLayout(
          boxSize.w,
          boxSize.h,
          naturalSize.w,
          naturalSize.h,
          draft.logo_offset_x,
          draft.logo_offset_y,
          draft.logo_zoom
        )
      : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 px-1">
      <OsBannerCropModal
        open={!!cropSource}
        source={cropSource}
        initialBandStyle={draft.logo_band_style}
        initialPanX={cropSource?.kind === 'file' ? 0 : draft.logo_offset_x}
        initialPanY={cropSource?.kind === 'file' ? 0 : draft.logo_offset_y}
        initialZoom={cropSource?.kind === 'file' ? 1 : draft.logo_zoom}
        onClose={closeCropModal}
        onApply={handleCropApply}
        applying={cropApplying}
      />

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
      <p className="text-text-muted text-sm leading-relaxed">
        A imagem vira um <strong className="text-text-main">banner no topo</strong> da Ordem de Serviço (mesma
        largura do PDF, altura conforme o modo). Ao enviar, abrimos um editor para você posicionar o recorte; o
        preview abaixo repete a mesma lógica do PDF.
      </p>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-main">Banner — Ordem de Serviço</h2>
        <p className="text-sm text-text-muted">
          PNG, JPG ou WEBP até 2 MB. O ajuste fino (faixa, zoom, posição) é feito no editor em tela cheia após
          escolher a imagem.
        </p>

        <div className="flex flex-wrap gap-3 items-center">
          <label className="inline-flex items-center gap-2 rounded-lg bg-primary text-[var(--color-text-on-primary)] px-4 py-2 text-sm font-medium cursor-pointer hover:bg-primary/90 disabled:opacity-50">
            <span className="material-symbols-outlined text-lg">upload</span>
            {uploading ? 'Aguarde…' : 'Enviar imagem'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={onPickFile}
              disabled={uploading || cropApplying}
            />
          </label>
          {hasLogo && (
            <>
              <button
                type="button"
                onClick={openEditModal}
                disabled={uploading || cropApplying || !logoBlobUrl}
                className="rounded-lg border border-border px-4 py-2 text-sm text-text-main hover:bg-bg-main disabled:opacity-50"
              >
                Editar enquadramento
              </button>
              <button
                type="button"
                onClick={removeLogo}
                disabled={uploading || cropApplying}
                className="rounded-lg border border-border px-4 py-2 text-sm text-text-main hover:bg-bg-main disabled:opacity-50"
              >
                Remover imagem
              </button>
            </>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-text-main">Preview (igual ao PDF)</p>
            {hasLogo && (
              <span className="text-xs text-text-muted">
                Faixa: {draft.logo_band_style === 'highlight' ? 'destacada' : 'compacta'} ·{' '}
                {getOsBannerHeightPt(draft.logo_band_style)} pt
              </span>
            )}
          </div>
          <div className="rounded-lg border-2 border-border bg-white overflow-hidden shadow-inner w-full min-w-0">
            {hasLogo && (
              <div
                ref={bannerRef}
                role="img"
                aria-label="Preview do banner da Ordem de Serviço"
                className="relative w-full min-w-0 overflow-hidden bg-[#e8e8e8]"
                style={{ height: bannerH }}
              >
                {logoBlobUrl && (
                  <img
                    src={logoBlobUrl}
                    alt=""
                    draggable={false}
                    decoding="async"
                    className="absolute pointer-events-none select-none max-w-none block"
                    onLoad={(e) => {
                      setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
                      setImgLoadError(false);
                    }}
                    onError={() => {
                      setNaturalSize(null);
                      setImgLoadError(true);
                    }}
                    style={
                      layout
                        ? {
                            width: layout.dw,
                            height: layout.dh,
                            left: layout.left,
                            top: layout.top
                          }
                        : {
                            opacity: 0,
                            width: 1,
                            height: 1,
                            left: 0,
                            top: 0
                          }
                    }
                  />
                )}
                {!layout && !imgLoadError && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-text-muted">
                    Carregando imagem…
                  </div>
                )}
                {imgLoadError && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-red-600 px-2 text-center">
                    Não foi possível carregar o preview. Tente salvar de novo ou enviar a imagem outra vez.
                  </div>
                )}
              </div>
            )}
            <div
              className={`flex items-center justify-between gap-2 px-3 border-t border-border bg-white ${hasLogo ? '' : 'py-2'}`}
              style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
            >
              <span className="text-sm font-bold text-black shrink-0">ORDEM DE SERVIÇO</span>
              <span className="text-xs font-bold text-black whitespace-nowrap">Nº OS: 00001</span>
            </div>
            {!hasLogo && (
              <div className="px-3 py-2 text-[11px] text-text-muted border-t border-transparent">
                Sem imagem: o PDF mostra só o título e o número.
              </div>
            )}
          </div>
        </div>

      </section>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

export type LogoBandStyle = 'highlight' | 'compact';

export interface DocumentBrandingState {
  logo_path: string | null;
  logo_band_style: LogoBandStyle;
  logo_offset_x: number;
  logo_offset_y: number;
  logo_zoom: number;
}

/** Alturas do preview (px) — mesma proporção do PDF (108pt / 80pt banner) */
const BANNER_PREVIEW_H: Record<LogoBandStyle, number> = {
  highlight: 108,
  compact: 80
};

function clampPan(n: number): number {
  return Math.max(-1, Math.min(1, n));
}

function clampZoom(n: number): number {
  return Math.max(1, Math.min(3, Math.round(n * 100) / 100));
}

/** Idêntico ao backend/PDF: cover × zoom + pan em [-1,1] */
function computeOsBannerLayout(
  bandW: number,
  bandH: number,
  iw: number,
  ih: number,
  panX: number,
  panY: number,
  zoom: number
): { dw: number; dh: number; left: number; top: number } {
  const z = clampZoom(zoom);
  const scale = Math.max(bandW / iw, bandH / ih) * z;
  const dw = iw * scale;
  const dh = ih * scale;
  const left = (bandW - dw) / 2 + panX * ((dw - bandW) / 2);
  const top = (bandH - dh) / 2 + panY * ((dh - bandH) / 2);
  return { dw, dh, left, top };
}

export default function ConfiguracaoDocumentosPdf() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [branding, setBranding] = useState<DocumentBrandingState | null>(null);
  const [draft, setDraft] = useState<DocumentBrandingState | null>(null);
  const [logoBlobUrl, setLogoBlobUrl] = useState<string | null>(null);

  const bannerRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<DocumentBrandingState | null>(null);
  const naturalRef = useRef<{ w: number; h: number } | null>(null);
  const dragActiveRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    naturalRef.current = naturalSize;
  }, [naturalSize]);

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

  useEffect(() => {
    setNaturalSize(null);
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

  const dirty = useMemo(() => {
    if (!branding || !draft) return false;
    return (
      branding.logo_band_style !== draft.logo_band_style ||
      branding.logo_offset_x !== draft.logo_offset_x ||
      branding.logo_offset_y !== draft.logo_offset_y ||
      branding.logo_zoom !== draft.logo_zoom
    );
  }, [branding, draft]);

  const saveLayout = async () => {
    if (!draft) return;
    try {
      setSaving(true);
      await api.put('/configuracoes/documentos/pdf-branding', {
        logo_band_style: draft.logo_band_style,
        logo_offset_x: draft.logo_offset_x,
        logo_offset_y: draft.logo_offset_y,
        logo_zoom: draft.logo_zoom
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
      toast.success('Imagem enviada.');
      await load();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      toast.error(e2.response?.data?.error || 'Erro no upload');
    } finally {
      setUploading(false);
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

  /** Arraste: px → Δpan com a mesma derivada do layout (imagem acompanha o dedo/mouse). */
  const applyDragDelta = useCallback((dx: number, dy: number) => {
    const el = bannerRef.current;
    const d = draftRef.current;
    const nat = naturalRef.current;
    if (!el || !d || !nat) return;
    const { width: bw, height: bh } = el.getBoundingClientRect();
    if (bw <= 0 || bh <= 0) return;
    const { dw, dh } = computeOsBannerLayout(bw, bh, nat.w, nat.h, d.logo_offset_x, d.logo_offset_y, d.logo_zoom);
    const denomX = dw - bw;
    const denomY = dh - bh;
    let dPanX = 0;
    let dPanY = 0;
    if (Math.abs(denomX) > 0.5) dPanX = (dx * 2) / denomX;
    if (Math.abs(denomY) > 0.5) dPanY = (dy * 2) / denomY;
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            logo_offset_x: clampPan(prev.logo_offset_x + dPanX),
            logo_offset_y: clampPan(prev.logo_offset_y + dPanY)
          }
        : prev
    );
  }, []);

  const onBannerPointerDown = (e: React.PointerEvent) => {
    if (!draftRef.current?.logo_path) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragActiveRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const onBannerPointerMove = (e: React.PointerEvent) => {
    if (!dragActiveRef.current || !lastPointerRef.current) return;
    const last = lastPointerRef.current;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    applyDragDelta(dx, dy);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragActiveRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragActiveRef.current = false;
    lastPointerRef.current = null;
  };

  const centerPan = () => {
    setDraft((d) => (d ? { ...d, logo_offset_x: 0, logo_offset_y: 0 } : d));
  };

  if (loading || !draft) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-text-muted">Carregando...</div>
    );
  }

  const hasLogo = !!draft.logo_path;
  const bannerH = BANNER_PREVIEW_H[draft.logo_band_style];

  const layout =
    hasLogo && naturalSize && boxSize.w > 0 && boxSize.h > 0
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
        A imagem será usada como um <strong className="text-text-main">banner no topo do PDF</strong>. Ela será
        ajustada para <strong className="text-text-main">preencher toda a largura</strong> (modo capa: pode cortar
        bordas, sem distorcer). Use o <strong className="text-text-main">arraste</strong> e o{' '}
        <strong className="text-text-main">zoom</strong> para posicionar corretamente. O preview abaixo usa a mesma
        matemática do PDF.
      </p>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-main">Editor de banner — Ordem de Serviço</h2>
        <p className="text-sm text-text-muted">
          PNG, JPG ou WEBP até 2 MB. Modo da faixa (altura), zoom e posição são salvos no servidor com a imagem (
          <code className="text-xs bg-bg-main px-1 rounded">logo_path</code>).
        </p>

        <div className="flex flex-wrap gap-3 items-center">
          <label className="inline-flex items-center gap-2 rounded-lg bg-primary text-[var(--color-text-on-primary)] px-4 py-2 text-sm font-medium cursor-pointer hover:bg-primary/90 disabled:opacity-50">
            <span className="material-symbols-outlined text-lg">upload</span>
            {uploading ? 'Enviando...' : 'Enviar imagem'}
            <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
          {draft.logo_path && (
            <button
              type="button"
              onClick={removeLogo}
              disabled={uploading}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-main hover:bg-bg-main disabled:opacity-50"
            >
              Remover imagem
            </button>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-text-main">Altura da faixa (modo)</p>
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
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-1">Zoom (1× a 3×)</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={draft.logo_zoom}
            onChange={(e) => setDraft((d) => (d ? { ...d, logo_zoom: clampZoom(Number(e.target.value)) } : d))}
            className="w-full max-w-md"
          />
          <p className="text-xs text-text-muted mt-1">
            {draft.logo_zoom.toFixed(2)}× — aumente o zoom se o pan ficar pouco sensível.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Posição horizontal</label>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.005}
              value={draft.logo_offset_x}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, logo_offset_x: clampPan(Number(e.target.value)) } : d))
              }
              className="w-full"
            />
            <p className="text-xs text-text-muted mt-1 font-mono">{draft.logo_offset_x.toFixed(3)}</p>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Posição vertical</label>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.005}
              value={draft.logo_offset_y}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, logo_offset_y: clampPan(Number(e.target.value)) } : d))
              }
              className="w-full"
            />
            <p className="text-xs text-text-muted mt-1 font-mono">{draft.logo_offset_y.toFixed(3)}</p>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-text-main">Preview (mesma lógica do PDF)</p>
            {hasLogo && (
              <button
                type="button"
                onClick={centerPan}
                className="text-sm rounded-lg border border-border px-3 py-1.5 text-text-main hover:bg-bg-main"
              >
                Centralizar imagem
              </button>
            )}
          </div>
          <div className="rounded-lg border-2 border-border bg-white overflow-hidden shadow-inner w-full min-w-0">
            {hasLogo && (
              <div
                ref={bannerRef}
                role="region"
                aria-label="Preview do banner: arraste para posicionar"
                className="relative w-full min-w-0 overflow-hidden bg-[#e8e8e8] touch-none select-none cursor-grab active:cursor-grabbing"
                style={{ height: bannerH }}
                onPointerDown={onBannerPointerDown}
                onPointerMove={onBannerPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                {logoBlobUrl && (
                  <>
                    <img
                      src={logoBlobUrl}
                      alt=""
                      draggable={false}
                      decoding="async"
                      className="absolute pointer-events-none select-none max-w-none block"
                      onLoad={(e) => {
                        const im = e.currentTarget;
                        setNaturalSize({ w: im.naturalWidth, h: im.naturalHeight });
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
                    {!layout && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs text-text-muted pointer-events-none">
                        {!naturalSize ? 'Carregando…' : 'Preparando preview…'}
                      </span>
                    )}
                  </>
                )}
                <span className="absolute bottom-1 right-1 rounded bg-black/55 text-white text-[10px] px-1.5 py-0.5 pointer-events-none">
                  Arraste · capa + corte
                </span>
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

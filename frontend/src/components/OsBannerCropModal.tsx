import { useCallback, useEffect, useRef, useState } from 'react';
import ModalPortal from './ModalPortal';
import {
  clampPan,
  clampZoom,
  computeOsBannerLayout,
  getOsBannerAspectRatio,
  getOsBannerHeightPt,
  PDF_OS_CONTENT_WIDTH_PT,
  type LogoBandStyle
} from '../lib/osBannerLayout';

export type OsBannerCropModalSource =
  | { kind: 'file'; file: File; objectUrl: string }
  | { kind: 'remote'; url: string };

type Props = {
  open: boolean;
  source: OsBannerCropModalSource | null;
  initialBandStyle: LogoBandStyle;
  initialPanX: number;
  initialPanY: number;
  initialZoom: number;
  onClose: () => void;
  onApply: (payload: {
    logo_band_style: LogoBandStyle;
    logo_offset_x: number;
    logo_offset_y: number;
    logo_zoom: number;
    file?: File;
  }) => Promise<void>;
  applying?: boolean;
};

export default function OsBannerCropModal({
  open,
  source,
  initialBandStyle,
  initialPanX,
  initialPanY,
  initialZoom,
  onClose,
  onApply,
  applying = false
}: Props) {
  const [bandStyle, setBandStyle] = useState<LogoBandStyle>(initialBandStyle);
  const [panX, setPanX] = useState(clampPan(initialPanX));
  const [panY, setPanY] = useState(clampPan(initialPanY));
  const [zoom, setZoom] = useState(clampZoom(initialZoom));
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [imgError, setImgError] = useState(false);
  const [viewportW, setViewportW] = useState(0);

  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ x: clampPan(initialPanX), y: clampPan(initialPanY) });
  const zoomRef = useRef(clampZoom(initialZoom));
  const naturalRef = useRef<{ w: number; h: number } | null>(null);
  const dragActiveRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const imageUrl = source?.kind === 'file' ? source.objectUrl : source?.kind === 'remote' ? source.url : '';

  useEffect(() => {
    panRef.current = { x: panX, y: panY };
  }, [panX, panY]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    naturalRef.current = naturalSize;
  }, [naturalSize]);

  useEffect(() => {
    if (!open) return;
    setBandStyle(initialBandStyle);
    setPanX(clampPan(initialPanX));
    setPanY(clampPan(initialPanY));
    setZoom(clampZoom(initialZoom));
    panRef.current = { x: clampPan(initialPanX), y: clampPan(initialPanY) };
    zoomRef.current = clampZoom(initialZoom);
    setNaturalSize(null);
    naturalRef.current = null;
    setImgError(false);
  }, [open, initialBandStyle, initialPanX, initialPanY, initialZoom, source]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!open || !el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setViewportW(r.width);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [open, bandStyle, naturalSize]);

  const bandH = getOsBannerHeightPt(bandStyle);
  const viewportH = viewportW > 0 ? viewportW / getOsBannerAspectRatio(bandStyle) : 0;

  const layout =
    naturalSize && viewportW > 0 && viewportH > 0
      ? computeOsBannerLayout(viewportW, viewportH, naturalSize.w, naturalSize.h, panX, panY, zoom)
      : null;

  const applyDragDelta = useCallback((dx: number, dy: number) => {
    const el = viewportRef.current;
    const nat = naturalRef.current;
    if (!el || !nat) return;
    const r = el.getBoundingClientRect();
    const bw = r.width;
    const bh = r.height;
    if (bw <= 0 || bh <= 0) return;
    const { dw, dh } = computeOsBannerLayout(bw, bh, nat.w, nat.h, panRef.current.x, panRef.current.y, zoomRef.current);
    const denomX = dw - bw;
    const denomY = dh - bh;
    let dPanX = 0;
    let dPanY = 0;
    if (Math.abs(denomX) > 0.5) dPanX = (dx * 2) / denomX;
    if (Math.abs(denomY) > 0.5) dPanY = (dy * 2) / denomY;
    setPanX((px) => clampPan(px + dPanX));
    setPanY((py) => clampPan(py + dPanY));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!naturalSize || applying) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragActiveRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragActiveRef.current || !lastPointerRef.current) return;
    const last = lastPointerRef.current;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    applyDragDelta(dx, dy);
  };

  const endPointer = (e: React.PointerEvent) => {
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
    setPanX(0);
    setPanY(0);
  };

  const resetFraming = () => {
    setPanX(0);
    setPanY(0);
    setZoom(1);
  };

  const handleApply = async () => {
    if (!source || applying) return;
    await onApply({
      logo_band_style: bandStyle,
      logo_offset_x: panX,
      logo_offset_y: panY,
      logo_zoom: zoom,
      file: source.kind === 'file' ? source.file : undefined
    });
  };

  if (!open || !source) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 flex items-center justify-center p-3 sm:p-6 bg-black/55"
        role="dialog"
        aria-modal="true"
        aria-labelledby="os-banner-crop-title"
        onClick={(e) => e.target === e.currentTarget && !applying && onClose()}
      >
        <div
          className="relative w-full max-w-[min(96vw,1200px)] max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-bg-card shadow-xl flex flex-col gap-4 p-4 sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id="os-banner-crop-title" className="text-lg font-semibold text-text-main">
                Ajustar banner no PDF
              </h2>
              <p className="text-sm text-text-muted mt-1 max-w-xl">
                A área clara é exatamente o que será impresso no topo da Ordem de Serviço. Arraste a imagem por
                trás da moldura, use o zoom e confirme quando estiver bom.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="rounded-lg p-2 text-text-muted hover:bg-bg-main hover:text-text-main disabled:opacity-50"
              aria-label="Fechar"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-medium text-text-muted self-center mr-1">Altura da faixa</span>
            <button
              type="button"
              disabled={applying}
              onClick={() => setBandStyle('highlight')}
              className={`rounded-lg px-3 py-1.5 text-sm border ${
                bandStyle === 'highlight'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-text-muted hover:border-primary/40'
              }`}
            >
              Destacada
            </button>
            <button
              type="button"
              disabled={applying}
              onClick={() => setBandStyle('compact')}
              className={`rounded-lg px-3 py-1.5 text-sm border ${
                bandStyle === 'compact'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-text-muted hover:border-primary/40'
              }`}
            >
              Compacta
            </button>
          </div>

          <div className="w-full rounded-xl bg-black/45 flex justify-center items-center p-6 sm:p-10 md:p-14 min-h-[220px]">
            <div
              ref={viewportRef}
              className="relative w-full max-w-[min(96vw,1200px)] overflow-hidden rounded-md bg-[#d4d4d4] touch-none select-none cursor-grab active:cursor-grabbing ring-2 ring-white shadow-lg"
              style={{
                aspectRatio: `${PDF_OS_CONTENT_WIDTH_PT} / ${bandH}`
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
            >
              {imageUrl && !imgError && (
                <img
                  src={imageUrl}
                  alt=""
                  draggable={false}
                  decoding="async"
                  className="absolute pointer-events-none max-w-none block"
                  onLoad={(e) => {
                    const im = e.currentTarget;
                    setNaturalSize({ w: im.naturalWidth, h: im.naturalHeight });
                    setImgError(false);
                  }}
                  onError={() => {
                    setImgError(true);
                    setNaturalSize(null);
                  }}
                  style={
                    layout
                      ? {
                          width: layout.dw,
                          height: layout.dh,
                          left: layout.left,
                          top: layout.top
                        }
                      : { opacity: 0, width: 1, height: 1, left: 0, top: 0 }
                  }
                />
              )}
              {!naturalSize && !imgError && (
                <div className="absolute inset-0 flex items-center justify-center bg-bg-main/30">
                  <span className="text-sm text-text-muted">
                    {imageUrl ? 'Carregando imagem…' : 'Sem imagem'}
                  </span>
                </div>
              )}
              {imgError && (
                <div className="absolute inset-0 flex items-center justify-center bg-bg-main/40">
                  <span className="text-sm text-red-600">Não foi possível carregar a imagem.</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-text-muted">
              <span>Zoom</span>
              <span className="font-mono tabular-nums">{zoom.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              disabled={!naturalSize || applying}
              onChange={(e) => setZoom(clampZoom(Number(e.target.value)))}
              className="w-full"
            />
          </div>

          <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-main hover:bg-bg-main disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={resetFraming}
              disabled={!naturalSize || applying}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-main hover:bg-bg-main disabled:opacity-50"
            >
              Redefinir
            </button>
            <button
              type="button"
              onClick={centerPan}
              disabled={!naturalSize || applying}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-main hover:bg-bg-main disabled:opacity-50"
            >
              Centralizar
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!naturalSize || applying || imgError}
              className="rounded-lg bg-primary text-[var(--color-text-on-primary)] px-5 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {applying ? 'Salvando…' : 'Confirmar e aplicar'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

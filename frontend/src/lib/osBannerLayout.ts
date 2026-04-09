export type LogoBandStyle = 'highlight' | 'compact';

/**
 * Largura útil do PDF da OS (A4 menos margens 36pt de cada lado).
 * Deve coincidir com `pageWidth` em `os-pdf.controller.ts` (doc.page.width - 72).
 */
export const PDF_OS_CONTENT_WIDTH_PT = 595.28 - 72;

export const OS_BANNER_HEIGHT_PT: Record<LogoBandStyle, number> = {
  highlight: 108,
  compact: 80
};

export function getOsBannerHeightPt(style: LogoBandStyle): number {
  return OS_BANNER_HEIGHT_PT[style];
}

/** Largura ÷ altura do retângulo do banner (igual ao PDF). */
export function getOsBannerAspectRatio(style: LogoBandStyle): number {
  return PDF_OS_CONTENT_WIDTH_PT / getOsBannerHeightPt(style);
}

export function clampPan(n: number): number {
  return Math.max(-1, Math.min(1, n));
}

export function clampZoom(n: number): number {
  return Math.max(1, Math.min(3, Math.round(n * 100) / 100));
}

/**
 * Mesma fórmula que `drawOsLogoBannerCover` no backend (cover × zoom + pan em [-1,1]).
 */
export function computeOsBannerLayout(
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

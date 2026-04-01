/**
 * Marca visual dos PDFs (OS, futuro pedido/venda). Persistido em company_settings.personalizacao_json.document_branding.
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getUploadsBaseDir } from '../config/env';

export type LogoAlignment = 'left' | 'center' | 'right';
export type LogoSizePreset = 'small' | 'medium' | 'large';
/** Faixa da logo no PDF da OS: maior destaque ou mais discreta */
export type LogoBandStyle = 'highlight' | 'compact';

export interface DocumentBranding {
  /** Caminho relativo à pasta base de uploads (ex.: branding/logos/{userId}/x.jpg) */
  logo_path: string | null;
  /** Legado; na faixa full-width a logo é centralizada (offsets aplicam ajuste fino) */
  logo_alignment: LogoAlignment;
  /** Legado; mapeado para band_style quando ausente */
  logo_size: LogoSizePreset;
  /** Destacada = faixa mais alta; compacta = faixa menor */
  logo_band_style: LogoBandStyle;
  /**
   * Enquadramento horizontal/vertical no modo “cover” (como background-position), em [-1, 1].
   * 0 = centralizado; ±1 = extremos. Valores antigos em pt (~-18..18) são convertidos ao ler.
   */
  logo_offset_x: number;
  logo_offset_y: number;
}

/** Altura fixa do banner no PDF (pontos). Destacada ~100pt, compacta ~80pt (faixa ~80–140px em tela). */
export function getLogoBannerHeightPt(style: LogoBandStyle): number {
  return style === 'compact' ? 80 : 108;
}

/** @deprecated use getLogoBannerHeightPt — mantido para qualquer import legado */
export function getLogoBandContentMaxHeight(style: LogoBandStyle): number {
  return getLogoBannerHeightPt(style);
}

export function getDefaultDocumentBranding(): DocumentBranding {
  return {
    logo_path: null,
    logo_alignment: 'center',
    logo_size: 'medium',
    logo_band_style: 'highlight',
    logo_offset_x: 0,
    logo_offset_y: 0
  };
}

export function mergeDocumentBranding(raw: unknown): DocumentBranding {
  const d = getDefaultDocumentBranding();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Record<string, unknown>;
  const align = o.logo_alignment;
  const size = o.logo_size;
  const band = o.logo_band_style;
  let bandStyle: LogoBandStyle;
  if (band === 'highlight' || band === 'compact') {
    bandStyle = band;
  } else {
    const sz = size === 'small' || size === 'medium' || size === 'large' ? size : d.logo_size;
    bandStyle = sz === 'small' ? 'compact' : 'highlight';
  }
  return {
    logo_path: typeof o.logo_path === 'string' && o.logo_path.length > 0 ? o.logo_path : null,
    logo_alignment: align === 'left' || align === 'center' || align === 'right' ? align : d.logo_alignment,
    logo_size: size === 'small' || size === 'medium' || size === 'large' ? size : d.logo_size,
    logo_band_style: bandStyle,
    logo_offset_x: normalizePan(o.logo_offset_x, d.logo_offset_x),
    logo_offset_y: normalizePan(o.logo_offset_y, d.logo_offset_y)
  };
}

/** Converte pan salvo: [-1,1] ou legado em pt (~-18..18) → [-1, 1] */
export function normalizePan(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  if (Math.abs(raw) <= 1.0001) return Math.max(-1, Math.min(1, raw));
  return Math.max(-1, Math.min(1, raw / 18));
}

export function absolutePathFromRelative(relativePath: string): string {
  return path.join(process.cwd(), getUploadsBaseDir(), relativePath);
}

export function buildBrandingLogoPath(userId: string, ext: string): { dir: string; filename: string; relative: string } {
  const base = path.join(process.cwd(), getUploadsBaseDir(), 'branding', 'logos');
  const dir = path.join(base, userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}${ext}`;
  const relative = `branding/logos/${userId}/${filename}`;
  return { dir, filename, relative };
}

export function safeUnlinkLogo(relativePath: string | null | undefined): void {
  if (!relativePath || typeof relativePath !== 'string') return;
  if (relativePath.includes('..') || relativePath.startsWith('/')) return;
  if (!relativePath.startsWith('branding/logos/')) return;
  const full = absolutePathFromRelative(relativePath);
  if (fs.existsSync(full)) {
    try {
      fs.unlinkSync(full);
    } catch {
      /* ignore */
    }
  }
}

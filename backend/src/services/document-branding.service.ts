/**
 * Marca visual dos PDFs (OS, futuro pedido/venda). Persistido em company_settings.personalizacao_json.document_branding.
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getUploadsBaseDir } from '../config/env';

export type LogoAlignment = 'left' | 'center' | 'right';
export type LogoSizePreset = 'small' | 'medium' | 'large';

export interface DocumentBranding {
  /** Caminho relativo à pasta base de uploads (ex.: branding/logos/{userId}/x.jpg) */
  logo_path: string | null;
  logo_alignment: LogoAlignment;
  logo_size: LogoSizePreset;
  /** Ajuste fino em pontos PDF (~1 pt ≈ 1/72 pol) */
  logo_offset_x: number;
  logo_offset_y: number;
}

export const PDF_LOGO_BOX_W = 118;
export const PDF_LOGO_BOX_H = 52;
/** Altura mínima do bloco de cabeçalho da OS (pontos) — fixa com ou sem logo */
export const PDF_OS_HEADER_H = 72;

export function getLogoMaxDimensions(size: LogoSizePreset): { maxW: number; maxH: number } {
  switch (size) {
    case 'small':
      return { maxW: 100, maxH: 28 };
    case 'large':
      return { maxW: 115, maxH: 48 };
    case 'medium':
    default:
      return { maxW: 110, maxH: 38 };
  }
}

export function getDefaultDocumentBranding(): DocumentBranding {
  return {
    logo_path: null,
    logo_alignment: 'left',
    logo_size: 'medium',
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
  return {
    logo_path: typeof o.logo_path === 'string' && o.logo_path.length > 0 ? o.logo_path : null,
    logo_alignment: align === 'left' || align === 'center' || align === 'right' ? align : d.logo_alignment,
    logo_size: size === 'small' || size === 'medium' || size === 'large' ? size : d.logo_size,
    logo_offset_x: typeof o.logo_offset_x === 'number' && Number.isFinite(o.logo_offset_x) ? clampOffset(o.logo_offset_x) : d.logo_offset_x,
    logo_offset_y: typeof o.logo_offset_y === 'number' && Number.isFinite(o.logo_offset_y) ? clampOffset(o.logo_offset_y) : d.logo_offset_y
  };
}

function clampOffset(n: number): number {
  return Math.max(-18, Math.min(18, Math.round(n)));
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

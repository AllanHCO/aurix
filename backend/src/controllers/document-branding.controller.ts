import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import sharp from 'sharp';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  buildBrandingLogoPath,
  mergeDocumentBranding,
  absolutePathFromRelative,
  safeUnlinkLogo,
  type DocumentBranding
} from '../services/document-branding.service';

async function getOrCreateSettings(userId: string) {
  let s = await prisma.companySettings.findUnique({ where: { usuario_id: userId } });
  if (!s) {
    s = await prisma.companySettings.create({
      data: { usuario_id: userId, dias_atencao: 30, dias_inativo: 45 }
    });
  }
  return s;
}

function readPersonalizacaoJson(settings: { personalizacao_json: unknown }): Record<string, unknown> {
  const raw = settings.personalizacao_json;
  if (!raw || typeof raw !== 'object') return {};
  return { ...(raw as Record<string, unknown>) };
}

function persistDocumentBranding(userId: string, branding: DocumentBranding): Promise<void> {
  return getOrCreateSettings(userId).then(async (settings) => {
    const base = readPersonalizacaoJson(settings);
    base.document_branding = branding;
    await prisma.companySettings.update({
      where: { usuario_id: userId },
      data: { personalizacao_json: base as object }
    });
  });
}

/** GET /configuracoes/documentos/pdf-branding */
export async function getPdfBranding(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const settings = await getOrCreateSettings(userId);
  const raw = readPersonalizacaoJson(settings).document_branding;
  const branding = mergeDocumentBranding(raw);
  res.json(branding);
}

const putSchema = z.object({
  logo_alignment: z.enum(['left', 'center', 'right']).optional(),
  logo_size: z.enum(['small', 'medium', 'large']).optional(),
  logo_band_style: z.enum(['highlight', 'compact']).optional(),
  /** [-1, 1] enquadramento cover; valores legados em pt (-18..18) aceitos e normalizados */
  logo_offset_x: z.number().min(-18).max(18).optional(),
  logo_offset_y: z.number().min(-18).max(18).optional(),
  logo_zoom: z.number().min(1).max(3).optional()
});

/** PUT /configuracoes/documentos/pdf-branding */
export async function putPdfBranding(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const body = putSchema.parse(req.body);
  const settings = await getOrCreateSettings(userId);
  const current = mergeDocumentBranding(readPersonalizacaoJson(settings).document_branding);
  const merged = mergeDocumentBranding({
    ...current,
    ...body,
    logo_path: current.logo_path
  } as unknown);
  await persistDocumentBranding(userId, merged);
  res.json({ success: true, data: merged });
}

/** POST /configuracoes/documentos/pdf-branding/logo — multipart field "file" */
export async function postPdfBrandingLogo(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const file = (req as { file?: { buffer?: Buffer } }).file;
  if (!file?.buffer?.length) throw new AppError('Envie uma imagem (PNG, JPG ou WEBP).', 400);

  const { dir, filename, relative } = buildBrandingLogoPath(userId, '.jpg');
  const outPath = path.join(dir, filename);

  try {
    await sharp(file.buffer)
      .rotate()
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(outPath);
  } catch (e: any) {
    throw new AppError(e?.message?.includes('Input') ? 'Imagem inválida ou corrompida.' : 'Não foi possível processar a imagem.', 400);
  }

  const settings = await getOrCreateSettings(userId);
  const current = mergeDocumentBranding(readPersonalizacaoJson(settings).document_branding);
  if (current.logo_path) safeUnlinkLogo(current.logo_path);

  const next: DocumentBranding = { ...current, logo_path: relative };
  await persistDocumentBranding(userId, next);
  res.status(201).json({ success: true, data: next });
}

/** DELETE /configuracoes/documentos/pdf-branding/logo */
export async function deletePdfBrandingLogo(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const settings = await getOrCreateSettings(userId);
  const current = mergeDocumentBranding(readPersonalizacaoJson(settings).document_branding);
  if (current.logo_path) safeUnlinkLogo(current.logo_path);
  const next: DocumentBranding = { ...current, logo_path: null };
  await persistDocumentBranding(userId, next);
  res.json({ success: true, data: next });
}

/** GET /configuracoes/documentos/pdf-branding/logo-file — stream da logo (Authorization: Bearer) */
export async function getPdfBrandingLogoFile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const settings = await getOrCreateSettings(userId);
  const branding = mergeDocumentBranding(readPersonalizacaoJson(settings).document_branding);
  if (!branding.logo_path) throw new AppError('Nenhuma logo cadastrada.', 404);
  const full = absolutePathFromRelative(branding.logo_path);
  if (!fs.existsSync(full)) throw new AppError('Arquivo da logo não encontrado.', 404);
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(full).pipe(res);
}

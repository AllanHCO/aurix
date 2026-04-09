import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { getCurrentOrganizationId, organizationFilter, assertRecordOwnership } from '../lib/tenant';
import { prisma } from '../lib/prisma';
import { getDefaultPersonalizacao } from '../services/personalizacao.service';
import { getUploadsBaseDir } from '../config/env';

function isFichaComplementarAtivaParaUsuario(usuarioId: string): Promise<boolean> {
  return prisma.companySettings.findUnique({ where: { usuario_id: usuarioId } }).then((s) => {
    const defaults = getDefaultPersonalizacao().modulos.clientes.ativar_ficha_complementar_cliente;
    const raw = s?.personalizacao_json as Record<string, unknown> | null | undefined;
    const mod = raw?.modulos as Record<string, unknown> | undefined;
    const c = mod?.clientes as Record<string, unknown> | undefined;
    if (typeof c?.ativar_ficha_complementar_cliente === 'boolean') {
      return c.ativar_ficha_complementar_cliente;
    }
    return defaults;
  });
}

async function assertClienteDoUsuario(clienteId: string, usuarioId: string) {
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, ...organizationFilter(usuarioId) },
    select: { id: true, nome: true, usuario_id: true }
  });
  assertRecordOwnership(cliente, usuarioId, (c) => c.usuario_id, 'Cliente');
  return cliente;
}

async function assertFichaHabilitada(usuarioId: string) {
  const ok = await isFichaComplementarAtivaParaUsuario(usuarioId);
  if (!ok) {
    throw new AppError('Ficha complementar do cliente não está ativada nas configurações.', 403);
  }
}

const putFichaSchema = z.object({
  observacoes_gerais: z.string().max(50000).nullable().optional(),
  preferencias: z.string().max(50000).nullable().optional(),
  informacoes_adicionais: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).nullable().optional()
});

function jsonInformacoes(
  v: z.infer<typeof putFichaSchema>['informacoes_adicionais']
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (v === undefined) return undefined;
  if (v === null) return Prisma.DbNull;
  return v as Prisma.InputJsonValue;
}

function contentTypeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

/** GET /clientes/:id/ficha */
export const getClienteFicha = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
  await assertFichaHabilitada(usuarioId);
  const { id: clienteId } = req.params;
  const cliente = await assertClienteDoUsuario(clienteId, usuarioId);

  const [ficha, imagens] = await Promise.all([
    prisma.clienteFichaComplementar.findUnique({
      where: { cliente_id: clienteId },
      include: {
        atualizado_por: { select: { id: true, nome: true } }
      }
    }),
    prisma.clienteFichaImagem.findMany({
      where: { cliente_id: clienteId, usuario_id: usuarioId },
      orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, ordem: true, createdAt: true }
    })
  ]);

  res.json({
    cliente: { id: cliente.id, nome: cliente.nome },
    observacoes_gerais: ficha?.observacoes_gerais ?? null,
    preferencias: ficha?.preferencias ?? null,
    informacoes_adicionais: (ficha?.informacoes_adicionais as Record<string, unknown> | null) ?? null,
    atualizado_em: ficha?.updatedAt?.toISOString() ?? null,
    atualizado_por: ficha?.atualizado_por
      ? { id: ficha.atualizado_por.id, nome: ficha.atualizado_por.nome ?? null }
      : null,
    imagens
  });
};

/** PUT /clientes/:id/ficha */
export const putClienteFicha = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
  await assertFichaHabilitada(usuarioId);
  const { id: clienteId } = req.params;
  await assertClienteDoUsuario(clienteId, usuarioId);
  const body = putFichaSchema.parse(req.body);

  const ji = jsonInformacoes(body.informacoes_adicionais);
  await prisma.clienteFichaComplementar.upsert({
    where: { cliente_id: clienteId },
    create: {
      cliente_id: clienteId,
      usuario_id: usuarioId,
      observacoes_gerais: body.observacoes_gerais ?? null,
      preferencias: body.preferencias ?? null,
      ...(ji !== undefined ? { informacoes_adicionais: ji } : {}),
      atualizado_por_usuario_id: usuarioId
    },
    update: {
      observacoes_gerais: body.observacoes_gerais ?? null,
      preferencias: body.preferencias ?? null,
      ...(ji !== undefined ? { informacoes_adicionais: ji } : {}),
      atualizado_por_usuario_id: usuarioId
    }
  });

  const ficha = await prisma.clienteFichaComplementar.findUniqueOrThrow({
    where: { cliente_id: clienteId },
    include: {
      atualizado_por: { select: { id: true, nome: true } }
    }
  });

  res.json({
    cliente_id: ficha.cliente_id,
    observacoes_gerais: ficha.observacoes_gerais,
    preferencias: ficha.preferencias,
    informacoes_adicionais: ficha.informacoes_adicionais,
    atualizado_em: ficha.updatedAt.toISOString(),
    atualizado_por: ficha.atualizado_por
      ? { id: ficha.atualizado_por.id, nome: ficha.atualizado_por.nome ?? null }
      : null
  });
};

/** POST /clientes/:id/ficha/imagens — multipart field "file" */
export const postClienteFichaImagem = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
  await assertFichaHabilitada(usuarioId);
  const { id: clienteId } = req.params;
  await assertClienteDoUsuario(clienteId, usuarioId);

  const file = (req as { file?: { pathRelative?: string } }).file;
  const rel = file?.pathRelative;
  if (!file || !rel) {
    throw new AppError('Envie uma imagem no campo file.', 400);
  }

  const maxOrd = await prisma.clienteFichaImagem.aggregate({
    where: { cliente_id: clienteId },
    _max: { ordem: true }
  });
  const ordem = (maxOrd._max.ordem ?? -1) + 1;

  const row = await prisma.clienteFichaImagem.create({
    data: {
      cliente_id: clienteId,
      usuario_id: usuarioId,
      arquivo_path: rel,
      ordem
    },
    select: { id: true, ordem: true, createdAt: true }
  });

  res.status(201).json(row);
};

/** DELETE /clientes/:id/ficha/imagens/:imageId */
export const deleteClienteFichaImagem = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
  await assertFichaHabilitada(usuarioId);
  const { id: clienteId, imageId } = req.params;

  await assertClienteDoUsuario(clienteId, usuarioId);

  const img = await prisma.clienteFichaImagem.findFirst({
    where: { id: imageId, cliente_id: clienteId, usuario_id: usuarioId }
  });
  if (!img) throw new AppError('Imagem não encontrada', 404);

  const fullPath = path.join(process.cwd(), getUploadsBaseDir(), img.arquivo_path);
  await prisma.clienteFichaImagem.delete({ where: { id: imageId } });
  fs.unlink(fullPath, () => {});

  res.json({ success: true });
};

/** GET /clientes/:id/ficha/imagens/:imageId/file */
export const getClienteFichaImagemFile = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
  await assertFichaHabilitada(usuarioId);
  const { id: clienteId, imageId } = req.params;

  await assertClienteDoUsuario(clienteId, usuarioId);

  const img = await prisma.clienteFichaImagem.findFirst({
    where: { id: imageId, cliente_id: clienteId, usuario_id: usuarioId }
  });
  if (!img) throw new AppError('Imagem não encontrada', 404);

  const fullPath = path.join(process.cwd(), getUploadsBaseDir(), img.arquivo_path);
  if (!fs.existsSync(fullPath)) throw new AppError('Arquivo não encontrado', 404);

  res.setHeader('Content-Type', contentTypeForPath(img.arquivo_path));
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(fullPath).pipe(res);
};

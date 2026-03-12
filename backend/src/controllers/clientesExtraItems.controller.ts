import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { getCurrentOrganizationId, organizationFilter } from '../lib/tenant';

const prisma = new PrismaClient();

const TIPOS = ['veiculo', 'equipamento', 'outro'] as const;

const veiculoDataSchema = z.object({
  marca_modelo: z.string().optional(),
  placa: z.string().optional(),
  km: z.union([z.number(), z.string().transform(Number)]).optional(),
  ano: z.union([z.number(), z.string().transform(Number)]).optional(),
  observacao: z.string().optional()
});

const equipamentoDataSchema = z.object({
  tipo_equipamento: z.string().optional(),
  marca_modelo: z.string().optional(),
  numero_serie_imei: z.string().optional(),
  problema: z.string().optional(),
  observacao: z.string().optional()
});

const outroDataSchema = z.object({
  titulo: z.string().optional(),
  descricao: z.string().optional()
});

const createBodySchema = z.object({
  type: z.enum(TIPOS),
  title: z.string().min(1, 'Título é obrigatório').max(200),
  data_json: z.record(z.unknown()),
  show_on_quote: z.boolean().default(true),
  show_on_sale: z.boolean().default(true),
  internal_only: z.boolean().default(false)
});

const updateBodySchema = createBodySchema.partial();

function normalizeDataJson(type: string, data: Record<string, unknown>): Record<string, unknown> {
  if (type === 'veiculo') return veiculoDataSchema.parse(data) as Record<string, unknown>;
  if (type === 'equipamento') return equipamentoDataSchema.parse(data) as Record<string, unknown>;
  if (type === 'outro') return outroDataSchema.parse(data) as Record<string, unknown>;
  return data;
}

function buildTitle(type: string, data: Record<string, unknown>): string {
  if (type === 'veiculo') {
    const m = data.marca_modelo as string | undefined;
    const p = data.placa as string | undefined;
    if (m && p) return `${m} — ${p}`;
    return (m || p || 'Veículo') as string;
  }
  if (type === 'equipamento') {
    const t = data.tipo_equipamento as string | undefined;
    const m = data.marca_modelo as string | undefined;
    return (t || m || 'Equipamento') as string;
  }
  return (data.titulo as string) || (data.descricao as string) || 'Item';
}

/** GET /clientes/:id/extra-items */
export const listarExtraItems = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
  const { id: clientId } = req.params;
  const cliente = await prisma.cliente.findFirst({ where: { id: clientId, ...organizationFilter(usuarioId) }, select: { id: true } });
  if (!cliente) throw new AppError('Cliente não encontrado', 404);

  const items = await prisma.clientExtraItem.findMany({
    where: { client_id: clientId },
    orderBy: { createdAt: 'asc' }
  });
  res.json(items);
};

/** POST /clientes/:id/extra-items */
export const criarExtraItem = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
  const { id: clientId } = req.params;
  const cliente = await prisma.cliente.findFirst({ where: { id: clientId, ...organizationFilter(usuarioId) }, select: { id: true } });
  if (!cliente) throw new AppError('Cliente não encontrado', 404);

  const parsed = createBodySchema.parse(req.body);
  const dataJson = normalizeDataJson(parsed.type, parsed.data_json as Record<string, unknown>);
  const title = parsed.title.trim() || buildTitle(parsed.type, { ...dataJson, titulo: parsed.title });

  const item = await prisma.clientExtraItem.create({
    data: {
      client_id: clientId,
      type: parsed.type as 'veiculo' | 'equipamento' | 'outro',
      title,
      data_json: dataJson,
      show_on_quote: parsed.show_on_quote,
      show_on_sale: parsed.show_on_sale,
      internal_only: parsed.internal_only
    }
  });
  res.status(201).json(item);
};

/** PUT /clientes/:id/extra-items/:itemId */
export const atualizarExtraItem = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
  const { id: clientId, itemId } = req.params;
  const cliente = await prisma.cliente.findFirst({ where: { id: clientId, ...organizationFilter(usuarioId) }, select: { id: true } });
  if (!cliente) throw new AppError('Cliente não encontrado', 404);
  const item = await prisma.clientExtraItem.findFirst({
    where: { id: itemId, client_id: clientId }
  });
  if (!item) throw new AppError('Item não encontrado', 404);

  const parsed = updateBodySchema.parse(req.body);
  const updates: {
    type?: 'veiculo' | 'equipamento' | 'outro';
    title?: string;
    data_json?: Record<string, unknown>;
    show_on_quote?: boolean;
    show_on_sale?: boolean;
    internal_only?: boolean;
  } = {};
  if (parsed.type !== undefined) updates.type = parsed.type as 'veiculo' | 'equipamento' | 'outro';
  if (parsed.title !== undefined) updates.title = parsed.title.trim();
  if (parsed.data_json !== undefined) {
    const type = updates.type ?? item.type;
    updates.data_json = normalizeDataJson(type, parsed.data_json as Record<string, unknown>);
  }
  if (parsed.show_on_quote !== undefined) updates.show_on_quote = parsed.show_on_quote;
  if (parsed.show_on_sale !== undefined) updates.show_on_sale = parsed.show_on_sale;
  if (parsed.internal_only !== undefined) updates.internal_only = parsed.internal_only;

  if (updates.title === '' && (updates.data_json || updates.type)) {
    updates.title = buildTitle(updates.type ?? item.type, (updates.data_json ?? item.data_json) as Record<string, unknown>);
  }

  const updated = await prisma.clientExtraItem.update({
    where: { id: itemId },
    data: updates
  });
  res.json(updated);
};

/** DELETE /clientes/:id/extra-items/:itemId */
export const excluirExtraItem = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
  const { id: clientId, itemId } = req.params;
  const cliente = await prisma.cliente.findFirst({ where: { id: clientId, ...organizationFilter(usuarioId) }, select: { id: true } });
  if (!cliente) throw new AppError('Cliente não encontrado', 404);
  const item = await prisma.clientExtraItem.findFirst({
    where: { id: itemId, client_id: clientId }
  });
  if (!item) throw new AppError('Item não encontrado', 404);

  await prisma.clientExtraItem.delete({ where: { id: itemId } });
  res.status(204).send();
};

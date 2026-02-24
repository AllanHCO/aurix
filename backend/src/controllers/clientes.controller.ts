import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { getRetencaoThresholds } from '../services/companySettings.service';
import { invalidatePrefix } from '../services/cache.service';

const prisma = new PrismaClient();

export type ClienteStatusAuto = 'ativo' | 'atencao' | 'inativo';

function statusFromDias(diasInativo: number | null, diasAtencao: number, diasInativoThreshold: number): ClienteStatusAuto {
  if (diasInativo == null) return 'ativo';
  if (diasInativo < diasAtencao) return 'ativo';
  if (diasInativo < diasInativoThreshold) return 'atencao';
  return 'inativo';
}

const clienteSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  telefone: z.string().optional(),
  observacoes: z.string().optional()
});

const clienteCreateSchema = clienteSchema;

const clienteUpdateSchema = clienteSchema.partial();

interface ClienteListagem {
  id: string;
  nome: string;
  telefone: string | null;
  observacoes: string | null;
  status: ClienteStatusAuto;
  createdAt: Date;
  updatedAt: Date;
  ultimaCompra: string | null;
  diasInativo: number | null;
}

function inicioFimMesAtual(): { inicio: Date; fim: Date } {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { inicio, fim };
}

const SORT_VALIDOS = ['dias_inativo_desc', 'nome_asc', 'nome_desc'] as const;
const STATUS_VALIDOS = ['ativo', 'atencao', 'inativo'] as const;

/**
 * GET /clientes — lista paginada com status automático (dias desde última venda PAGA).
 * Filtros: status, novos_no_mes, retornaram_no_mes, search, sort, page, limit.
 * Ownership: última compra calculada apenas com vendas do usuario (userId).
 */
export const listarClientes = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { dias_atencao, dias_inativo } = await getRetencaoThresholds(userId);
    const statusFiltro = (req.query.status as string) || '';
    const reativar = req.query.reativar === 'true' || req.query.reativar === '1';
    const novosNoMes = req.query.novos_no_mes === 'true' || req.query.novos_no_mes === '1';
    const retornaramNoMes = req.query.retornaram_no_mes === 'true' || req.query.retornaram_no_mes === '1';
    const searchRaw = (req.query.search as string)?.trim() || '';
    const search = searchRaw.length > 100 ? searchRaw.slice(0, 100) : searchRaw;
    const sort = SORT_VALIDOS.includes(req.query.sort as any) ? (req.query.sort as typeof SORT_VALIDOS[number]) : 'dias_inativo_desc';
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 20));

    const { inicio: inicioMes, fim: fimMes } = inicioFimMesAtual();
    const hoje = new Date();

    // Uma query: última venda PAGA por cliente para este usuário
    const ultimaVendaPorCliente = await prisma.venda.groupBy({
      by: ['cliente_id'],
      where: { usuario_id: userId, status: 'PAGO' },
      _max: { createdAt: true }
    });
    const mapUltima = new Map<string, Date>();
    for (const row of ultimaVendaPorCliente) {
      if (row._max.createdAt) mapUltima.set(row.cliente_id, row._max.createdAt);
    }

    const whereCliente: { nome?: { contains: string; mode: 'insensitive' }; OR?: Array<{ nome?: { contains: string; mode: 'insensitive' }; telefone?: { contains: string; mode: 'insensitive' } }> } = {};
    if (search) {
      whereCliente.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { telefone: { contains: search, mode: 'insensitive' } }
      ];
    }

    const clientes = await prisma.cliente.findMany({
      where: Object.keys(whereCliente).length ? whereCliente : undefined,
      orderBy: sort === 'nome_asc' ? { nome: 'asc' } : sort === 'nome_desc' ? { nome: 'desc' } : { createdAt: 'desc' }
    });

    let lista: ClienteListagem[] = clientes.map((c) => {
      const ultimaVenda = mapUltima.get(c.id) ?? null;
      let diasInativo: number | null = null;
      if (ultimaVenda) {
        const diffMs = hoje.getTime() - ultimaVenda.getTime();
        diasInativo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }
      const status = statusFromDias(diasInativo, dias_atencao, dias_inativo);
      return {
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        observacoes: c.observacoes,
        status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        ultimaCompra: ultimaVenda ? ultimaVenda.toISOString() : null,
        diasInativo
      };
    });

    if (reativar) {
      lista = lista.filter((c) => c.status === 'atencao' || c.status === 'inativo');
    } else if (STATUS_VALIDOS.includes(statusFiltro as any)) {
      lista = lista.filter((c) => c.status === statusFiltro);
    }

    if (novosNoMes || retornaramNoMes) {
      const [vendasNoMes, todasVendas] = await Promise.all([
        prisma.venda.findMany({
          where: { usuario_id: userId, status: 'PAGO', createdAt: { gte: inicioMes, lte: fimMes } },
          select: { cliente_id: true }
        }),
        prisma.venda.findMany({
          where: { usuario_id: userId, status: 'PAGO' },
          select: { cliente_id: true, createdAt: true },
          orderBy: { createdAt: 'asc' }
        })
      ]);
      const clienteIdsComVendaNoMes = new Set(vendasNoMes.map((v) => v.cliente_id));
      const primeiraPorCliente = new Map<string, Date>();
      for (const v of todasVendas) {
        if (!primeiraPorCliente.has(v.cliente_id)) primeiraPorCliente.set(v.cliente_id, v.createdAt);
      }
      const clienteIdsPrimeiraNoMes = new Set<string>();
      const clienteIdsTinhaAntes = new Set<string>();
      for (const [cid, primeira] of primeiraPorCliente) {
        if (primeira >= inicioMes && primeira <= fimMes) clienteIdsPrimeiraNoMes.add(cid);
        if (primeira < inicioMes) clienteIdsTinhaAntes.add(cid);
      }
      if (novosNoMes) lista = lista.filter((c) => clienteIdsPrimeiraNoMes.has(c.id));
      if (retornaramNoMes) lista = lista.filter((c) => clienteIdsComVendaNoMes.has(c.id) && clienteIdsTinhaAntes.has(c.id));
    }

    if (sort === 'dias_inativo_desc') {
      lista.sort((a, b) => {
        const da = a.diasInativo ?? -1;
        const db = b.diasInativo ?? -1;
        return db - da;
      });
    } else if (sort === 'nome_asc') {
      lista.sort((a, b) => a.nome.localeCompare(b.nome));
    } else if (sort === 'nome_desc') {
      lista.sort((a, b) => b.nome.localeCompare(a.nome));
    }

    const total = lista.length;
    const offset = (page - 1) * limit;
    const data = lista.slice(offset, offset + limit);

    res.json({ data, total });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw new AppError('Parâmetros inválidos', 400);
    }
    console.error('Erro ao listar clientes:', error);
    throw new AppError('Erro ao carregar clientes. Tente novamente.', 500);
  }
};

export const obterCliente = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      vendas: {
        where: { usuario_id: userId, status: 'PAGO' },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!cliente) {
    throw new AppError('Cliente não encontrado', 404);
  }

  const ultimaVenda = cliente.vendas[0]?.createdAt ?? null;
  const totalGasto = cliente.vendas.reduce((acc: number, v: { total: unknown }) => acc + Number(v.total), 0);
  let diasInativo: number | null = null;
  if (ultimaVenda) {
    const diffMs = new Date().getTime() - ultimaVenda.getTime();
    diasInativo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
  const { dias_atencao, dias_inativo } = await getRetencaoThresholds(userId);
  const status = statusFromDias(diasInativo, dias_atencao, dias_inativo);

  res.json({
    ...cliente,
    vendas: undefined,
    ultimaCompra: ultimaVenda ? ultimaVenda.toISOString() : null,
    diasInativo,
    status,
    totalGasto
  });
};

export const criarCliente = async (req: AuthRequest, res: Response) => {
  const parsed = clienteCreateSchema.parse(req.body);
  const data = {
    nome: parsed.nome.trim(),
    telefone: parsed.telefone?.trim() || undefined,
    observacoes: parsed.observacoes?.trim() || undefined
  };

  const cliente = await prisma.cliente.create({
    data
  });

  res.status(201).json(cliente);

  invalidatePrefix(`dashboard:summary:${req.userId}:`);
};

export const atualizarCliente = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const body = clienteUpdateSchema.parse(req.body);
  const data: { nome?: string; telefone?: string | null; observacoes?: string | null } = {};
  if (body.nome !== undefined) data.nome = body.nome.trim();
  if (body.telefone !== undefined) data.telefone = body.telefone?.trim() ?? null;
  if (body.observacoes !== undefined) data.observacoes = body.observacoes?.trim() ?? null;

  const clienteExistente = await prisma.cliente.findUnique({
    where: { id }
  });

  if (!clienteExistente) {
    throw new AppError('Cliente não encontrado', 404);
  }

  const cliente = await prisma.cliente.update({
    where: { id },
    data
  });

  res.json(cliente);

  invalidatePrefix(`dashboard:summary:${req.userId}:`);
};

export const excluirCliente = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const cliente = await prisma.cliente.findUnique({
    where: { id }
  });

  if (!cliente) {
    throw new AppError('Cliente não encontrado', 404);
  }

  const venda = await prisma.venda.findFirst({
    where: { cliente_id: id }
  });

  if (venda) {
    throw new AppError('Não é possível excluir cliente que já possui vendas', 400);
  }

  await prisma.cliente.delete({
    where: { id }
  });

  res.status(204).send();
};

export const obterHistoricoCompras = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;

  const cliente = await prisma.cliente.findUnique({
    where: { id }
  });

  if (!cliente) {
    throw new AppError('Cliente não encontrado', 404);
  }

  const vendas = await prisma.venda.findMany({
    where: {
      cliente_id: id,
      usuario_id: userId
    },
    include: {
      itens: {
        include: {
          produto: {
            select: {
              nome: true,
              preco: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  res.json(vendas);
};

const importItemSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').transform((s) => s.trim()),
  telefone: z.string().optional().transform((s) => (s && s.trim()) || undefined),
  observacoes: z.string().optional().transform((s) => (s && s.trim()) || undefined)
});

const importSchema = z.object({
  clientes: z.array(importItemSchema).min(1).max(500)
});

/**
 * POST /clientes/import — importação em lote (CSV/JSON).
 * Valida nome obrigatório, telefone normalizado. Retorna created e erros.
 */
export const importarClientes = async (req: AuthRequest, res: Response) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError('Dados inválidos. Envie { clientes: [ { nome, telefone?, observacoes? } ] } (máx. 500).', 400);
  }
  const { clientes: itens } = parsed.data;
  const errors: string[] = [];
  let created = 0;
  const telefonesVistos = new Set<string>();

  for (let i = 0; i < itens.length; i++) {
    const row = itens[i];
    const nome = row.nome?.trim();
    if (!nome) {
      errors.push(`Linha ${i + 1}: nome obrigatório`);
      continue;
    }
    const telefoneNorm = row.telefone ? row.telefone.replace(/\D/g, '').replace(/^0+/, '') : '';
    if (telefoneNorm && telefonesVistos.has(telefoneNorm)) {
      errors.push(`Linha ${i + 1}: telefone duplicado`);
      continue;
    }
    if (telefoneNorm) telefonesVistos.add(telefoneNorm);

    try {
      await prisma.cliente.create({
        data: {
          nome,
          telefone: row.telefone?.trim() || undefined,
          observacoes: row.observacoes?.trim() || undefined
        }
      });
      created++;
    } catch (e: any) {
      errors.push(`Linha ${i + 1} (${nome}): ${e.message || 'erro ao criar'}`);
    }
  }

  res.status(201).json({ created, total: itens.length, errors });
};

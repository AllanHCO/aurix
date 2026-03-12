import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { getRetencaoThresholds } from '../services/companySettings.service';
import { invalidatePrefix } from '../services/cache.service';
import { getCurrentOrganizationId, organizationFilter, assertRecordOwnership } from '../lib/tenant';

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
  cpf: z.string().max(14).optional(),
  telefone: z.string().optional(),
  observacoes: z.string().optional(),
  time_futebol: z.string().max(120).optional(),
  business_area_id: z.string().uuid().nullable().optional()
});

const clienteCreateSchema = clienteSchema;

const clienteUpdateSchema = clienteSchema.partial();

interface ClienteListagem {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  observacoes: string | null;
  time_futebol: string | null;
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

const SORT_VALIDOS = ['dias_inativo_desc', 'created_at_desc', 'nome_asc', 'nome_desc'] as const;
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
    const businessAreaId = (req.query.business_area_id ?? req.query.areaId) as string | undefined;
    const areaFilter = businessAreaId?.trim() ? businessAreaId.trim() : null;

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

    const whereCliente: { usuario_id: string; business_area_id?: string | null; nome?: { contains: string; mode: 'insensitive' }; OR?: Array<{ nome?: { contains: string; mode: 'insensitive' }; telefone?: { contains: string; mode: 'insensitive' } }> } = {
      usuario_id: userId
    };
    if (areaFilter) whereCliente.business_area_id = areaFilter;
    if (search) {
      whereCliente.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { telefone: { contains: search, mode: 'insensitive' } }
      ];
    }

    const clientes = await prisma.cliente.findMany({
      where: whereCliente,
      select: {
        id: true,
        nome: true,
        cpf: true,
        telefone: true,
        observacoes: true,
        business_area_id: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy:
        sort === 'nome_asc'
          ? { nome: 'asc' }
          : sort === 'nome_desc'
            ? { nome: 'desc' }
            : sort === 'created_at_desc'
              ? { createdAt: 'desc' }
              : { createdAt: 'desc' }
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
        cpf: c.cpf ?? null,
        telefone: c.telefone,
        observacoes: c.observacoes,
        time_futebol: (c as { time_futebol?: string | null }).time_futebol ?? null,
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
    } else if (sort === 'created_at_desc') {
      lista.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
  const userId = getCurrentOrganizationId(req);

  const cliente = await prisma.cliente.findFirst({
    where: { id, ...organizationFilter(userId) },
    select: {
      id: true,
      nome: true,
      cpf: true,
      telefone: true,
      observacoes: true,
      createdAt: true,
      updatedAt: true,
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
    time_futebol: null,
    vendas: undefined,
    ultimaCompra: ultimaVenda ? ultimaVenda.toISOString() : null,
    diasInativo,
    status,
    totalGasto
  });
};

export const criarCliente = async (req: AuthRequest, res: Response) => {
  const parsed = clienteCreateSchema.parse(req.body);
  const cpfDigits = parsed.cpf?.replace(/\D/g, '');
  const cpfFormatted = cpfDigits?.length === 11
    ? `${cpfDigits.slice(0, 3)}.${cpfDigits.slice(3, 6)}.${cpfDigits.slice(6, 9)}-${cpfDigits.slice(9)}`
    : undefined;
  const userId = req.userId!;
  let business_area_id: string | null = null;
  if (parsed.business_area_id != null && parsed.business_area_id.trim() !== '') {
    const area = await prisma.businessArea.findFirst({
      where: { id: parsed.business_area_id.trim(), usuario_id: userId, is_active: true }
    });
    if (area) business_area_id = area.id;
  }
  const data: { usuario_id: string; nome: string; cpf?: string; telefone?: string; observacoes?: string; time_futebol?: string; business_area_id?: string | null } = {
    usuario_id: userId,
    nome: parsed.nome.trim(),
    cpf: cpfFormatted,
    telefone: parsed.telefone?.trim() || undefined,
    observacoes: parsed.observacoes?.trim() || undefined,
    time_futebol: parsed.time_futebol?.trim() || undefined,
    business_area_id
  };
  let cliente;
  try {
    cliente = await prisma.cliente.create({ data });
  } catch (e: any) {
    if (e?.message?.includes('time_futebol')) {
      const { time_futebol: _, ...dataSemTime } = data;
      cliente = await prisma.cliente.create({ data: dataSemTime });
    } else throw e;
  }

  res.status(201).json(cliente);

  invalidatePrefix(`dashboard:summary:${req.userId}:`);
};

export const atualizarCliente = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const body = clienteUpdateSchema.parse(req.body);
  const data: { nome?: string; cpf?: string | null; telefone?: string | null; observacoes?: string | null; time_futebol?: string | null; business_area_id?: string | null } = {};
  if (body.nome !== undefined) data.nome = body.nome.trim();
  if (body.cpf !== undefined) {
    const cpfNorm = body.cpf?.replace(/\D/g, '');
    data.cpf = cpfNorm?.length === 11 ? `${cpfNorm.slice(0, 3)}.${cpfNorm.slice(3, 6)}.${cpfNorm.slice(6, 9)}-${cpfNorm.slice(9)}` : (body.cpf?.trim() || null);
  }
  if (body.telefone !== undefined) data.telefone = body.telefone?.trim() ?? null;
  if (body.observacoes !== undefined) data.observacoes = body.observacoes?.trim() ?? null;
  if (body.time_futebol !== undefined) data.time_futebol = body.time_futebol?.trim() ?? null;
  if (body.business_area_id !== undefined) {
    if (body.business_area_id == null || body.business_area_id.trim() === '') {
      data.business_area_id = null;
    } else {
      const area = await prisma.businessArea.findFirst({
        where: { id: body.business_area_id.trim(), usuario_id: userId, is_active: true }
      });
      data.business_area_id = area?.id ?? null;
    }
  }

  const clienteExistente = await prisma.cliente.findFirst({
    where: { id, ...organizationFilter(userId) },
    select: { id: true, usuario_id: true }
  });

  assertRecordOwnership(clienteExistente, userId, (c) => c?.usuario_id ?? undefined, 'Cliente');

  let cliente;
  try {
    cliente = await prisma.cliente.update({ where: { id }, data });
  } catch (e: any) {
    if (e?.message?.includes('time_futebol') && data.time_futebol !== undefined) {
      const { time_futebol: _, ...dataSemTime } = data;
      cliente = await prisma.cliente.update({ where: { id }, data: dataSemTime });
    } else throw e;
  }

  res.json(cliente);

  invalidatePrefix(`dashboard:summary:${req.userId}:`);
};

export const excluirCliente = async (req: AuthRequest, res: Response) => {
  const userId = getCurrentOrganizationId(req);
  const { id } = req.params;

  const cliente = await prisma.cliente.findFirst({
    where: { id, ...organizationFilter(userId) },
    select: { id: true, usuario_id: true }
  });

  assertRecordOwnership(cliente, userId, (c) => c?.usuario_id ?? undefined, 'Cliente');

  const venda = await prisma.venda.findFirst({
    where: { cliente_id: id, usuario_id: userId }
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
    where: { id },
    select: { id: true }
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
  cpf: z.string().optional().transform((s) => (s && s.trim()) || undefined),
  observacoes: z.string().optional().transform((s) => (s && s.trim()) || undefined),
  time_futebol: z.string().optional().transform((s) => (s && s.trim()) || undefined),
  dados_adicionais_tipo: z.enum(['veiculo', 'equipamento', 'outro']).optional(),
  dados_adicionais_titulo: z.string().optional().transform((s) => (s && s.trim()) || undefined),
  dados_adicionais_descricao: z.string().optional().transform((s) => (s && s.trim()) || undefined),
  dados_adicionais_mostrar_orcamento: z.union([z.boolean(), z.string()]).optional().transform((v) => v === false || v === 'false' || v === '0' ? false : true),
  dados_adicionais_mostrar_venda: z.union([z.boolean(), z.string()]).optional().transform((v) => v === false || v === 'false' || v === '0' ? false : true),
  dados_adicionais_apenas_interno: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === 'true' || v === '1' || v === 'sim')
});

const importSchema = z.object({
  clientes: z.array(importItemSchema).min(1).max(500)
});

const COLUNAS_MODELO = [
  'nome',
  'telefone',
  'cpf',
  'observacoes',
  'time_futebol',
  'dados_adicionais_tipo',
  'dados_adicionais_titulo',
  'dados_adicionais_descricao',
  'dados_adicionais_mostrar_orcamento',
  'dados_adicionais_mostrar_venda',
  'dados_adicionais_apenas_interno'
];

/** GET /clientes/import/modelo — download do arquivo .xlsx modelo para importação. */
export const getModeloImportacao = async (_req: AuthRequest, res: Response) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Clientes', { headerFooter: { firstHeader: 'Modelo de importação de clientes' } });
  sheet.columns = COLUNAS_MODELO.map((c) => ({ header: c, key: c, width: 18 }));
  sheet.addRow({
    nome: 'Exemplo Cliente',
    telefone: '(11) 99999-9999',
    cpf: '123.456.789-00',
    observacoes: 'Cliente exemplo',
    time_futebol: 'Corinthians',
    dados_adicionais_tipo: 'outro',
    dados_adicionais_titulo: 'Observação',
    dados_adicionais_descricao: 'Texto livre',
    dados_adicionais_mostrar_orcamento: 'sim',
    dados_adicionais_mostrar_venda: 'sim',
    dados_adicionais_apenas_interno: 'não'
  });
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="modelo_importacao_clientes.xlsx"');
  res.send(Buffer.from(buffer));
};

/**
 * POST /clientes/import — importação em lote (CSV/JSON).
 * Valida nome obrigatório, telefone normalizado. Retorna created e erros.
 */
export const importarClientes = async (req: AuthRequest, res: Response) => {
  const usuarioId = getCurrentOrganizationId(req);
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
      const cpfDigits = row.cpf?.replace(/\D/g, '');
      const cpfFormatted = cpfDigits?.length === 11
        ? `${cpfDigits.slice(0, 3)}.${cpfDigits.slice(3, 6)}.${cpfDigits.slice(6, 9)}-${cpfDigits.slice(9)}`
        : undefined;
      const clienteCriado = await prisma.cliente.create({
        data: {
          usuario_id: usuarioId,
          nome,
          cpf: cpfFormatted,
          telefone: row.telefone?.trim() || undefined,
          observacoes: row.observacoes?.trim() || undefined,
          time_futebol: row.time_futebol?.trim() || undefined
        }
      });
      if (row.dados_adicionais_titulo && row.dados_adicionais_tipo) {
        const tipo = row.dados_adicionais_tipo as 'veiculo' | 'equipamento' | 'outro';
        const dataJson: Record<string, unknown> =
          tipo === 'outro'
            ? { titulo: row.dados_adicionais_titulo, descricao: row.dados_adicionais_descricao ?? '' }
            : { descricao: row.dados_adicionais_descricao ?? '' };
        await prisma.clientExtraItem.create({
          data: {
            client_id: clienteCriado.id,
            type: tipo,
            title: row.dados_adicionais_titulo,
            data_json: dataJson,
            show_on_quote: row.dados_adicionais_mostrar_orcamento ?? true,
            show_on_sale: row.dados_adicionais_mostrar_venda ?? true,
            internal_only: row.dados_adicionais_apenas_interno ?? false
          }
        });
      }
      created++;
    } catch (e: any) {
      errors.push(`Linha ${i + 1} (${nome}): ${e.message || 'erro ao criar'}`);
    }
  }

  res.status(201).json({ created, total: itens.length, errors });
};

export type PeriodoRetencao = 'semana' | 'mes' | 'trimestre';

function getRangesPeriodoRetencao(periodo: PeriodoRetencao): { inicio: Date; fim: Date; inicioAnt: Date; fimAnt: Date } {
  const now = new Date();
  const fim = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let inicio: Date;
  let inicioAnt: Date;
  let fimAnt: Date;
  if (periodo === 'semana') {
    const dia = now.getDay();
    const diff = dia === 0 ? 6 : dia - 1;
    inicio = new Date(now);
    inicio.setDate(now.getDate() - diff);
    inicio.setHours(0, 0, 0, 0);
    fimAnt = new Date(inicio);
    fimAnt.setDate(fimAnt.getDate() - 1);
    fimAnt.setHours(23, 59, 59, 999);
    inicioAnt = new Date(fimAnt);
    inicioAnt.setDate(inicioAnt.getDate() - 6);
    inicioAnt.setHours(0, 0, 0, 0);
  } else if (periodo === 'trimestre') {
    const mes = now.getMonth();
    const trimestreInicio = mes - (mes % 3);
    inicio = new Date(now.getFullYear(), trimestreInicio, 1, 0, 0, 0, 0);
    fim.setFullYear(now.getFullYear());
    fim.setMonth(trimestreInicio + 3, 0);
    fim.setHours(23, 59, 59, 999);
    fimAnt = new Date(now.getFullYear(), trimestreInicio, 0, 23, 59, 59, 999);
    inicioAnt = new Date(now.getFullYear(), trimestreInicio - 3, 1, 0, 0, 0, 0);
  } else {
    inicio = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    fimAnt = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    inicioAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  }
  return { inicio, fim, inicioAnt, fimAnt };
}

/** GET /clientes/retencao — lista clientes em risco e recuperados no período. Query: periodo=semana|mes|trimestre (default: mes). */
export const getRetencao = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const periodo = (req.query.periodo as PeriodoRetencao) || 'mes';
  const periodoSafe: PeriodoRetencao = ['semana', 'mes', 'trimestre'].includes(periodo) ? periodo : 'mes';
  const { inicio, fim, inicioAnt, fimAnt } = getRangesPeriodoRetencao(periodoSafe);

  const [clientesPeriodoAnteriorAgg, clientesPeriodoAtualAgg, vendasAnteriorComTotal, vendasAtualComCliente] = await Promise.all([
    prisma.venda.groupBy({
      by: ['cliente_id'],
      where: { usuario_id: userId, status: 'PAGO', createdAt: { gte: inicioAnt, lte: fimAnt } }
    }),
    prisma.venda.groupBy({
      by: ['cliente_id'],
      where: { usuario_id: userId, status: 'PAGO', createdAt: { gte: inicio, lte: fim } }
    }),
    prisma.venda.findMany({
      where: { usuario_id: userId, status: 'PAGO', createdAt: { gte: inicioAnt, lte: fimAnt } },
      select: { cliente_id: true, total: true, createdAt: true }
    }),
    prisma.venda.findMany({
      where: { usuario_id: userId, status: 'PAGO', createdAt: { gte: inicio, lte: fim } },
      select: { cliente_id: true, total: true, createdAt: true }
    })
  ]);

  const setAnterior = new Set(clientesPeriodoAnteriorAgg.map((r) => r.cliente_id));
  const setAtual = new Set(clientesPeriodoAtualAgg.map((r) => r.cliente_id));
  const emRiscoIds = [...setAnterior].filter((id) => !setAtual.has(id));
  const recuperadosIds = [...setAtual].filter((id) => !setAnterior.has(id));

  const clientesIds = [...new Set([...emRiscoIds, ...recuperadosIds])];
  if (clientesIds.length === 0) {
    return res.json({ periodo: periodoSafe, clientesEmRisco: [], clientesRecuperados: [] });
  }

  const clientes = await prisma.cliente.findMany({
    where: { id: { in: clientesIds }, usuario_id: userId },
    select: { id: true, nome: true, telefone: true }
  });
  const clientesMap = new Map(clientes.map((c) => [c.id, c]));

  const ultimaVendaPorClienteAnterior = new Map<string, { data: Date; total: number }>();
  for (const v of vendasAnteriorComTotal) {
    const cur = ultimaVendaPorClienteAnterior.get(v.cliente_id);
    if (!cur || v.createdAt > cur.data) {
      ultimaVendaPorClienteAnterior.set(v.cliente_id, { data: v.createdAt, total: Number(v.total ?? 0) });
    }
  }
  const receitaPorClienteAnterior = new Map<string, number>();
  for (const v of vendasAnteriorComTotal) {
    receitaPorClienteAnterior.set(v.cliente_id, (receitaPorClienteAnterior.get(v.cliente_id) ?? 0) + Number(v.total ?? 0));
  }
  const countVendasPorClienteAnterior = new Map<string, number>();
  for (const v of vendasAnteriorComTotal) {
    countVendasPorClienteAnterior.set(v.cliente_id, (countVendasPorClienteAnterior.get(v.cliente_id) ?? 0) + 1);
  }

  const clientesEmRisco: Array<{
    id: string;
    nome: string;
    telefone: string | null;
    ultimaCompra: string;
    diasSemComprar: number;
    receitaMedia: number;
  }> = [];
  const hoje = new Date();
  for (const id of emRiscoIds) {
    const c = clientesMap.get(id);
    if (!c) continue;
    const ultima = ultimaVendaPorClienteAnterior.get(id);
    if (!ultima) continue;
    const diasSemComprar = Math.floor((hoje.getTime() - ultima.data.getTime()) / (1000 * 60 * 60 * 24));
    const totalReceita = receitaPorClienteAnterior.get(id) ?? 0;
    const qtdVendas = countVendasPorClienteAnterior.get(id) ?? 1;
    clientesEmRisco.push({
      id: c.id,
      nome: c.nome,
      telefone: c.telefone,
      ultimaCompra: ultima.data.toISOString().slice(0, 10),
      diasSemComprar,
      receitaMedia: Math.round((totalReceita / qtdVendas) * 100) / 100
    });
  }
  clientesEmRisco.sort((a, b) => b.diasSemComprar - a.diasSemComprar);

  const primeiraVendaRecuperadoPorCliente = new Map<string, { data: Date; total: number }>();
  for (const v of vendasAtualComCliente) {
    if (!recuperadosIds.includes(v.cliente_id)) continue;
    const cur = primeiraVendaRecuperadoPorCliente.get(v.cliente_id);
    if (!cur || v.createdAt < cur.data) {
      primeiraVendaRecuperadoPorCliente.set(v.cliente_id, { data: v.createdAt, total: Number(v.total ?? 0) });
    }
  }
  const ultimaVendaAnteriorPorRecuperado = new Map<string, Date>();
  for (const v of vendasAnteriorComTotal) {
    if (!recuperadosIds.includes(v.cliente_id)) continue;
    const cur = ultimaVendaAnteriorPorRecuperado.get(v.cliente_id);
    if (!cur || v.createdAt > cur) {
      ultimaVendaAnteriorPorRecuperado.set(v.cliente_id, v.createdAt);
    }
  }
  const clientesRecuperados: Array<{
    id: string;
    nome: string;
    dataNovaCompra: string;
    valorVenda: number;
    diasFicouSemComprar: number;
  }> = [];
  for (const id of recuperadosIds) {
    const c = clientesMap.get(id);
    if (!c) continue;
    const nova = primeiraVendaRecuperadoPorCliente.get(id);
    if (!nova) continue;
    const ultimaAnt = ultimaVendaAnteriorPorRecuperado.get(id);
    const diasFicouSemComprar = ultimaAnt
      ? Math.floor((nova.data.getTime() - ultimaAnt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    clientesRecuperados.push({
      id: c.id,
      nome: c.nome,
      dataNovaCompra: nova.data.toISOString().slice(0, 10),
      valorVenda: nova.total,
      diasFicouSemComprar
    });
  }
  clientesRecuperados.sort((a, b) => b.valorVenda - a.valorVenda);

  res.json({ periodo: periodoSafe, clientesEmRisco, clientesRecuperados });
};

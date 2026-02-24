import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

/** Retorna início e fim do período anterior equivalente (mesmo mês anterior). */
function periodoAnteriorEquivalente(inicio: Date, fim: Date): { inicio: Date; fim: Date } {
  const antFim = new Date(inicio);
  antFim.setDate(antFim.getDate() - 1);
  antFim.setHours(23, 59, 59, 999);
  const antInicio = new Date(antFim.getFullYear(), antFim.getMonth(), 1, 0, 0, 0, 0);
  return { inicio: antInicio, fim: antFim };
}

/** Valida e normaliza datas; lança AppError se inválidas. */
function parsePeriodo(dataInicial: unknown, dataFinal: unknown): { inicio: Date; fim: Date } {
  if (!dataInicial || !dataFinal || typeof dataInicial !== 'string' || typeof dataFinal !== 'string') {
    throw new AppError('Data inicial e data final são obrigatórias', 400);
  }
  const inicio = new Date(dataInicial.trim());
  const fim = new Date(dataFinal.trim());
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    throw new AppError('Datas inválidas', 400);
  }
  inicio.setHours(0, 0, 0, 0);
  fim.setHours(23, 59, 59, 999);
  if (fim < inicio) {
    throw new AppError('Data final não pode ser anterior à data inicial', 400);
  }
  return { inicio, fim };
}

/**
 * GET /relatorios/periodo?dataInicial=&dataFinal=&page=&limit=&order=
 * Endpoint único: faturamento (só PAGO), total vendas (só PAGAS), ticket médio,
 * comparação com período anterior, lista de vendas (todas do período) com paginação.
 */
export const getRelatorioPeriodo = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { dataInicial, dataFinal, page, limit, order } = req.query;

  const { inicio, fim } = parsePeriodo(dataInicial, dataFinal);

  const pageNum = Math.max(1, parseInt(String(page || '1'), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || '20'), 10) || 20));
  const orderDir = order === 'asc' ? 'asc' : 'desc';

  const { inicio: antInicio, fim: antFim } = periodoAnteriorEquivalente(inicio, fim);

  const whereUsuario = { usuario_id: userId };
  const wherePeriodo = { createdAt: { gte: inicio, lte: fim } };
  const whereAnterior = { createdAt: { gte: antInicio, lte: antFim } };

  const [
    faturamentoAtualResult,
    totalVendasPagas,
    faturamentoAnteriorResult,
    totalLista,
    vendas
  ] = await Promise.all([
    prisma.venda.aggregate({
      where: { ...whereUsuario, ...wherePeriodo, status: 'PAGO' },
      _sum: { total: true }
    }),
    prisma.venda.count({
      where: { ...whereUsuario, ...wherePeriodo, status: 'PAGO' }
    }),
    prisma.venda.aggregate({
      where: { ...whereUsuario, ...whereAnterior, status: 'PAGO' },
      _sum: { total: true }
    }),
    prisma.venda.count({
      where: { ...whereUsuario, ...wherePeriodo }
    }),
    prisma.venda.findMany({
      where: { ...whereUsuario, ...wherePeriodo },
      include: {
        cliente: { select: { nome: true } }
      },
      orderBy: { createdAt: orderDir },
      skip: (pageNum - 1) * limitNum,
      take: limitNum
    })
  ]);

  const faturamento_total = Number(faturamentoAtualResult._sum.total ?? 0);
  const faturamento_periodo_anterior = Number(faturamentoAnteriorResult._sum.total ?? 0);

  let variacao_percentual: number | null = null;
  if (faturamento_periodo_anterior > 0) {
    variacao_percentual = ((faturamento_total - faturamento_periodo_anterior) / faturamento_periodo_anterior) * 100;
  } else if (totalVendasPagas > 0) {
    variacao_percentual = 100;
  }

  const ticket_medio = totalVendasPagas > 0 ? faturamento_total / totalVendasPagas : 0;

  const lista_vendas = vendas.map((v) => ({
    id: v.id,
    createdAt: v.createdAt,
    cliente: v.cliente.nome,
    total: Number(v.total),
    status: v.status,
    forma_pagamento: v.forma_pagamento
  }));

  res.json({
    periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
    periodo_anterior: { inicio: antInicio.toISOString(), fim: antFim.toISOString() },
    faturamento_total,
    total_vendas: totalVendasPagas,
    ticket_medio,
    faturamento_periodo_anterior,
    variacao_percentual,
    lista_vendas,
    paginacao: {
      page: pageNum,
      limit: limitNum,
      total: totalLista,
      total_paginas: Math.ceil(totalLista / limitNum) || 1
    }
  });
};

/** GET /relatorios — compatível com novo contrato (redireciona lógica para getRelatorioPeriodo). */
export const gerarRelatorio = getRelatorioPeriodo;

/**
 * GET /relatorios/exportar?dataInicial=&dataFinal=
 * Exporta somente vendas PAGAS do período. CSV UTF-8, nome com período.
 */
export const exportarCSV = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { dataInicial, dataFinal } = req.query;

  const { inicio, fim } = parsePeriodo(dataInicial, dataFinal);

  const vendas = await prisma.venda.findMany({
    where: {
      usuario_id: userId,
      status: 'PAGO',
      createdAt: { gte: inicio, lte: fim }
    },
    include: {
      cliente: { select: { nome: true } },
      itens: {
        include: {
          produto: { select: { nome: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const BOM = '\uFEFF';
  const headers = ['Data', 'Cliente', 'Produtos', 'Total', 'Forma de pagamento', 'Desconto %'];
  const rows = vendas.map((v) => {
    const total = Number(v.total);
    const desconto = Number(v.desconto);
    const totalBruto = total + desconto;
    const descontoPct = totalBruto > 0 ? ((desconto / totalBruto) * 100).toFixed(1) : '0';
    const produtos = v.itens.map((i) => `${i.produto.nome} (${i.quantidade})`).join('; ');
    return [
      new Date(v.createdAt).toLocaleDateString('pt-BR'),
      v.cliente.nome,
      produtos,
      total.toFixed(2),
      v.forma_pagamento,
      descontoPct
    ];
  });

  const escape = (cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`;
  const csv = BOM + [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\r\n');

  const dI = inicio.getDate().toString().padStart(2, '0');
  const mI = (inicio.getMonth() + 1).toString().padStart(2, '0');
  const dF = fim.getDate().toString().padStart(2, '0');
  const mF = (fim.getMonth() + 1).toString().padStart(2, '0');
  const filename = `relatorio_${dI}-${mI}_${dF}-${mF}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
};

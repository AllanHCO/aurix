import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

type PeriodoDashboard = 'este_mes' | 'ultimos_3_meses';

function getPeriodoRange(periodo: PeriodoDashboard): { inicio: Date; fim: Date } {
  const now = new Date();
  const fim = new Date();
  if (periodo === 'este_mes') {
    const inicio = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    return { inicio, fim };
  }
  const inicio = new Date(now);
  inicio.setUTCMonth(inicio.getUTCMonth() - 3);
  inicio.setUTCHours(0, 0, 0, 0);
  return { inicio, fim };
}

export const getDashboard = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const periodo = ((req.query.periodo as PeriodoDashboard) || 'este_mes') as PeriodoDashboard;
  const validPeriodos: PeriodoDashboard[] = ['este_mes', 'ultimos_3_meses'];
  const periodoSafe = validPeriodos.includes(periodo) ? periodo : 'este_mes';

  const { inicio, fim } = getPeriodoRange(periodoSafe);

  // Faturamento do período: SUM(total) onde status = PAGO e data no período (fonte: tabela vendas)
  const faturamentoResult = await prisma.venda.aggregate({
    where: {
      usuario_id: userId,
      status: 'PAGO',
      createdAt: { gte: inicio, lte: fim }
    },
    _sum: { total: true }
  });
  const faturamento = Number(faturamentoResult._sum.total ?? 0);

  // Total de vendas no período (count)
  const totalVendas = await prisma.venda.count({
    where: {
      usuario_id: userId,
      createdAt: { gte: inicio, lte: fim }
    }
  });

  // Produtos com estoque baixo (estoque_atual <= estoque_minimo)
  const produtosEstoqueBaixo = await prisma.$queryRaw<
    Array<{ id: string; nome: string; estoque_atual: number; estoque_minimo: number }>
  >`
    SELECT id, nome, estoque_atual, estoque_minimo
    FROM produtos
    WHERE estoque_atual <= estoque_minimo
  `;

  // Últimas 5 vendas
  const ultimasVendas = await prisma.venda.findMany({
    where: {
      usuario_id: userId
    },
    take: 5,
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      cliente: {
        select: {
          nome: true
        }
      },
      itens: {
        include: {
          produto: {
            select: {
              nome: true
            }
          }
        }
      }
    }
  });

  res.json({
    periodo: periodoSafe,
    faturamento,
    totalVendas,
    produtosEstoqueBaixo,
    ultimasVendas
  });
};

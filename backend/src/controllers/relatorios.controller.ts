import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const gerarRelatorio = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { dataInicial, dataFinal } = req.query;

  if (!dataInicial || !dataFinal) {
    return res.status(400).json({
      error: 'Data inicial e data final são obrigatórias'
    });
  }

  const inicio = new Date(dataInicial as string);
  const fim = new Date(dataFinal as string);
  fim.setHours(23, 59, 59, 999);

  const vendas = await prisma.venda.findMany({
    where: {
      usuario_id: userId,
      createdAt: {
        gte: inicio,
        lte: fim
      }
    },
    include: {
      cliente: {
        select: {
          nome: true
        }
      }
    }
  });

  // Calcular métricas
  const totalVendas = vendas.length;
  const vendasPagas = vendas.filter(v => v.status === 'PAGO');
  const faturamento = vendasPagas.reduce(
    (acc, venda) => acc + Number(venda.total),
    0
  );

  res.json({
    periodo: {
      inicio: inicio.toISOString(),
      fim: fim.toISOString()
    },
    totalVendas,
    faturamento,
    vendas
  });
};

export const exportarCSV = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { dataInicial, dataFinal } = req.query;

  if (!dataInicial || !dataFinal) {
    return res.status(400).json({
      error: 'Data inicial e data final são obrigatórias'
    });
  }

  const inicio = new Date(dataInicial as string);
  const fim = new Date(dataFinal as string);
  fim.setHours(23, 59, 59, 999);

  const vendas = await prisma.venda.findMany({
    where: {
      usuario_id: userId,
      createdAt: {
        gte: inicio,
        lte: fim
      }
    },
    include: {
      cliente: {
        select: {
          nome: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Gerar CSV
  const headers = ['Data', 'Cliente', 'Total', 'Status', 'Forma de Pagamento'];
  const rows = vendas.map(venda => [
    new Date(venda.createdAt).toLocaleDateString('pt-BR'),
    venda.cliente.nome,
    Number(venda.total).toFixed(2),
    venda.status,
    venda.forma_pagamento
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-${Date.now()}.csv"`);
  res.send(csv);
};

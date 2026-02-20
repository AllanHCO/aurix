import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getDashboard = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  // Data atual
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);

  // Faturamento do mês (apenas vendas pagas)
  const vendasPagas = await prisma.venda.findMany({
    where: {
      usuario_id: userId,
      status: 'PAGO',
      createdAt: {
        gte: inicioMes,
        lte: fimMes
      }
    },
    select: {
      total: true
    }
  });

  const faturamento = vendasPagas.reduce(
    (acc: number, venda: { total: unknown }) => acc + Number(venda.total),
    0
  );

  // Total de vendas do mês
  const totalVendas = await prisma.venda.count({
    where: {
      usuario_id: userId,
      createdAt: {
        gte: inicioMes,
        lte: fimMes
      }
    }
  });

  // Produtos com estoque baixo
  const produtosEstoqueBaixo = await prisma.produto.findMany({
    where: {
      estoque_atual: {
        lte: prisma.produto.fields.estoque_minimo
      }
    },
    select: {
      id: true,
      nome: true,
      estoque_atual: true,
      estoque_minimo: true
    }
  });

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
    faturamento,
    totalVendas,
    produtosEstoqueBaixo,
    ultimasVendas
  });
};

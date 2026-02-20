import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

const clienteSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  telefone: z.string().optional(),
  observacoes: z.string().optional()
});

type StatusInatividade = 'ATIVO' | 'ATENCAO' | 'INATIVO' | 'NOVO';

interface ClienteComInatividade {
  id: string;
  nome: string;
  telefone: string | null;
  observacoes: string | null;
  createdAt: Date;
  updatedAt: Date;
  ultimaCompra: string | null;
  diasInativo: number | null;
  statusInatividade: StatusInatividade;
}

export const listarClientes = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const clientes = await prisma.cliente.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        vendas: {
          where: {
            status: 'PAGO',
            usuario_id: userId
          },
          select: {
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    const hoje = new Date();

    const clientesComInatividade: ClienteComInatividade[] = clientes.map((cliente) => {
      const ultimaVenda = cliente.vendas[0]?.createdAt ?? null;

      let diasInativo: number | null = null;
      let statusInatividade: StatusInatividade;

      if (!ultimaVenda) {
        statusInatividade = 'NOVO';
      } else {
        const diffMs = hoje.getTime() - ultimaVenda.getTime();
        diasInativo = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diasInativo < 30) {
          statusInatividade = 'ATIVO';
        } else if (diasInativo <= 45) {
          statusInatividade = 'ATENCAO';
        } else {
          statusInatividade = 'INATIVO';
        }
      }

      const clienteFormatado = {
        id: cliente.id,
        nome: cliente.nome,
        telefone: cliente.telefone,
        observacoes: cliente.observacoes,
        createdAt: cliente.createdAt,
        updatedAt: cliente.updatedAt,
        ultimaCompra: ultimaVenda ? ultimaVenda.toISOString() : null,
        diasInativo,
        statusInatividade
      };

      return clienteFormatado;
    });

    console.log('Clientes processados:', JSON.stringify(clientesComInatividade, null, 2));
    res.json(clientesComInatividade);
  } catch (error: any) {
    console.error('Erro ao listar clientes:', error);
    throw new AppError('Erro ao listar clientes', 500);
  }
};

export const obterCliente = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      vendas: {
        where: {
          status: 'PAGO'
        },
        select: {
          total: true
        }
      }
    }
  });

  if (!cliente) {
    throw new AppError('Cliente não encontrado', 404);
  }

  // Calcular total gasto (apenas vendas pagas)
  const totalGasto = cliente.vendas.reduce(
    (acc: number, venda: { total: unknown }) => acc + Number(venda.total),
    0
  );

  res.json({
    ...cliente,
    totalGasto
  });
};

export const criarCliente = async (req: AuthRequest, res: Response) => {
  const data = clienteSchema.parse(req.body);

  const cliente = await prisma.cliente.create({
    data
  });

  res.status(201).json(cliente);
};

export const atualizarCliente = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const data = clienteSchema.partial().parse(req.body);

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
};

export const excluirCliente = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const cliente = await prisma.cliente.findUnique({
    where: { id }
  });

  if (!cliente) {
    throw new AppError('Cliente não encontrado', 404);
  }

  // Verificar se cliente tem vendas
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

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

const clienteCreateSchema = clienteSchema.extend({
  status: z.enum(['ativo', 'atencao', 'inativo']).optional()
});

export type ClienteStatusManual = 'ativo' | 'atencao' | 'inativo';

const clienteUpdateSchema = clienteSchema.extend({
  status: z.enum(['ativo', 'atencao', 'inativo']).optional()
}).partial();

interface ClienteListagem {
  id: string;
  nome: string;
  telefone: string | null;
  observacoes: string | null;
  status: ClienteStatusManual;
  createdAt: Date;
  updatedAt: Date;
  ultimaCompra: string | null;
  diasInativo: number | null;
}

interface ClienteComVendas {
  id: string;
  nome: string;
  telefone: string | null;
  observacoes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  vendas: { createdAt: Date }[];
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

    const lista: ClienteListagem[] = clientes.map((cliente: ClienteComVendas) => {
      const ultimaVenda = cliente.vendas[0]?.createdAt ?? null;
      let diasInativo: number | null = null;
      if (ultimaVenda) {
        const diffMs = hoje.getTime() - ultimaVenda.getTime();
        diasInativo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }
      const status = (cliente.status === 'ativo' || cliente.status === 'atencao' || cliente.status === 'inativo')
        ? cliente.status
        : 'ativo';

      return {
        id: cliente.id,
        nome: cliente.nome,
        telefone: cliente.telefone,
        observacoes: cliente.observacoes,
        status,
        createdAt: cliente.createdAt,
        updatedAt: cliente.updatedAt,
        ultimaCompra: ultimaVenda ? ultimaVenda.toISOString() : null,
        diasInativo
      };
    });

    res.json(lista);
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
  const parsed = clienteCreateSchema.parse(req.body);
  const data = {
    nome: parsed.nome,
    telefone: parsed.telefone ?? undefined,
    observacoes: parsed.observacoes ?? undefined,
    ...(parsed.status && { status: parsed.status })
  };

  const cliente = await prisma.cliente.create({
    data
  });

  res.status(201).json(cliente);
};

export const atualizarCliente = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const data = clienteUpdateSchema.parse(req.body);

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

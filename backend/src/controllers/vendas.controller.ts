import { Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

const itemVendaSchema = z.object({
  produto_id: z.string().uuid('ID do produto inválido'),
  quantidade: z.union([z.number(), z.string()]).transform(val => Number(val)).pipe(z.number().int().positive('Quantidade deve ser positiva')),
  preco_unitario: z.union([z.number(), z.string()]).transform(val => Number(val)).pipe(z.number().positive('Preço unitário deve ser positivo'))
});

const vendaSchema = z.object({
  cliente_id: z.string().uuid('ID do cliente inválido'),
  itens: z.array(itemVendaSchema).min(1, 'Venda deve ter pelo menos um item'),
  desconto: z.union([z.number(), z.string()]).transform(val => Number(val)).pipe(z.number().nonnegative('Desconto não pode ser negativo')).default(0),
  forma_pagamento: z.string().min(1, 'Forma de pagamento é obrigatória'),
  status: z.enum(['PAGO', 'PENDENTE']).default('PENDENTE')
});

export const listarVendas = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const vendas = await prisma.venda.findMany({
    where: {
      usuario_id: userId
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
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  res.json(vendas);
};

export const obterVenda = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;

  const venda = await prisma.venda.findFirst({
    where: {
      id,
      usuario_id: userId
    },
    include: {
      cliente: true,
      itens: {
        include: {
          produto: true
        }
      }
    }
  });

  if (!venda) {
    throw new AppError('Venda não encontrada', 404);
  }

  res.json(venda);
};

export const criarVenda = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const data = vendaSchema.parse(req.body);

    // Verificar se cliente existe e pertence ao usuário
    const cliente = await prisma.cliente.findFirst({
      where: { 
        id: data.cliente_id,
        // Nota: Se houver relação de cliente com usuário, adicionar aqui
      }
    });

    if (!cliente) {
      throw new AppError('Cliente não encontrado', 404);
    }

    // Validar produtos e estoque
    for (const item of data.itens) {
    const produto = await prisma.produto.findUnique({
      where: { id: item.produto_id }
    });

    if (!produto) {
      throw new AppError(`Produto ${item.produto_id} não encontrado`, 404);
    }

    // Se venda for PAGA, verificar estoque
    if (data.status === 'PAGO') {
      if (produto.estoque_atual < item.quantidade) {
        throw new AppError(
          `Estoque insuficiente para o produto ${produto.nome}. Disponível: ${produto.estoque_atual}`,
          400
        );
      }
    }
  }

    // Calcular total (garantir que são números)
    const subtotal = data.itens.reduce(
      (acc, item) => acc + Number(item.preco_unitario) * Number(item.quantidade),
      0
    );
    const desconto = Number(data.desconto) || 0;
    const total = subtotal - desconto;

    // Criar venda e itens em transação
    const venda = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Criar venda
      const novaVenda = await tx.venda.create({
        data: {
          cliente_id: data.cliente_id,
          usuario_id: userId,
          total: total,
          desconto: desconto,
          forma_pagamento: data.forma_pagamento,
          status: data.status,
          itens: {
            create: data.itens.map(item => ({
              produto_id: item.produto_id,
              quantidade: item.quantidade,
              preco_unitario: item.preco_unitario
            }))
          }
        },
      include: {
        cliente: true,
        itens: {
          include: {
            produto: true
          }
        }
      }
    });

    // Se venda for PAGA, atualizar estoque
    if (data.status === 'PAGO') {
      for (const item of data.itens) {
        await tx.produto.update({
          where: { id: item.produto_id },
          data: {
            estoque_atual: {
              decrement: item.quantidade
            }
          }
        });
      }
    }

      return novaVenda;
    });

    res.status(201).json(venda);
  } catch (error: any) {
    // Se já é um AppError, apenas relançar
    if (error instanceof AppError) {
      throw error;
    }
    
    // Se é erro de validação do Zod, converter para AppError
    if (error.name === 'ZodError') {
      const firstError = error.errors[0];
      throw new AppError(firstError.message || 'Dados inválidos', 400);
    }
    
    // Log detalhado do erro para debug
    console.error('=== ERRO AO CRIAR VENDA ===');
    console.error('Tipo do erro:', error?.constructor?.name);
    console.error('Mensagem:', error?.message);
    console.error('Stack:', error?.stack);
    console.error('Código:', error?.code);
    console.error('Erro completo:', JSON.stringify(error, null, 2));
    console.error('===========================');
    
    throw error;
  }
};

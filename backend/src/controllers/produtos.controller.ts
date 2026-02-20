import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

const produtoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  preco: z.number().positive('Preço deve ser positivo'),
  custo: z.number().nonnegative('Custo não pode ser negativo'),
  estoque_atual: z.number().int().nonnegative('Estoque atual não pode ser negativo'),
  estoque_minimo: z.number().int().nonnegative('Estoque mínimo não pode ser negativo')
});

export const listarProdutos = async (req: AuthRequest, res: Response) => {
  const produtos = await prisma.produto.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  });

  res.json(produtos);
};

export const obterProduto = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const produto = await prisma.produto.findUnique({
    where: { id }
  });

  if (!produto) {
    throw new AppError('Produto não encontrado', 404);
  }

  res.json(produto);
};

export const criarProduto = async (req: AuthRequest, res: Response) => {
  const data = produtoSchema.parse(req.body);

  const produto = await prisma.produto.create({
    data
  });

  res.status(201).json(produto);
};

export const atualizarProduto = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const data = produtoSchema.partial().parse(req.body);

  // Verificar se produto existe
  const produtoExistente = await prisma.produto.findUnique({
    where: { id }
  });

  if (!produtoExistente) {
    throw new AppError('Produto não encontrado', 404);
  }

  // Validar estoque não negativo
  if (data.estoque_atual !== undefined && data.estoque_atual < 0) {
    throw new AppError('Estoque não pode ser negativo', 400);
  }

  const produto = await prisma.produto.update({
    where: { id },
    data
  });

  res.json(produto);
};

export const excluirProduto = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Verificar se produto existe
  const produto = await prisma.produto.findUnique({
    where: { id }
  });

  if (!produto) {
    throw new AppError('Produto não encontrado', 404);
  }

  // Verificar se produto está em alguma venda
  const itemVenda = await prisma.itemVenda.findFirst({
    where: { produto_id: id }
  });

  if (itemVenda) {
    throw new AppError('Não é possível excluir produto que já foi vendido', 400);
  }

  await prisma.produto.delete({
    where: { id }
  });

  res.status(204).send();
};

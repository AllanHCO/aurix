import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

const NOMES_CATEGORIAS = ['Acessórios', 'Joias', 'Relógios', 'Semi-joias', 'Presentes'];
const NOMES_PRODUTOS = [
  'Anel prata', 'Brinco ouro', 'Colar pérola', 'Pulseira dourada', 'Relógio clássico',
  'Anel diamante', 'Brinco pedra', 'Colar coração', 'Pulseira prata', 'Relógio esportivo',
  'Gargantilha', 'Piercing', 'Choker', 'Aliança', 'Broche',
  'Conjunto anel e brinco', 'Kit presente', 'Porta-joias', 'Caixa música', 'Pingente'
];
const NOMES_CLIENTES = [
  'Ana Silva', 'Bruno Santos', 'Carla Lima', 'Diego Oliveira', 'Elena Costa',
  'Fernando Souza', 'Gabriela Rocha', 'Henrique Alves', 'Isabela Martins', 'João Pereira',
  'Larissa Ferreira', 'Miguel Ribeiro', 'Natália Carvalho', 'Otávio Nascimento', 'Paula Dias',
  'Ricardo Gomes', 'Sandra Mendes', 'Thiago Barbosa', 'Úrsula Castro', 'Vitor Lopes',
  'Wanessa Pinto', 'Xavier Teixeira', 'Yasmin Correia', 'Zélia Araújo', 'Amanda Reis',
  'Bernardo Azevedo', 'Camila Moreira', 'Daniel Campos', 'Edna Cardoso', 'Fábio Nunes'
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/** POST /dev/seed-demo?months=3 — apenas em desenvolvimento ou ALLOW_SEED=1. Preenche dados do usuário autenticado. */
export const seedDemo = async (req: AuthRequest, res: Response) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== '1') {
    throw new AppError('Seed desabilitado em produção.', 404);
  }
  const userId = req.userId!;
  const months = Math.min(3, Math.max(1, parseInt(String(req.query.months), 10) || 3));

  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - months, 1, 0, 0, 0, 0);

  const categorias = await Promise.all(
    NOMES_CATEGORIAS.map((nome, i) =>
      prisma.categoria.upsert({
        where: { nome: `Demo ${nome} ${userId.slice(0, 6)}` },
        create: { nome: `Demo ${nome} ${userId.slice(0, 6)}` },
        update: {}
      })
    )
  );

  const produtos: { id: string; preco: number; nome: string }[] = [];
  for (let i = 0; i < Math.min(25, NOMES_PRODUTOS.length + 10); i++) {
    const nome = NOMES_PRODUTOS[i % NOMES_PRODUTOS.length] + ` ${i}`;
    const cat = categorias[i % categorias.length];
    const preco = randomInt(50, 2000);
    const estoqueMin = randomInt(2, 10);
    const estoqueAtual = randomInt(0, 15);
    const p = await prisma.produto.upsert({
      where: { nome_categoria_id: { nome, categoria_id: cat.id } },
      create: {
        nome,
        categoria_id: cat.id,
        preco,
        custo: Math.round(preco * 0.5),
        estoque_atual: estoqueAtual,
        estoque_minimo: estoqueMin
      },
      update: {}
    });
    produtos.push({ id: p.id, preco: Number(p.preco), nome: p.nome });
  }

  const numClientes = randomInt(35, 70);
  const clientes: { id: string }[] = [];
  for (let i = 0; i < numClientes; i++) {
    const nome = NOMES_CLIENTES[i % NOMES_CLIENTES.length] + ` ${i}`;
    const c = await prisma.cliente.create({
      data: {
        nome,
        telefone: `1199${String(10000000 + i).slice(-8)}`
      }
    });
    clientes.push({ id: c.id });
  }

  const numVendasPago = randomInt(35, 55);
  const numVendasPendente = randomInt(6, 14);
  const formas = ['PIX', 'Cartão', 'Dinheiro', 'Transferência'];

  for (let i = 0; i < numVendasPago + numVendasPendente; i++) {
    const status = i < numVendasPago ? 'PAGO' : 'PENDENTE';
    const createdAt = randomDate(start, end);
    const cliente = clientes[randomInt(0, clientes.length - 1)];
    const numItens = randomInt(1, 4);
    let total = 0;
    const itens: { produto_id: string; quantidade: number; preco_unitario: number }[] = [];
    const used = new Set<string>();
    for (let j = 0; j < numItens; j++) {
      const prod = produtos[randomInt(0, produtos.length - 1)];
      if (used.has(prod.id)) continue;
      used.add(prod.id);
      const qtd = randomInt(1, 3);
      itens.push({ produto_id: prod.id, quantidade: qtd, preco_unitario: prod.preco });
      total += qtd * prod.preco;
    }
    if (itens.length === 0) continue;
    const venda = await prisma.venda.create({
      data: {
        usuario_id: userId,
        cliente_id: cliente.id,
        total,
        desconto: 0,
        forma_pagamento: formas[randomInt(0, formas.length - 1)],
        status,
        createdAt
      }
    });
    await prisma.itemVenda.createMany({
      data: itens.map((item) => ({
        venda_id: venda.id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario
      }))
    });
  }

  res.json({
    success: true,
    message: `Seed concluído: ${months} mês(es). Categorias: ${categorias.length}, Produtos: ${produtos.length}, Clientes: ${clientes.length}, Vendas: ${numVendasPago + numVendasPendente}.`
  });
};

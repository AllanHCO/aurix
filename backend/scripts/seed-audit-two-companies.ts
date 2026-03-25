/**
 * Seed para auditoria: cria duas empresas (Empresa A e Empresa B) com dados distintos.
 * Uso: tsx scripts/seed-audit-two-companies.ts
 * NUNCA rodar em produção (só dev/staging com banco local ou _dev).
 */
import '../src/config/loadEnv';
import { isProduction } from '../src/config/env';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SENHA_AUDIT = 'Audit@123';

async function main() {
  if (isProduction) {
    console.error('Seed auditoria: BLOQUEADO em produção.');
    process.exit(1);
  }
  const dbUrl = process.env.DATABASE_URL?.trim() || '';
  if (dbUrl && !/localhost|127\.0\.0\.1|_dev|aurix_dev|aurix_staging/i.test(dbUrl)) {
    console.error('Seed auditoria: use apenas banco local ou de desenvolvimento.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(SENHA_AUDIT, 10);

  // ---------- Empresa A ----------
  const userA = await prisma.usuario.upsert({
    where: { email: 'empresa-a@audit.local' },
    update: {},
    create: {
      email: 'empresa-a@audit.local',
      senha: hash,
      nome: 'Empresa A Auditoria'
    }
  });
  await prisma.companySettings.upsert({
    where: { usuario_id: userA.id },
    update: {},
    create: { usuario_id: userA.id, dias_atencao: 30, dias_inativo: 45 }
  });

  const areaA1 = await prisma.businessArea.upsert({
    where: { id: 'area-a-mecanica' },
    update: {},
    create: {
      id: 'area-a-mecanica',
      usuario_id: userA.id,
      name: 'Mecânica',
      color: '#2563eb',
      is_active: true
    }
  });
  const areaA2 = await prisma.businessArea.upsert({
    where: { id: 'area-a-funilaria' },
    update: {},
    create: {
      id: 'area-a-funilaria',
      usuario_id: userA.id,
      name: 'Funilaria',
      color: '#dc2626',
      is_active: true
    }
  });

  const catAProd = await prisma.categoria.upsert({
    where: { usuario_id_nome_tipo: { usuario_id: userA.id, nome: 'Peças A', tipo: 'produto' } },
    update: {},
    create: { usuario_id: userA.id, nome: 'Peças A', tipo: 'produto' }
  });
  const catAServ = await prisma.categoria.upsert({
    where: { usuario_id_nome_tipo: { usuario_id: userA.id, nome: 'Serviços A', tipo: 'servico' } },
    update: {},
    create: { usuario_id: userA.id, nome: 'Serviços A', tipo: 'servico' }
  });

  const clienteA = await prisma.cliente.upsert({
    where: { id: 'cliente-audit-a1' },
    update: {},
    create: {
      id: 'cliente-audit-a1',
      usuario_id: userA.id,
      nome: 'Cliente A1',
      telefone: '11999990001',
      observacoes: 'Cliente Empresa A'
    }
  });

  const produtoA = await prisma.produto.upsert({
    where: { id: 'produto-audit-a1' },
    update: {},
    create: {
      id: 'produto-audit-a1',
      usuario_id: userA.id,
      nome: 'Filtro de óleo A',
      item_type: 'product',
      preco: 45,
      custo: 25,
      estoque_atual: 30,
      estoque_minimo: 5,
      categoria_id: catAProd.id
    }
  });
  const servicoA = await prisma.produto.upsert({
    where: { id: 'servico-audit-a1' },
    update: {},
    create: {
      id: 'servico-audit-a1',
      usuario_id: userA.id,
      nome: 'Troca de óleo A',
      item_type: 'service',
      preco: 80,
      custo: 0,
      estoque_atual: 0,
      estoque_minimo: 0,
      categoria_id: catAServ.id
    }
  });

  const supCatA = await prisma.supplierCategory.upsert({
    where: { usuario_id_name: { usuario_id: userA.id, name: 'Peças A' } },
    update: {},
    create: { usuario_id: userA.id, name: 'Peças A' }
  });
  const fornecedorA = await prisma.supplier.upsert({
    where: { id: 'fornecedor-audit-a1' },
    update: {},
    create: {
      id: 'fornecedor-audit-a1',
      usuario_id: userA.id,
      name: 'Fornecedor A1',
      category_id: supCatA.id,
      is_active: true
    }
  });

  const finCatEntradaA = await prisma.financialCategory.upsert({
    where: { usuario_id_type_name: { usuario_id: userA.id, type: 'income', name: 'Vendas' } },
    update: {},
    create: { usuario_id: userA.id, name: 'Vendas', type: 'income' }
  });
  const finCatSaidaA = await prisma.financialCategory.upsert({
    where: { usuario_id_type_name: { usuario_id: userA.id, type: 'expense', name: 'Compras A' } },
    update: {},
    create: { usuario_id: userA.id, name: 'Compras A', type: 'expense' }
  });

  await prisma.financialTransaction.upsert({
    where: { id: 'ft-audit-a1' },
    update: {},
    create: {
      id: 'ft-audit-a1',
      usuario_id: userA.id,
      type: 'income',
      category_id: finCatEntradaA.id,
      description: 'Entrada teste Empresa A',
      value: 500,
      status: 'confirmed',
      date: new Date()
    }
  });

  const vendaA = await prisma.venda.upsert({
    where: { id: 'venda-audit-a1' },
    update: {},
    create: {
      id: 'venda-audit-a1',
      usuario_id: userA.id,
      cliente_id: clienteA.id,
      tipo: 'sale',
      total: 125,
      desconto: 0,
      status: 'PAGO',
      forma_pagamento: 'dinheiro'
    }
  });
  await prisma.itemVenda.upsert({
    where: { id: 'item-venda-audit-a1' },
    update: {},
    create: {
      id: 'item-venda-audit-a1',
      venda_id: vendaA.id,
      produto_id: produtoA.id,
      quantidade: 1,
      preco_unitario: 45
    }
  });

  // ---------- Empresa B ----------
  const userB = await prisma.usuario.upsert({
    where: { email: 'empresa-b@audit.local' },
    update: {},
    create: {
      email: 'empresa-b@audit.local',
      senha: hash,
      nome: 'Empresa B Auditoria'
    }
  });
  await prisma.companySettings.upsert({
    where: { usuario_id: userB.id },
    update: {},
    create: { usuario_id: userB.id, dias_atencao: 30, dias_inativo: 45 }
  });

  const areaB1 = await prisma.businessArea.upsert({
    where: { id: 'area-b-mecanica' },
    update: {},
    create: {
      id: 'area-b-mecanica',
      usuario_id: userB.id,
      name: 'Mecânica',
      color: '#059669',
      is_active: true
    }
  });

  const catBProd = await prisma.categoria.upsert({
    where: { usuario_id_nome_tipo: { usuario_id: userB.id, nome: 'Peças B', tipo: 'produto' } },
    update: {},
    create: { usuario_id: userB.id, nome: 'Peças B', tipo: 'produto' }
  });

  const clienteB = await prisma.cliente.upsert({
    where: { id: 'cliente-audit-b1' },
    update: {},
    create: {
      id: 'cliente-audit-b1',
      usuario_id: userB.id,
      nome: 'Cliente B1',
      telefone: '11999990002',
      observacoes: 'Cliente Empresa B'
    }
  });

  const produtoB = await prisma.produto.upsert({
    where: { id: 'produto-audit-b1' },
    update: {},
    create: {
      id: 'produto-audit-b1',
      usuario_id: userB.id,
      nome: 'Pastilha de freio B',
      item_type: 'product',
      preco: 120,
      custo: 70,
      estoque_atual: 15,
      estoque_minimo: 5,
      categoria_id: catBProd.id
    }
  });

  const supCatB = await prisma.supplierCategory.upsert({
    where: { usuario_id_name: { usuario_id: userB.id, name: 'Peças B' } },
    update: {},
    create: { usuario_id: userB.id, name: 'Peças B' }
  });
  const fornecedorB = await prisma.supplier.upsert({
    where: { id: 'fornecedor-audit-b1' },
    update: {},
    create: {
      id: 'fornecedor-audit-b1',
      usuario_id: userB.id,
      name: 'Fornecedor B1',
      category_id: supCatB.id,
      is_active: true
    }
  });

  const finCatEntradaB = await prisma.financialCategory.upsert({
    where: { usuario_id_type_name: { usuario_id: userB.id, type: 'income', name: 'Vendas' } },
    update: {},
    create: { usuario_id: userB.id, name: 'Vendas', type: 'income' }
  });
  await prisma.financialTransaction.upsert({
    where: { id: 'ft-audit-b1' },
    update: {},
    create: {
      id: 'ft-audit-b1',
      usuario_id: userB.id,
      type: 'income',
      category_id: finCatEntradaB.id,
      description: 'Entrada teste Empresa B',
      value: 300,
      status: 'confirmed',
      date: new Date()
    }
  });

  console.log('Seed auditoria (duas empresas) concluído.');
  console.log('Empresa A:', userA.email, '| Cliente A1, Filtro óleo A, Venda A, Fornecedor A1');
  console.log('Empresa B:', userB.email, '| Cliente B1, Pastilha B, Fornecedor B1');
  console.log('Senha para ambos:', SENHA_AUDIT);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Seed: dados iniciais / exemplo. NUNCA roda em produção.
 * Carrega env primeiro para garantir que estamos no ambiente correto.
 */
import '../config/loadEnv';
import { isProduction } from '../config/env';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // REGRA: Seed NUNCA roda em produção. Dados de exemplo só em development/staging.
  if (isProduction) {
    console.error('Seed: BLOQUEADO em produção. Use apenas em desenvolvimento ou homologação.');
    process.exit(1);
  }
  const dbUrl = process.env.DATABASE_URL?.trim() || '';
  const looksLikeProd =
    dbUrl.length > 0 &&
    !/localhost|127\.0\.0\.1|_dev|aurix_dev|aurix_staging|staging/i.test(dbUrl) &&
    /supabase\.co|render\.com|neon\.tech|amazonaws\.com|fly\.(io|dev)/i.test(dbUrl);
  if (looksLikeProd) {
    console.error('Seed: BLOQUEADO. DATABASE_URL parece ser de produção. Use banco local ou de desenvolvimento.');
    process.exit(1);
  }

  // Criar usuário de exemplo
  const senhaHash = await bcrypt.hash('123456', 10);
  
  const usuario = await prisma.usuario.upsert({
    where: { email: 'admin@aurix.com' },
    update: {},
    create: {
      email: 'admin@aurix.com',
      senha: senhaHash,
      nome: 'Administrador'
    }
  });

  // Garantir categoria padrão (obrigatória para produtos) — por usuário
  const categoria = await prisma.categoria.upsert({
    where: { usuario_id_nome_tipo: { usuario_id: usuario.id, nome: 'Geral', tipo: 'produto' } },
    update: {},
    create: { usuario_id: usuario.id, nome: 'Geral', tipo: 'produto' }
  });

  // Criar produtos de exemplo (vinculados ao usuário)
  const produtos = await Promise.all([
    prisma.produto.upsert({
      where: { id: 'produto-1' },
      update: {},
      create: {
        id: 'produto-1',
        usuario_id: usuario.id,
        nome: 'Produto Exemplo 1',
        preco: 100.00,
        custo: 50.00,
        estoque_atual: 20,
        estoque_minimo: 5,
        categoria_id: categoria.id
      }
    }),
    prisma.produto.upsert({
      where: { id: 'produto-2' },
      update: {},
      create: {
        id: 'produto-2',
        usuario_id: usuario.id,
        nome: 'Produto Exemplo 2',
        preco: 200.00,
        custo: 120.00,
        estoque_atual: 15,
        estoque_minimo: 10,
        categoria_id: categoria.id
      }
    })
  ]);

  // Criar cliente de exemplo (vinculado ao usuário)
  const cliente = await prisma.cliente.upsert({
    where: { id: 'cliente-1' },
    update: {},
    create: {
      id: 'cliente-1',
      usuario_id: usuario.id,
      nome: 'Cliente Exemplo',
      telefone: '(11) 99999-9999',
      observacoes: 'Cliente de exemplo para testes'
    }
  });

  console.log('Seed executado com sucesso!');
  console.log('Usuário criado:', usuario.email);
  console.log('Produtos criados:', produtos.length);
  console.log('Cliente criado:', cliente.nome);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

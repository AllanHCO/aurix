import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
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

  // Criar produtos de exemplo
  const produtos = await Promise.all([
    prisma.produto.upsert({
      where: { id: 'produto-1' },
      update: {},
      create: {
        id: 'produto-1',
        nome: 'Produto Exemplo 1',
        preco: 100.00,
        custo: 50.00,
        estoque_atual: 20,
        estoque_minimo: 5
      }
    }),
    prisma.produto.upsert({
      where: { id: 'produto-2' },
      update: {},
      create: {
        id: 'produto-2',
        nome: 'Produto Exemplo 2',
        preco: 200.00,
        custo: 120.00,
        estoque_atual: 15,
        estoque_minimo: 10
      }
    })
  ]);

  // Criar cliente de exemplo
  const cliente = await prisma.cliente.upsert({
    where: { id: 'cliente-1' },
    update: {},
    create: {
      id: 'cliente-1',
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

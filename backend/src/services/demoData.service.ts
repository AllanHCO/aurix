/**
 * Geração de dados demo (12 meses) para apresentação e testes.
 * Timezone Brasil (America/Sao_Paulo). Dados vinculados ao usuario_id via DemoEntity.
 */
import { prisma } from '../lib/prisma';

const TZ_BR = 'America/Sao_Paulo';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

/** Data no início do dia (hora 12:00 UTC para evitar edge de timezone) em São Paulo. */
function dateBR(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

const NOMES_CLIENTES = [
  'Adriana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fernando', 'Gabriela', 'Henrique', 'Isabela', 'João',
  'Larissa', 'Miguel', 'Natália', 'Otávio', 'Paula', 'Ricardo', 'Sandra', 'Thiago', 'Úrsula', 'Vitor',
  'Wanessa', 'Amanda', 'Bernardo', 'Camila', 'Daniel', 'Edna', 'Fábio', 'Gisele', 'Heitor', 'Ivana',
  'Juliano', 'Kátia', 'Leonardo', 'Mariana', 'Nelson', 'Olívia', 'Pedro', 'Quésia', 'Rafael', 'Simone',
  'Tiago', 'Ubirajara', 'Vanessa', 'Wellington', 'Xavier', 'Yasmin', 'Zélia', 'Alice', 'Bruno', 'Cecília'
];

const SOBRENOMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Ferreira', 'Rodrigues', 'Almeida', 'Nascimento', 'Pereira', 'Alves', 'Martins', 'Rocha', 'Ribeiro', 'Carvalho', 'Gomes', 'Dias', 'Mendes', 'Barbosa'];

const CATEGORIAS_BASE = ['Corte', 'Barba', 'Coloração', 'Manicure', 'Pedicure', 'Massagem', 'Estética', 'Produtos', 'Serviços', 'Tratamentos', 'Cabelo', 'Sobrancelha', 'Depilação', 'Hidratação', 'Maquiagem', 'Unhas', 'Spa', 'Barbearia'];

const LINHAS_POR_CATEGORIA: Record<string, string[]> = {
  Corte: ['Masculino', 'Feminino', 'Infantil', 'Premium', 'Básico'],
  Barba: ['Navalha', 'Máquina', 'Combo', 'Premium'],
  Produtos: ['Shampoo', 'Condicionador', 'Finalizador', 'Linha Profissional', 'Linha Básica'],
  Serviços: ['Avulso', 'Pacote', 'Assinatura'],
  default: ['Premium', 'Básico', 'Standard']
};

const FORMAS_PAGAMENTO = ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Transferência'];

const NOMES_PRODUTOS_SERVICOS = [
  'Corte Masculino', 'Corte Feminino', 'Barba Completa', 'Barba + Corte', 'Coloração', 'Mechas',
  'Manicure', 'Pedicure', 'Alongamento de Unhas', 'Massagem Relaxante', 'Drenagem', 'Limpeza de Pele',
  'Shampoo Anticaspa', 'Condicionador', 'Cera Depilatória', 'Pomada para Barba', 'Gel Fixador',
  'Hidratação Capilar', 'Botox Capilar', 'Progressiva', 'Sobrancelha', 'Design de Sobrancelha',
  'Pacote 5 Cortes', 'Pacote 10 Unhas', 'Combo Barba + Corte', 'Serviço Express', 'Tratamento Completo'
];

export type DemoEntityType = 'cliente' | 'categoria' | 'produto' | 'venda' | 'agendamento' | 'bloqueio';

async function registerDemoEntity(usuarioId: string, entityType: DemoEntityType, entityId: string): Promise<void> {
  await (prisma as any).demoEntity.create({
    data: { usuario_id: usuarioId, entity_type: entityType, entity_id: entityId }
  });
}

/** Remove todos os dados criados pelo demo deste usuário. */
export async function resetarDadosDemo(usuarioId: string): Promise<{ deleted: Record<string, number> }> {
  const deleted: Record<string, number> = { bloqueio: 0, agendamento: 0, venda: 0, cliente: 0, produto: 0, categoria: 0 };

  const demoEntities = await (prisma as any).demoEntity.findMany({
    where: { usuario_id: usuarioId },
    select: { entity_type: true, entity_id: true }
  });

  const byType = { bloqueio: [] as string[], agendamento: [] as string[], venda: [] as string[], cliente: [] as string[], produto: [] as string[], categoria: [] as string[] };
  for (const e of demoEntities) {
    if (byType[e.entity_type as keyof typeof byType]) byType[e.entity_type as keyof typeof byType].push(e.entity_id);
  }

  if (byType.bloqueio.length > 0) {
    await prisma.bloqueio.deleteMany({ where: { id: { in: byType.bloqueio }, usuario_id: usuarioId } });
    deleted.bloqueio = byType.bloqueio.length;
  }
  if (byType.agendamento.length > 0) {
    await prisma.agendamento.deleteMany({ where: { id: { in: byType.agendamento }, usuario_id: usuarioId } });
    deleted.agendamento = byType.agendamento.length;
  }
  if (byType.venda.length > 0) {
    for (const id of byType.venda) {
      await prisma.itemVenda.deleteMany({ where: { venda_id: id } });
      await prisma.venda.delete({ where: { id } });
    }
    deleted.venda = byType.venda.length;
  }
  if (byType.cliente.length > 0) {
    await prisma.cliente.deleteMany({ where: { id: { in: byType.cliente } } });
    deleted.cliente = byType.cliente.length;
  }
  if (byType.produto.length > 0) {
    await prisma.produto.deleteMany({ where: { id: { in: byType.produto } } });
    deleted.produto = byType.produto.length;
  }
  if (byType.categoria.length > 0) {
    await prisma.categoria.deleteMany({ where: { id: { in: byType.categoria } } });
    deleted.categoria = byType.categoria.length;
  }

  await (prisma as any).demoEntity.deleteMany({ where: { usuario_id: usuarioId } });

  await prisma.companySettings.upsert({
    where: { usuario_id: usuarioId },
    create: { usuario_id: usuarioId, is_demo: false },
    update: { is_demo: false }
  });

  return { deleted };
}

/** Gera dados demo realistas somente nos últimos 90 dias (até ontem) e marca is_demo = true. */
export async function gerarDadosDemo(usuarioId: string): Promise<{
  clientes: number;
  categorias: number;
  produtos: number;
  vendas: number;
  agendamentos: number;
  bloqueios: number;
}> {
  // 1) Resetar demo anterior se existir
  const existing = await (prisma as any).demoEntity.findMany({ where: { usuario_id: usuarioId }, select: { id: true } });
  if (existing.length > 0) await resetarDadosDemo(usuarioId);

  // Janela de dados: de 90 dias atrás até ontem (timezone Brasil aproximado)
  const now = new Date();
  const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const fim = addDays(hoje, -1); // ontem, fim da janela
  fim.setHours(23, 59, 59, 999);
  const inicio = addDays(hoje, -90); // 90 dias atrás (início da janela)
  inicio.setHours(0, 0, 0, 0);

  // Quebrar em 3 blocos (~30 dias cada) para simular 3 "meses"
  const bloco1Inicio = new Date(inicio);
  const bloco2Inicio = addDays(inicio, 30);
  const bloco3Inicio = addDays(inicio, 60);
  const bloco1Fim = addDays(bloco2Inicio, -1);
  const bloco2Fim = addDays(bloco3Inicio, -1);
  const bloco3Fim = new Date(fim);

  const numCategorias = randomInt(8, 20);
  const categoriasNomes = pickN(CATEGORIAS_BASE, numCategorias);
  const categorias: { id: string; nome: string }[] = [];
  for (const nome of categoriasNomes) {
    const c = await prisma.categoria.create({ data: { nome: `Demo ${nome} ${usuarioId.slice(0, 6)}` } });
    categorias.push({ id: c.id, nome: c.nome });
    await registerDemoEntity(usuarioId, 'categoria', c.id);
  }

  const produtos: { id: string; preco: number; custo: number; estoque_atual: number; estoque_minimo: number; categoria_id: string; linha: string | null }[] = [];
  const numProdutos = randomInt(80, 250);
  for (let i = 0; i < numProdutos; i++) {
    const cat = pick(categorias);
    const linhas = LINHAS_POR_CATEGORIA[cat.nome.replace(/^Demo | [a-f0-9]{6}$/g, '')] ?? LINHAS_POR_CATEGORIA.default;
    const linha = pick(linhas);
    const nomeBase = pick(NOMES_PRODUTOS_SERVICOS);
    const preco = randomInt(15, 350);
    const custo = Math.round(preco * (0.3 + Math.random() * 0.4));
    const estoqueMin = randomInt(0, 5);
    const isServico = randomInt(0, 100) < 25;
    const estoqueAtual = isServico ? 0 : randomInt(0, 50);
    const p = await prisma.produto.create({
      data: {
        nome: `${nomeBase} - ${linha} ${i}`,
        categoria_id: cat.id,
        linha,
        preco,
        custo,
        estoque_atual: estoqueAtual,
        estoque_minimo: estoqueMin
      }
    });
    produtos.push({
      id: p.id,
      preco: Number(p.preco),
      custo: Number(p.custo),
      estoque_atual: p.estoque_atual,
      estoque_minimo: p.estoque_minimo,
      categoria_id: p.categoria_id,
      linha: p.linha
    });
    await registerDemoEntity(usuarioId, 'produto', p.id);
  }

  // Base de clientes (100–250)
  const numClientes = randomInt(100, 250);
  const clientes: { id: string; nome: string; telefone: string }[] = [];
  for (let i = 0; i < numClientes; i++) {
    const nome = `${pick(NOMES_CLIENTES)} ${pick(SOBRENOMES)} ${i}`;
    const tel = `11${randomInt(9, 9)}${String(100000000 + randomInt(0, 99999999)).slice(-8)}`;
    const obs = randomInt(0, 100) < 30 ? `Preferência: ${pick(['Corte curto', 'Barba aparada', 'Horário manhã', 'Atendimento rápido'])}` : null;
    const c = await prisma.cliente.create({
      data: { nome, telefone: tel, observacoes: obs }
    });
    clientes.push({ id: c.id, nome: c.nome, telefone: c.telefone ?? tel });
    await registerDemoEntity(usuarioId, 'cliente', c.id);
  }

  let totalVendas = 0;
  const produtosComEstoque = produtos.filter((p) => p.estoque_atual > 0);
  const produtosServico = produtos.filter((p) => p.estoque_atual === 0 && p.estoque_minimo === 0);

  // Distribuição de vendas em 3 blocos (mês 1 menor, mês 2 maior, mês 3 médio)
  const blocos = [
    { inicio: bloco1Inicio, fim: bloco1Fim, total: randomInt(120, 220) },
    { inicio: bloco2Inicio, fim: bloco2Fim, total: randomInt(220, 340) },
    { inicio: bloco3Inicio, fim: bloco3Fim, total: randomInt(160, 260) }
  ];
  // Percentuais globais de status
  const pctPagoGlobal = randomInt(70, 85) / 100; // 70–85% PAGO

  for (const bloco of blocos) {
    const numVendas = bloco.total;
    const numPago = Math.round(numVendas * pctPagoGlobal);
    // Em cada bloco, garantimos parte PAGO e parte PENDENTE
    for (let v = 0; v < numVendas; v++) {
      const status = v < numPago ? 'PAGO' : 'PENDENTE';
      const createdAt = randomDate(bloco.inicio, bloco.fim);
      // Garantir horário de funcionamento
      createdAt.setHours(randomInt(8, 19), randomInt(0, 59), 0, 0);
      if (createdAt.getTime() > fim.getTime() || createdAt.getTime() < inicio.getTime()) continue;
      const cliente = pick(clientes);
      const numItens = randomInt(1, 3); // 1–3 itens por venda
      const itens: { produto_id: string; quantidade: number; preco_unitario: number }[] = [];
      const usedProd = new Set<string>();
      let subtotal = 0;
      const pool = produtosComEstoque.length > 0 ? produtosComEstoque : produtosServico.length > 0 ? produtosServico : produtos;
      for (let j = 0; j < numItens; j++) {
        const prod = pick(pool);
        if (usedProd.has(prod.id)) continue;
        usedProd.add(prod.id);
        const qtd = prod.estoque_atual > 0 ? randomInt(1, Math.min(3, prod.estoque_atual)) : 1;
        itens.push({ produto_id: prod.id, quantidade: qtd, preco_unitario: prod.preco });
        subtotal += qtd * prod.preco;
      }
      if (itens.length === 0) continue;
      // Desconto percentual em algumas vendas (5–15%)
      const descontoPct = randomInt(0, 100) < 25 ? randomInt(5, 15) : 0;
      const desconto = Math.round((subtotal * descontoPct) / 100 * 100) / 100;
      const total = Math.round((subtotal - desconto) * 100) / 100;
      const venda = await prisma.venda.create({
        data: {
          usuario_id: usuarioId,
          cliente_id: cliente.id,
          total,
          desconto,
          forma_pagamento: pick(FORMAS_PAGAMENTO),
          status: status as 'PAGO' | 'PENDENTE',
          createdAt
        }
      });
      await registerDemoEntity(usuarioId, 'venda', venda.id);
      for (const item of itens) {
        await prisma.itemVenda.create({
          data: {
            venda_id: venda.id,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario
          }
        });
        const p = produtos.find((x) => x.id === item.produto_id);
        if (p && p.estoque_atual > 0) {
          p.estoque_atual = Math.max(0, p.estoque_atual - item.quantidade);
          await prisma.produto.update({
            where: { id: p.id },
            data: { estoque_atual: p.estoque_atual }
          });
        }
      }
      totalVendas++;
    }
  }

  // Forçar que alguns produtos fiquem com estoque baixo (<= mínimo) para alimentar o card de estoque baixo
  const candidatosBaixoEstoque = produtos.filter((p) => p.estoque_minimo > 0 && p.estoque_atual > p.estoque_minimo);
  const toLower = pickN(candidatosBaixoEstoque, randomInt(5, 12));
  for (const p of toLower) {
    p.estoque_atual = p.estoque_minimo; // exatamente no mínimo
    await prisma.produto.update({
      where: { id: p.id },
      data: { estoque_atual: p.estoque_atual }
    });
  }

  // Agendamentos: últimos 45 dias até ontem (sem futuro)
  let agendamentosCount = 0;
  for (let d = -45; d <= -1; d++) {
    const data = addDays(hoje, d);
    const diaSemana = data.getDay();
    if (diaSemana === 0 || diaSemana === 6) continue;
    const numAg = randomInt(2, 20);
    for (let a = 0; a < numAg; a++) {
      const statusRand = randomInt(0, 100);
      const status = statusRand < 70 ? 'CONFIRMADO' : statusRand < 90 ? 'PENDENTE' : 'CANCELADO';
      const h = randomInt(8, 17);
      const cliente = pick(clientes);
      const ag = await prisma.agendamento.create({
        data: {
          usuario_id: usuarioId,
          nome_cliente: cliente.nome,
          telefone_cliente: cliente.telefone,
          data,
          hora_inicio: `${String(h).padStart(2, '0')}:00`,
          hora_fim: `${String(h + 1).padStart(2, '0')}:00`,
          status: status as 'PENDENTE' | 'CONFIRMADO' | 'CANCELADO'
        }
      });
      await registerDemoEntity(usuarioId, 'agendamento', ag.id);
      agendamentosCount++;
    }
  }

  // Bloqueios: almoço 12-14 seg a sex
  let bloqueiosCount = 0;
  for (let dia = 1; dia <= 5; dia++) {
    const b = await prisma.bloqueio.create({
      data: {
        usuario_id: usuarioId,
        tipo: 'RECORRENTE',
        dia_semana: dia,
        hora_inicio: '12:00',
        hora_fim: '14:00'
      }
    });
    await registerDemoEntity(usuarioId, 'bloqueio', b.id);
    bloqueiosCount++;
  }

  await prisma.companySettings.upsert({
    where: { usuario_id: usuarioId },
    create: { usuario_id: usuarioId, is_demo: true },
    update: { is_demo: true }
  });

  return {
    clientes: clientes.length,
    categorias: categorias.length,
    produtos: produtos.length,
    vendas: totalVendas,
    agendamentos: agendamentosCount,
    bloqueios: bloqueiosCount
  };
}

export async function getDemoStatus(usuarioId: string): Promise<{ is_demo: boolean }> {
  const s = await prisma.companySettings.findUnique({
    where: { usuario_id: usuarioId },
    select: { is_demo: true }
  });
  return { is_demo: s?.is_demo ?? false };
}

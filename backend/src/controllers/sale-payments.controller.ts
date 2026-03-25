import { Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { invalidatePrefix } from '../services/cache.service';

const salePaymentTipoSchema = z.enum(['dinheiro', 'pix', 'debito', 'credito', 'fiado']);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function getComputedVendaStatusFromPaid(paid: number, total: number): 'PAGO' | 'PENDENTE' | 'PARCIAL' {
  const totalR = round2(total);
  const paidR = round2(paid);
  if (paidR <= 0) return 'PENDENTE';
  if (paidR + 0.0001 < totalR) return 'PARCIAL';
  return 'PAGO';
}

function tipoPagamentoToFormaPag(tipo: string): string {
  // Mantém compatibilidade com o campo legado `vendas.forma_pagamento`
  switch (tipo) {
    case 'dinheiro':
      return 'Dinheiro';
    case 'pix':
      return 'Pix';
    case 'debito':
      return 'Cartão de Débito';
    case 'credito':
      return 'Cartão de Crédito';
    case 'fiado':
      return 'Fiado';
    default:
      return 'A definir';
  }
}

function formaPagToTipoPagamento(forma: string | null | undefined): string {
  const v = (forma ?? '').toLowerCase();
  if (v.includes('dinheiro')) return 'dinheiro';
  if (v.includes('pix')) return 'pix';
  if (v.includes('débito') || v.includes('debito')) return 'debito';
  if (v.includes('crédito') || v.includes('credito')) return 'credito';
  if (v.includes('fiado') || v.includes('outro')) return 'fiado';
  return 'dinheiro';
}

async function ensureSalePaymentsTableExists() {
  try {
    // Só pra checar existência.
    await prisma.salePayment.findFirst({
      where: { venda_id: '___probe___' as any, usuario_id: '___probe___' as any }
    });
  } catch (e: any) {
    const msg = String(e?.message ?? e ?? '');
    if (!/sale_payments|does not exist|relation .* does not exist/i.test(msg)) throw e;

    // IMPORTANTE: `vendas.id` está como TEXT no banco legado.
    // Prisma não aceita múltiplos comandos em um único prepared statement,
    // então executamos separadamente.
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS sale_payments (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        venda_id text NOT NULL,
        usuario_id text NOT NULL,
        tipo_pagamento varchar(20) NOT NULL,
        valor numeric(12, 2) NOT NULL,
        parcelas integer,
        data_pagamento timestamptz(6) NOT NULL,
        "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
        "updatedAt" timestamptz(6) NOT NULL DEFAULT now(),
        CONSTRAINT sale_payments_venda_id_fkey
          FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS sale_payments_venda_id_idx ON sale_payments(venda_id)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS sale_payments_usuario_id_idx ON sale_payments(usuario_id)`);
  }
}

const paymentSchema = z.object({
  id: z.string().optional(),
  tipo_pagamento: salePaymentTipoSchema,
  valor: z.union([z.number(), z.string()]).transform((v) => Number(v)).refine((n) => !Number.isNaN(n), 'Valor inválido'),
  parcelas: z.union([z.number(), z.string()]).transform((v) => (v === null ? null : Number(v))).optional().nullable(),
  data_pagamento: z.string().datetime().optional().nullable()
});

const syncPaymentsBodySchema = z.object({
  payments: z.array(paymentSchema).default([])
});

export const listarPagamentosVenda = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;

  await ensureSalePaymentsTableExists();

  const venda = await prisma.venda.findFirst({
    where: { id, usuario_id: userId },
    select: { id: true, tipo: true, status: true, total: true, forma_pagamento: true, createdAt: true }
  });

  if (!venda) throw new AppError('Venda não encontrada', 404);
  if (venda.tipo !== 'sale') return res.json([]);

  const pagos = await prisma.salePayment.findMany({
    where: { venda_id: id, usuario_id: userId },
    orderBy: { data_pagamento: 'desc' }
  });

  if (pagos.length > 0) {
    return res.json(
      pagos.map((p) => ({
        id: p.id,
        venda_id: p.venda_id,
        usuario_id: p.usuario_id,
        tipo_pagamento: p.tipo_pagamento,
        valor: Number(p.valor),
        parcelas: p.parcelas ?? null,
        data_pagamento: p.data_pagamento.toISOString(),
        createdAt: p.createdAt
      }))
    );
  }

  // Legado: sem tabela de pagamentos preenchida, sintetizamos apenas quando a venda está PAGO.
  if (venda.status === 'PAGO') {
    return res.json([
      {
        id: 'legacy',
        venda_id: venda.id,
        usuario_id: userId,
        tipo_pagamento: formaPagToTipoPagamento(venda.forma_pagamento),
        valor: Number(venda.total),
        parcelas: null,
        data_pagamento: venda.createdAt.toISOString(),
        createdAt: venda.createdAt
      }
    ]);
  }

  return res.json([]);
};

export const syncPagamentosVenda = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.userId!;
  const body = syncPaymentsBodySchema.parse(req.body);

  await ensureSalePaymentsTableExists();

  const paymentsIn = body.payments ?? [];
  // normaliza parcelas e data
  const normalized = paymentsIn.map((p) => ({
    id: p.id,
    tipo_pagamento: p.tipo_pagamento,
    valor: round2(Number(p.valor)),
    parcelas: p.tipo_pagamento === 'credito' ? (p.parcelas == null ? null : Math.max(1, Math.floor(Number(p.parcelas)))) : null,
    data_pagamento: p.data_pagamento ? new Date(p.data_pagamento) : new Date()
  }));

  for (const p of normalized) {
    if (p.valor <= 0) throw new AppError('Valor do pagamento deve ser maior que zero', 400);
    if (p.parcelas != null && (!Number.isInteger(p.parcelas) || p.parcelas < 1)) throw new AppError('Parcelas inválidas', 400);
  }

  const sumPayments = round2(normalized.reduce((acc, p) => acc + p.valor, 0));

  const result = await prisma.$transaction(async (tx) => {
    const venda = await tx.venda.findFirst({
      where: { id, usuario_id: userId },
      include: { itens: true }
    });
    if (!venda) throw new AppError('Venda não encontrada', 404);
    if (venda.tipo !== 'sale') throw new AppError('Pagamentos só são suportados para vendas', 400);
    if (venda.status === 'FECHADA') throw new AppError('Venda fechada não pode ter pagamentos alterados', 400);

    const total = Number(venda.total);
    const totalR = round2(total);
    const sumR = sumPayments;

    if (sumR - totalR > 0.0001) {
      throw new AppError('Soma dos pagamentos não pode exceder o total da venda', 400);
    }

    const existingPayments = await tx.salePayment.findMany({
      where: { venda_id: id, usuario_id: userId }
    });

    // Legacy: caso não exista nada na tabela, usamos o status atual para inferir o “paid”.
    const prevPaid =
      existingPayments.length > 0
        ? round2(existingPayments.reduce((acc, p) => acc + Number(p.valor), 0))
        : venda.status === 'PAGO'
          ? totalR
          : 0;

    const prevStatus = getComputedVendaStatusFromPaid(prevPaid, totalR);
    const newStatus = getComputedVendaStatusFromPaid(sumR, totalR);

    // 1) Ajustar estoque apenas quando a venda “entra/sai” de PAGO (regra legado).
    const hasItens = (venda.itens?.length ?? 0) > 0;
    if (venda.tipo === 'sale' && hasItens) {
      if (prevStatus !== 'PAGO' && newStatus === 'PAGO') {
        for (const item of venda.itens) {
          const prod = await tx.produto.findUnique({ where: { id: item.produto_id } });
          if (!prod || prod.estoque_atual < item.quantidade) {
            throw new AppError(`Estoque insuficiente para o produto ${prod?.nome ?? item.produto_id}.`, 400);
          }
          await tx.produto.update({
            where: { id: item.produto_id },
            data: { estoque_atual: { decrement: item.quantidade } }
          });
        }
      }
      if (prevStatus === 'PAGO' && newStatus !== 'PAGO') {
        for (const item of venda.itens) {
          await tx.produto.update({
            where: { id: item.produto_id },
            data: { estoque_atual: { increment: item.quantidade } }
          });
        }
      }
    }

    // 2) Sincroniza financeiro: cancela transações legadas da venda e recria por pagamento.
    await tx.financialTransaction.updateMany({
      where: { usuario_id: userId, source_type: 'sale', source_id: id },
      data: { status: 'cancelled' }
    });

    const categoryId = await getOrCreateVendasCategory(tx, userId);
    const vendaRow = await tx.venda.findUnique({
      where: { id },
      select: { sale_code: true, os_code: true, business_area_id: true, createdAt: true }
    });
    const descCode = vendaRow?.sale_code ?? vendaRow?.os_code ?? id.slice(0, 8);
    const businessAreaId = vendaRow?.business_area_id ?? null;

    // 3) Recria pagamentos e recria lançamentos financeiros por pagamento
    await tx.salePayment.deleteMany({ where: { venda_id: id, usuario_id: userId } });

    if (normalized.length > 0) {
      await tx.salePayment.createMany({
        data: normalized.map((p) => ({
          id: p.id ?? undefined,
          venda_id: id,
          usuario_id: userId,
          tipo_pagamento: p.tipo_pagamento,
          valor: p.valor,
          parcelas: p.parcelas,
          data_pagamento: p.data_pagamento
        }))
      });
    }

    for (const p of normalized) {
      const d = new Date(p.data_pagamento);
      const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      await tx.financialTransaction.create({
        data: {
          usuario_id: userId,
          business_area_id: businessAreaId,
          type: 'income',
          category_id: categoryId,
          source_type: 'sale',
          source_id: id,
          description: `Venda ${descCode} - ${tipoPagamentoToFormaPag(p.tipo_pagamento)}`,
          value: p.valor,
          status: 'confirmed',
          date: dateOnly,
          notes: p.parcelas != null ? `Parcelas: ${p.parcelas}` : undefined
        }
      });
    }

    const formaPagamento =
      normalized.length === 1 ? tipoPagamentoToFormaPag(normalized[0].tipo_pagamento) : 'Múltiplos';

    const updated = await tx.venda.update({
      where: { id },
      data: { status: newStatus, forma_pagamento: normalized.length > 0 ? formaPagamento : 'A definir' }
    });

    return updated;
  });

  invalidatePrefix(`dashboard:summary:${userId}:`);
  res.json(result);
};

async function getOrCreateVendasCategory(
  tx: Prisma.TransactionClient,
  usuarioId: string
): Promise<string> {
  let cat = await tx.financialCategory.findFirst({
    where: { usuario_id: usuarioId, type: 'income', name: 'Vendas' }
  });
  if (!cat) {
    cat = await tx.financialCategory.create({
      data: { usuario_id: usuarioId, name: 'Vendas', type: 'income' }
    });
  }
  return cat.id;
}


import { Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const purchaseItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive('Quantidade deve ser positiva'),
  unit_cost: z.number().nonnegative('Custo unitário não pode ser negativo')
});

const createPurchaseBodySchema = z.object({
  supplier_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid(),
  business_area_id: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(5000).nullable().optional(),
  items: z.array(purchaseItemSchema).min(1, 'Adicione pelo menos um produto')
});

/** POST /financeiro/purchases — registra compra: saída financeira + estoque + histórico */
export const registrarCompra = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const body = createPurchaseBodySchema.parse(req.body);

  const category = await prisma.financialCategory.findFirst({
    where: { id: body.category_id, usuario_id: userId, type: 'expense' }
  });
  if (!category) throw new AppError('Categoria não encontrada ou não é de saída', 404);

  if (body.supplier_id) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: body.supplier_id, usuario_id: userId }
    });
    if (!supplier) throw new AppError('Fornecedor não encontrado', 404);
  }

  const productIds = [...new Set(body.items.map((i) => i.product_id))];
  const products = await prisma.produto.findMany({
    where: { id: { in: productIds } }
  });
  if (products.length !== productIds.length) {
    const found = new Set(products.map((p) => p.id));
    const missing = productIds.filter((id) => !found.has(id));
    throw new AppError(`Produto(s) não encontrado(s): ${missing.join(', ')}`, 404);
  }

  const totalValue = body.items.reduce((acc, i) => acc + i.quantity * i.unit_cost, 0);
  if (totalValue <= 0) throw new AppError('Total da compra deve ser positivo', 400);

  const description = body.items.length === 1
    ? `Compra de produto`
    : `Compra de produtos (${body.items.length} itens)`;

  if (body.business_area_id) {
    const area = await prisma.businessArea.findFirst({
      where: { id: body.business_area_id, usuario_id: userId }
    });
    if (!area) throw new AppError('Área de negócio não encontrada', 404);
  }

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.financialTransaction.create({
      data: {
        usuario_id: userId,
        type: 'expense',
        category_id: body.category_id,
        supplier_id: body.supplier_id ?? null,
        business_area_id: body.business_area_id ?? null,
        source_type: 'manual',
        description,
        value: totalValue,
        status: 'confirmed',
        date: new Date(body.date),
        notes: body.notes ?? null
      }
    });

    for (const item of body.items) {
      const totalCost = item.quantity * item.unit_cost;
      const product = products.find((p) => p.id === item.product_id)!;

      await tx.productPurchaseHistory.create({
        data: {
          usuario_id: userId,
          product_id: item.product_id,
          supplier_id: body.supplier_id ?? null,
          business_area_id: body.business_area_id ?? null,
          financial_transaction_id: transaction.id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          total_cost: totalCost
        }
      });

      await tx.inventoryMovement.create({
        data: {
          usuario_id: userId,
          product_id: item.product_id,
          type: 'purchase',
          quantity: item.quantity,
          supplier_id: body.supplier_id ?? null,
          unit_cost: item.unit_cost
        }
      });

      const newStock = product.estoque_atual + item.quantity;
      await tx.produto.update({
        where: { id: item.product_id },
        data: {
          estoque_atual: newStock,
          custo: item.unit_cost
        }
      });
    }

    return transaction;
  });

  res.status(201).json({
    id: result.id,
    message: 'Compra registrada. Estoque e financeiro atualizados.'
  });
};

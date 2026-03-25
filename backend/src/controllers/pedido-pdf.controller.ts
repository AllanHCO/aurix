import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

function formatMoney(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/** GET /vendas/:id/pedido-pdf — Gera PDF "espelho" do pedido (tipo=sale) */
export async function gerarPedidoPdf(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.userId!;

  const venda = await prisma.venda.findFirst({
    where: { id, usuario_id: userId },
    include: {
      cliente: true,
      client_extra_item: true,
      itens: { include: { produto: true } },
      servicos: true
    }
  });

  if (!venda) throw new AppError('Venda não encontrada', 404);
  if (venda.tipo !== 'sale') throw new AppError('Apenas vendas (pedido) possuem este PDF.', 400);

  const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
  const companyName = usuario?.nome_organizacao || usuario?.nome_unidade || usuario?.nome || 'Empresa';

  const code = venda.sale_code || venda.id.slice(0, 8);
  const cliente = venda.cliente as { nome: string; cpf?: string | null; telefone?: string | null };
  const extraItem = venda.client_extra_item as null | {
    title: string;
    type: string;
    data_json: Record<string, unknown> | null;
  };
  const itens = venda.itens || [];
  const servicos = (venda as any).servicos || [];

  const subtotalItens = itens.reduce((acc: number, i: any) => acc + Number(i.preco_unitario) * Number(i.quantidade), 0);
  const subtotalServicos = servicos.reduce((acc: number, s: any) => acc + Number(s.valor_unitario) * Number(s.quantidade), 0);
  const subtotal = subtotalItens + subtotalServicos;
  const desconto = Number(venda.desconto ?? 0);
  const total = Number(venda.total ?? 0);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Pedido-${code}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  doc.pipe(res);

  const pageW = doc.page.width - 72;
  const x = 36;

  // Header
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#000');
  doc.text('PEDIDO / VENDA', x, doc.y, { width: pageW, align: 'left' });
  doc.font('Helvetica').fontSize(10).fillColor('#333');
  doc.text(companyName, x, doc.y + 2, { width: pageW });
  doc.moveDown(0.6);

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
  doc.text(`Código: ${code}`, { continued: true });
  doc.font('Helvetica').fillColor('#333');
  doc.text(`   Data: ${formatDate(venda.createdAt)}`);

  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fillColor('#000');
  doc.text('Cliente: ', { continued: true });
  doc.font('Helvetica').fillColor('#333');
  doc.text(cliente?.nome || '—');
  if (cliente?.cpf) doc.text(`CPF: ${cliente.cpf}`);
  if (cliente?.telefone) doc.text(`Telefone: ${cliente.telefone}`);

  if (extraItem?.title && extraItem.type && extraItem.data_json) {
    const dj = extraItem.data_json ?? {};
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fillColor('#000').text(`${String(extraItem.type).toLowerCase() === 'veiculo' ? 'Veículo' : 'Equipamento'}: ${extraItem.title}`);
    if (String(extraItem.type).toLowerCase() === 'veiculo') {
      if (dj && (dj as any).placa != null) doc.font('Helvetica').fillColor('#333').text(`Placa: ${(dj as any).placa}`);
      if (dj && (dj as any).km != null) doc.font('Helvetica').fillColor('#333').text(`KM: ${(dj as any).km}`);
      if (dj && (dj as any).ano != null) doc.font('Helvetica').fillColor('#333').text(`Ano: ${(dj as any).ano}`);
    } else {
      if (dj && (dj as any).numero_serie_imei != null) doc.font('Helvetica').fillColor('#333').text(`Série/IMEI: ${(dj as any).numero_serie_imei}`);
      if (dj && (dj as any).marca_modelo != null) doc.font('Helvetica').fillColor('#333').text(`Marca/Modelo: ${(dj as any).marca_modelo}`);
    }
  }

  doc.moveDown(0.8);
  doc.moveTo(x, doc.y).lineTo(x + pageW, doc.y).strokeColor('#000').lineWidth(1).stroke();
  doc.moveDown(0.6);

  // Itens (produtos)
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000');
  doc.text('Itens', x, doc.y);
  doc.moveDown(0.3);

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000');
  doc.text('Produto', x, doc.y, { width: pageW * 0.52 });
  doc.text('Qtd', x + pageW * 0.54, doc.y, { width: pageW * 0.1, align: 'right' });
  doc.text('Unit.', x + pageW * 0.66, doc.y, { width: pageW * 0.16, align: 'right' });
  doc.text('Subtotal', x + pageW * 0.84, doc.y, { width: pageW * 0.16, align: 'right' });
  doc.moveDown(0.4);
  doc.strokeColor('#ddd').lineWidth(1).moveTo(x, doc.y).lineTo(x + pageW, doc.y).stroke();
  doc.moveDown(0.3);

  doc.font('Helvetica').fontSize(9).fillColor('#333');
  if (itens.length === 0) {
    doc.text('—', x, doc.y);
  } else {
    for (const it of itens as any[]) {
      const nome = it?.produto?.nome ?? '—';
      const qtd = Number(it.quantidade ?? 0);
      const unit = Number(it.preco_unitario ?? 0);
      const sub = qtd * unit;
      const y0 = doc.y;
      doc.text(nome, x, y0, { width: pageW * 0.52 });
      doc.text(String(qtd), x + pageW * 0.54, y0, { width: pageW * 0.1, align: 'right' });
      doc.text(formatMoney(unit), x + pageW * 0.66, y0, { width: pageW * 0.16, align: 'right' });
      doc.text(formatMoney(sub), x + pageW * 0.84, y0, { width: pageW * 0.16, align: 'right' });
      doc.moveDown(0.35);
    }
  }

  // Serviços (se existirem)
  if (servicos.length > 0) {
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000');
    doc.text('Serviços', x, doc.y);
    doc.moveDown(0.3);

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000');
    doc.text('Descrição', x, doc.y, { width: pageW * 0.64 });
    doc.text('Qtd', x + pageW * 0.66, doc.y, { width: pageW * 0.1, align: 'right' });
    doc.text('Subtotal', x + pageW * 0.78, doc.y, { width: pageW * 0.22, align: 'right' });
    doc.moveDown(0.4);
    doc.strokeColor('#ddd').lineWidth(1).moveTo(x, doc.y).lineTo(x + pageW, doc.y).stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(9).fillColor('#333');
    for (const s of servicos as any[]) {
      const desc = s?.descricao ?? '—';
      const qtd = Number(s.quantidade ?? 0);
      const unit = Number(s.valor_unitario ?? 0);
      const sub = qtd * unit;
      const y0 = doc.y;
      doc.text(desc, x, y0, { width: pageW * 0.64 });
      doc.text(String(qtd), x + pageW * 0.66, y0, { width: pageW * 0.1, align: 'right' });
      doc.text(formatMoney(sub), x + pageW * 0.78, y0, { width: pageW * 0.22, align: 'right' });
      doc.moveDown(0.35);
    }
  }

  // Totais
  doc.moveDown(0.8);
  doc.strokeColor('#000').lineWidth(1).moveTo(x, doc.y).lineTo(x + pageW, doc.y).stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(10).fillColor('#333');
  doc.text(`Subtotal: ${formatMoney(subtotal)}`, { align: 'right' });
  doc.text(`Desconto: ${formatMoney(desconto)}`, { align: 'right' });
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#000');
  doc.text(`Total: ${formatMoney(total)}`, { align: 'right' });

  doc.moveDown(0.6);
  doc.font('Helvetica').fontSize(10).fillColor('#333');
  doc.text(`Forma de pagamento: ${venda.forma_pagamento ?? '—'}`);
  doc.text(`Status: ${String(venda.status ?? '—')}`);

  doc.end();
}


import fs from 'fs';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import {
  mergeDocumentBranding,
  absolutePathFromRelative,
  getLogoBandContentMaxHeight,
  type DocumentBranding
} from '../services/document-branding.service';

const TEXTO_GARANTIA_PADRAO =
  'Os serviços realizados possuem garantia de 3 (três) meses, contados a partir da data da conclusão conforme consta na ordem de serviço. ' +
  'A garantia cobre somente o serviço executado, conforme descrito nesta Ordem de Serviço, e não se estende a peças fornecidas pelo cliente. ' +
  'A garantia perde a validade em casos de mau uso, acidentes, intervenções de terceiros, falta de manutenção preventiva ou alteração das condições originais do reparo.';

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

function formatDateShort(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Quebra texto longo em múltiplas linhas dentro da largura; altura da linha é dinâmica. */
function textWrap(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, opts?: { align?: 'left' | 'justify' }): number {
  const startY = y;
  doc.text(text || '—', x, y, { width, align: opts?.align || 'left' });
  return doc.y - startY;
}

/** Garante espaço vertical; se não couber na página, adiciona nova página e retorna o y inicial. */
function ensureSpace(doc: PDFKit.PDFDocument, marginBottom: number, pageBottom: number, marginTop: number): void {
  if (doc.y > pageBottom - marginBottom) {
    doc.addPage({ size: 'A4', margin: 50 });
    doc.y = marginTop;
  }
}

/** Logo centralizada na faixa, contain em largura × altura máxima, sem deformar */
async function drawOsLogoInBand(
  doc: PDFKit.PDFDocument,
  fullPath: string,
  bandX: number,
  bandY: number,
  bandW: number,
  maxH: number,
  branding: DocumentBranding
): Promise<void> {
  let meta: { width?: number; height?: number };
  try {
    meta = await sharp(fullPath).metadata();
  } catch {
    return;
  }
  const iw = meta.width || 1;
  const ih = meta.height || 1;
  const scale = Math.min(bandW / iw, maxH / ih, 1);
  const dw = iw * scale;
  const dh = ih * scale;
  let imgX = bandX + (bandW - dw) / 2 + branding.logo_offset_x;
  let imgY = bandY + (maxH - dh) / 2 + branding.logo_offset_y;
  imgX = Math.max(bandX, Math.min(imgX, bandX + bandW - dw));
  imgY = Math.max(bandY, Math.min(imgY, bandY + maxH - dh));
  try {
    doc.image(fullPath, imgX, imgY, { width: dw, height: dh });
  } catch {
    /* fallback: cabeçalho segue sem imagem */
  }
}

/** GET /vendas/:id/os-pdf — Gera PDF da Ordem de Serviço (layout para impressão A4) */
export async function gerarOsPdf(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.userId!;

  let venda: Awaited<ReturnType<typeof prisma.venda.findFirst>> & {
    cliente?: { nome: string };
    itens?: Array<{ quantidade: number; preco_unitario: unknown; produto: { nome: string } }>;
    servicos?: Array<{ descricao: string; quantidade: number; valor_unitario: unknown }>;
  };
  try {
    venda = await prisma.venda.findFirst({
      where: { id, usuario_id: userId },
      include: {
        cliente: true,
        client_extra_item: true,
        itens: { include: { produto: true } },
        servicos: true
      }
    }) as typeof venda;
  } catch {
    venda = await prisma.venda.findFirst({
      where: { id, usuario_id: userId },
      include: {
        cliente: true,
        client_extra_item: true,
        itens: { include: { produto: true } }
      }
    }) as typeof venda;
    if (venda) venda.servicos = [];
  }

  if (!venda) throw new AppError('Ordem de serviço não encontrada', 404);
  if (venda.tipo !== 'service_order') throw new AppError('Apenas ordens de serviço possuem PDF.', 400);

  const settings = await prisma.companySettings.findUnique({
    where: { usuario_id: userId }
  });
  const personalizacao = settings?.personalizacao_json as { modulos?: { vendas?: { mostrar_dados_adicionais_pdf_os?: boolean } } } | null | undefined;
  const mostrarDadosAdicionaisOs = personalizacao?.modulos?.vendas?.mostrar_dados_adicionais_pdf_os ?? true;
  const documentBranding = mergeDocumentBranding(
    (settings?.personalizacao_json as { document_branding?: unknown } | null | undefined)?.document_branding
  );
  let logoFullPath: string | null = null;
  if (documentBranding.logo_path) {
    const abs = absolutePathFromRelative(documentBranding.logo_path);
    if (fs.existsSync(abs)) logoFullPath = abs;
  }

  let clientExtraItems: Array<{ title: string; type: string; data_json: Record<string, unknown> | null }> = [];
  if (mostrarDadosAdicionaisOs && venda.cliente_id) {
    const items = await prisma.clientExtraItem.findMany({
      where: { client_id: venda.cliente_id },
      orderBy: { createdAt: 'asc' }
    });
    clientExtraItems = items.map((it) => ({
      title: it.title,
      type: it.type,
      data_json: it.data_json as Record<string, unknown> | null
    }));
  }

  const osCode = (venda as { os_code?: string | null }).os_code || venda.id.slice(0, 8);
  const dataAbertura = formatDate(venda.createdAt);
  const dataAberturaShort = formatDateShort(venda.createdAt);
  const total = Number(venda.total);
  const desconto = Number(venda.desconto);
  const cliente = venda.cliente as { nome: string; cpf?: string | null; telefone?: string | null };

  const subtotalItens = (venda.itens || []).reduce(
    (acc: number, i: { quantidade: number; preco_unitario: unknown }) =>
      acc + i.quantidade * Number(i.preco_unitario),
    0
  );
  const servicosList = venda.servicos || [];
  const subtotalServicos = servicosList.reduce(
    (acc: number, s: { quantidade: number; valor_unitario: unknown }) =>
      acc + s.quantidade * Number(s.valor_unitario),
    0
  );

  const problema = (venda as { problema_relatado?: string | null }).problema_relatado;
  const observacoes = (venda as { observacoes_tecnicas?: string | null }).observacoes_tecnicas;
  const textoGarantia = (venda as { texto_garantia?: string | null }).texto_garantia;
  const osAgradecimento = (venda as { os_agradecimento?: string | null }).os_agradecimento;
  const formaPagamento = (venda as { forma_pagamento?: string | null }).forma_pagamento;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="OS-${osCode}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  doc.pipe(res);

  const marginLeft = 36;
  const marginTop = 36;
  const pageWidth = doc.page.width - 72;
  const pageHeight = doc.page.height;
  const pageBottom = pageHeight - 36;
  const LINHA_ALTURA = 12;
  const BORDA_LEVE = 0.5;
  const BORDA_GROSSA = 1.5;

  const metadeLargura = pageWidth / 2;

  doc.strokeColor('#000000');

  // ---------- 1) Cabeçalho: linha 1 (título + Nº OS) | linha 2 opcional (faixa full-width da logo) ----------
  const row1H = 24;
  const hasLogo = !!logoFullPath;
  const bandPadX = 8;
  const bandPadY = hasLogo ? (documentBranding.logo_band_style === 'compact' ? 5 : 7) : 0;
  const contentMaxH = hasLogo ? getLogoBandContentMaxHeight(documentBranding.logo_band_style) : 0;
  const bandH = hasLogo ? bandPadY + contentMaxH + bandPadY : 0;
  const dividerAfterH = hasLogo ? 1 : 0;
  const headerBottomPad = 6;
  const headerTotalH = row1H + (hasLogo ? dividerAfterH + bandH : 4) + headerBottomPad;

  const headerY0 = marginTop;
  doc.lineWidth(BORDA_GROSSA);
  doc.rect(marginLeft, headerY0, pageWidth, headerTotalH).stroke();

  const row1TextY = headerY0 + 6;
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000');
  doc.text('ORDEM DE SERVIÇO', marginLeft + 6, row1TextY, { width: pageWidth * 0.58, align: 'left' });
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
  doc.text(`Nº OS: ${osCode}`, marginLeft, row1TextY, { width: pageWidth - 10, align: 'right' });

  if (hasLogo && logoFullPath) {
    const bandY = headerY0 + row1H + 1;
    doc.lineWidth(BORDA_LEVE);
    doc.strokeColor('#cccccc');
    doc.moveTo(marginLeft, bandY).lineTo(marginLeft + pageWidth, bandY).stroke();
    doc.strokeColor('#000000');

    const bandBoxY = bandY + 1;
    doc.save();
    doc.fillColor('#f4f4f4').rect(marginLeft, bandBoxY, pageWidth, bandH).fill();
    doc.restore();

    const innerX = marginLeft + bandPadX;
    const innerW = pageWidth - bandPadX * 2;
    const innerY = bandBoxY + bandPadY;
    await drawOsLogoInBand(doc, logoFullPath, innerX, innerY, innerW, contentMaxH, documentBranding);
    doc.lineWidth(BORDA_GROSSA);
    doc.strokeColor('#000000');
  }

  // ---------- 2) Bloco cliente/veículo: bordas leves nos campos, borda grossa fechando ----------
  let y = marginTop + headerTotalH + 6;
  const blocoClienteY0 = y;
  doc.lineWidth(BORDA_LEVE);
  const campoH = 14;

  function campoLinha(label: string, valor: string, largura: number) {
    doc.rect(marginLeft, y, largura, campoH).stroke();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#000');
    doc.text(label, marginLeft + 3, y + 3);
    doc.font('Helvetica').fillColor('#333');
    const labelW = 58;
    doc.text(valor || '—', marginLeft + labelW, y + 3, { width: largura - labelW - 4 });
    y += campoH;
  }

  campoLinha('Nome:', cliente.nome, pageWidth);
  campoLinha('CPF:', cliente.cpf ?? '', pageWidth);
  campoLinha('Telefone:', cliente.telefone ?? '', pageWidth);
  y += 4;
  if (mostrarDadosAdicionaisOs && clientExtraItems.length > 0) {
    for (const it of clientExtraItems) {
      const isVeiculo = it.type.toLowerCase() === 'veiculo';
      const dj = it.data_json || {};
      campoLinha(isVeiculo ? 'Veículo:' : 'Equipamento:', it.title, pageWidth);
      if (isVeiculo) {
        if (dj.km != null) campoLinha('KM:', String(dj.km), metadeLargura);
        if (dj.ano != null) campoLinha('Ano:', String(dj.ano), metadeLargura);
      } else {
        if (dj.numero_serie_imei) campoLinha('Série/IMEI:', String(dj.numero_serie_imei), metadeLargura);
        if (dj.marca_modelo) campoLinha('Marca/Modelo:', String(dj.marca_modelo), metadeLargura);
      }
      y += 2;
    }
    y += 4;
  }
  const blocoClienteY1 = y;
  doc.lineWidth(BORDA_GROSSA);
  doc.rect(marginLeft, blocoClienteY0, pageWidth, blocoClienteY1 - blocoClienteY0).stroke();
  doc.lineWidth(BORDA_LEVE);
  y += 6;

  // ---------- 3) Quadrado de peças: borda grossa no quadrado todo; Valor = retângulo vertical borda grossa (só 1ª e última linha); mínimo 14 linhas; total dentro do quadrado ----------
  ensureSpace(doc, 400, pageBottom, marginTop);
  const colPeca = [pageWidth * 0.42, pageWidth * 0.12, pageWidth * 0.18, pageWidth * 0.28];
  const pecasY0 = y;
  doc.rect(marginLeft, y, colPeca[0] + colPeca[1] + colPeca[2], LINHA_ALTURA).stroke();
  doc.rect(marginLeft + colPeca[0] + colPeca[1] + colPeca[2], y, colPeca[3], LINHA_ALTURA).stroke();
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
  doc.text('Peças', marginLeft + 3, y + 2);
  doc.text('QTD', marginLeft + colPeca[0] + 3, y + 2);
  doc.text('UN', marginLeft + colPeca[0] + colPeca[1] + 3, y + 2);
  doc.text('Valor', marginLeft + colPeca[0] + colPeca[1] + colPeca[2] + 3, y + 2);
  y += LINHA_ALTURA;

  const itens = venda.itens || [];
  const minLinhasPeças = 10;
  const totalLinhasPeças = Math.max(minLinhasPeças, itens.length);
  const valorColX = marginLeft + colPeca[0] + colPeca[1] + colPeca[2];
  for (let i = 0; i < totalLinhasPeças; i++) {
    const item = itens[i];
    const rowY = y;
    doc.rect(marginLeft, rowY, colPeca[0], LINHA_ALTURA).stroke();
    doc.rect(marginLeft + colPeca[0], rowY, colPeca[1], LINHA_ALTURA).stroke();
    doc.rect(marginLeft + colPeca[0] + colPeca[1], rowY, colPeca[2], LINHA_ALTURA).stroke();
    doc.rect(valorColX, rowY, colPeca[3], LINHA_ALTURA).stroke();
    doc.fontSize(7).font('Helvetica').fillColor('#333');
    if (item) {
      const prod = item.produto as { nome: string };
      const nome = (prod?.nome || '—').slice(0, 45);
      doc.text(nome, marginLeft + 2, rowY + 3, { width: colPeca[0] - 4 });
      doc.text(String(item.quantidade), marginLeft + colPeca[0] + 2, rowY + 3);
      doc.text(formatMoney(Number(item.preco_unitario)), marginLeft + colPeca[0] + colPeca[1] + 2, rowY + 3);
      doc.text(formatMoney(Number(item.quantidade) * Number(item.preco_unitario)), valorColX + 2, rowY + 3);
    }
    y = rowY + LINHA_ALTURA;
  }
  const totalPeçasY = y;
  const totalPeçasH = 14;
  doc.rect(marginLeft, y, colPeca[0] + colPeca[1], totalPeçasH).stroke();
  doc.rect(marginLeft + colPeca[0] + colPeca[1], y, colPeca[2], totalPeçasH).stroke();
  doc.rect(valorColX, y, colPeca[3], totalPeçasH).stroke();
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
  doc.text('Total peças', marginLeft + 3, y + 4);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
  doc.text(formatMoney(subtotalItens), valorColX + 3, y + 3);
  y += totalPeçasH;
  doc.lineWidth(BORDA_GROSSA);
  doc.rect(marginLeft, pecasY0, pageWidth, y - pecasY0).stroke();
  doc.rect(valorColX, pecasY0, colPeca[3], totalPeçasY - pecasY0).stroke();
  doc.lineWidth(BORDA_LEVE);
  y += 8;

  // ---------- 4) Serviço: mesmo comportamento das peças — borda grossa no quadrado; Valor = retângulo vertical borda grossa; total dentro ----------
  const servW = pageWidth * 0.7;
  const servValorW = pageWidth - servW;
  const servY0 = y;
  doc.rect(marginLeft, y, servW, LINHA_ALTURA).stroke();
  doc.rect(marginLeft + servW, y, servValorW, LINHA_ALTURA).stroke();
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
  doc.text('Serviço', marginLeft + 3, y + 2);
  doc.text('Valor', marginLeft + servW + 3, y + 2);
  y += LINHA_ALTURA;
  const servValorX = marginLeft + servW;
  const minLinhasServ = Math.max(1, servicosList.length);
  for (let i = 0; i < minLinhasServ; i++) {
    const s = servicosList[i];
    const rowY = y;
    doc.rect(marginLeft, rowY, servW, LINHA_ALTURA).stroke();
    doc.rect(servValorX, rowY, servValorW, LINHA_ALTURA).stroke();
    doc.fontSize(7).font('Helvetica').fillColor('#333');
    doc.text((s?.descricao || '—').slice(0, 60), marginLeft + 2, rowY + 3, { width: servW - 4 });
    doc.text(s ? formatMoney(s.quantidade * Number(s.valor_unitario)) : '—', servValorX + 2, rowY + 3);
    y = rowY + LINHA_ALTURA;
  }
  const totalServY = y;
  const totalServH = 14;
  doc.rect(marginLeft, y, servW, totalServH).stroke();
  doc.rect(servValorX, y, servValorW, totalServH).stroke();
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
  doc.text('Total serviço', marginLeft + 3, y + 4);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
  doc.text(formatMoney(subtotalServicos), servValorX + 3, y + 3);
  y += totalServH;
  doc.lineWidth(BORDA_GROSSA);
  doc.rect(marginLeft, servY0, pageWidth, y - servY0).stroke();
  doc.rect(servValorX, servY0, servValorW, totalServY - servY0).stroke();
  doc.lineWidth(BORDA_LEVE);
  y += 6;

  // ---------- 5) Valor total: escrito à esquerda, valor à direita, borda grossa, espaço embaixo ----------
  const valorTotalH = 18;
  doc.lineWidth(BORDA_GROSSA);
  doc.rect(marginLeft, y, pageWidth, valorTotalH).stroke();
  doc.lineWidth(BORDA_LEVE);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000');
  doc.text('VALOR TOTAL', marginLeft + 5, y + 5);
  doc.text(formatMoney(total), marginLeft, y + 5, { width: pageWidth - 10, align: 'right' });
  y += valorTotalH + 6;

  // ---------- 6) Mensagem de agradecimento — borda grossa em volta ----------
  const agradecY0 = y;
  const agradecPadding = 6;
  y += agradecPadding;
  const agradecTexto = osAgradecimento?.trim() || 'Agradecemos a confiança em nosso trabalho.';
  doc.fontSize(9).font('Helvetica').fillColor('#333');
  doc.text(agradecTexto, marginLeft + agradecPadding, y, { width: pageWidth - agradecPadding * 2, align: 'center' });
  y = doc.y + agradecPadding;
  doc.lineWidth(BORDA_GROSSA);
  doc.rect(marginLeft, agradecY0, pageWidth, y - agradecY0).stroke();
  doc.lineWidth(BORDA_LEVE);
  y += 6;

  // ---------- Bloco único: Forma de pagamento + Assinatura + Garantia (uma caixa com borda grossa) ----------
  const blocoFinalY0 = y;
  const blocoPad = 8;

  // 7) Forma de pagamento — bordas em volta (dentro do bloco) ----------
  doc.rect(marginLeft + blocoPad, y, pageWidth - blocoPad * 2, 16).stroke();
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#000');
  doc.text('Forma de pagamento:', marginLeft + blocoPad + 4, y + 4);
  doc.font('Helvetica').fillColor('#333');
  doc.text(formaPagamento?.trim() || '—', marginLeft + blocoPad + 100, y + 4);
  y += 16 + 4;

  // 8) Assinatura: esquerda = "Assinatura do cliente" e abaixo "Data" + valor; direita = caixa vazia para assinar ----------
  const assinaturaH = 26;
  const assinaturaW = (pageWidth - blocoPad * 2) / 2;
  const assinaturaX = marginLeft + blocoPad;
  doc.rect(assinaturaX, y, assinaturaW, assinaturaH).stroke();
  doc.rect(assinaturaX + assinaturaW, y, assinaturaW, assinaturaH).stroke();
  doc.fontSize(8).font('Helvetica').fillColor('#333');
  doc.text('Assinatura do cliente', assinaturaX + 3, y + 5);
  doc.text(`Data: ${dataAberturaShort}`, assinaturaX + 3, y + 15);
  y += assinaturaH + 4;

  // 9) Garantia — letras pequenas, sem negrito ----------
  const garantiaY0 = y;
  y += 6;
  doc.fontSize(8).font('Helvetica').fillColor('#333');
  doc.text('Garantia', marginLeft + blocoPad, y);
  y += 6;
  const garantiaTexto = textoGarantia?.trim() || TEXTO_GARANTIA_PADRAO;
  doc.fontSize(7).font('Helvetica').fillColor('#333');
  doc.text(garantiaTexto, marginLeft + blocoPad, y, { width: pageWidth - blocoPad * 2, align: 'justify' });
  y = doc.y + 8;

  doc.lineWidth(BORDA_GROSSA);
  doc.rect(marginLeft, blocoFinalY0, pageWidth, y - blocoFinalY0).stroke();
  doc.lineWidth(BORDA_LEVE);

  doc.end();
}

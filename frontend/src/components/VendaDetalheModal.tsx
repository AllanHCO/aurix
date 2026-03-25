import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatDateTime } from '../utils/format';
import ModalPortal from './ModalPortal';

export interface VendaDetalhe {
  id: string;
  tipo?: 'sale' | 'quote' | 'service_order';
  sale_code?: string | null;
  os_code?: string | null;
  os_status?: string | null;
  cliente_id?: string;
  client_extra_item_id?: string | null;
  client_extra_item?: { id: string; title: string; type: string; data_json?: Record<string, unknown> | null } | null;
  total: number;
  desconto: number;
  forma_pagamento: string | null;
  status: 'PAGO' | 'PENDENTE' | 'PARCIAL' | 'FECHADA' | 'ORCAMENTO' | 'CANCELADO';
  problema_relatado?: string | null;
  observacoes_tecnicas?: string | null;
  texto_garantia?: string | null;
  createdAt: string;
  cliente: { nome: string };
  itens: Array<{
    id: string;
    quantidade: number;
    preco_unitario: number;
    produto: { nome: string; preco?: number };
  }>;
  servicos?: Array<{ id?: string; descricao: string; quantidade: number; valor_unitario: number }>;
  anexos?: Array<{ id: string; nome_original: string; mime_type?: string | null }>;
}

type SalePaymentTipo = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'fiado';
export interface SalePayment {
  id: string;
  venda_id: string;
  usuario_id: string;
  tipo_pagamento: SalePaymentTipo;
  valor: number;
  parcelas: number | null;
  data_pagamento: string;
}

interface VendaDetalheModalProps {
  venda: VendaDetalhe;
  onClose: () => void;
  onEdit: (venda: VendaDetalhe) => void;
  onFechada?: () => void;
}

function statusLabel(s: string): string {
  switch (s) {
    case 'PAGO': return 'Pago';
    case 'PENDENTE': return 'Pendente';
    case 'PARCIAL': return 'Parcial';
    case 'FECHADA': return 'Fechada';
    case 'ORCAMENTO': return 'Orçamento';
    case 'CANCELADO': return 'Cancelado';
    default: return s;
  }
}

function statusClass(s: string): string {
  switch (s) {
    case 'PAGO': return 'bg-badge-pago text-badge-pago-text';
    case 'PENDENTE': return 'bg-badge-pendente text-badge-pendente-text';
    case 'PARCIAL': return 'bg-badge-pendente text-badge-pendente-text';
    case 'FECHADA': return 'bg-text-muted/20 text-text-muted';
    case 'ORCAMENTO': return 'bg-amber-500/20 text-amber-700 dark:text-amber-300';
    case 'CANCELADO': return 'bg-text-muted/20 text-text-muted';
    default: return 'bg-bg-elevated text-text-main';
  }
}

function tipoPagamentoLabel(t: SalePaymentTipo): string {
  switch (t) {
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
      return t;
  }
}

export default function VendaDetalheModal({ venda, onClose, onEdit, onFechada }: VendaDetalheModalProps) {
  const [confirmFechar, setConfirmFechar] = useState(false);
  const [loadingFechar, setLoadingFechar] = useState(false);
  const [loadingConverter, setLoadingConverter] = useState(false);
  const [loadingCancelar, setLoadingCancelar] = useState(false);
  const [loadingConverterOs, setLoadingConverterOs] = useState(false);
  const [loadingCancelarOs, setLoadingCancelarOs] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [anexos, setAnexos] = useState<Array<{ id: string; nome_original: string; mime_type?: string | null }>>([]);
  const [loadingAnexos, setLoadingAnexos] = useState(false);
  const anexosRef = useRef<HTMLDivElement | null>(null);
  const [pagamentos, setPagamentos] = useState<SalePayment[]>([]);
  const [loadingPagamentos, setLoadingPagamentos] = useState(false);

  const subtotalItens = venda.itens.reduce(
    (acc, item) => acc + Number(item.preco_unitario) * item.quantidade,
    0
  );
  const subtotalServicos = (venda.servicos ?? []).reduce(
    (acc, s) => acc + Number(s.valor_unitario) * s.quantidade,
    0
  );
  const subtotal = subtotalItens + subtotalServicos;
  const descontoPct = subtotal > 0 ? Math.round((Number(venda.desconto) / subtotal) * 100 * 100) / 100 : 0;
  const isQuote = venda.tipo === 'quote';
  const isOs = venda.tipo === 'service_order';
  const isQuoteOrcamento = isQuote && venda.status === 'ORCAMENTO';
  const isOsAtiva = isOs && venda.os_status !== 'CANCELADA' && venda.os_status !== 'CONVERTIDA_EM_VENDA';
  const isFechada = venda.status === 'FECHADA';

  const extraDj = venda.client_extra_item?.data_json ?? null;
  const extraType = String(venda.client_extra_item?.type ?? '').toLowerCase();

  useEffect(() => {
    let cancelled = false;
    setLoadingAnexos(true);
    api.get<Array<{ id: string; nome_original: string; mime_type?: string | null }>>(`/vendas/${venda.id}/anexos`)
      .then((res) => { if (!cancelled) setAnexos(Array.isArray(res.data) ? res.data : []); })
      .catch(() => { if (!cancelled) setAnexos([]); })
      .finally(() => { if (!cancelled) setLoadingAnexos(false); });
    return () => { cancelled = true; };
  }, [venda.id]);

  useEffect(() => {
    let cancelled = false;
    setLoadingPagamentos(true);
    api
      .get<SalePayment[]>(`/vendas/${venda.id}/pagamentos`)
      .then((res) => {
        if (!cancelled) setPagamentos(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setPagamentos([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPagamentos(false);
      });
    return () => {
      cancelled = true;
    };
  }, [venda.id]);

  const handleConverterEmVenda = async () => {
    setLoadingConverter(true);
    try {
      await api.patch(`/vendas/${venda.id}/converter-em-venda`);
      toast.success('Orçamento convertido em venda. Agora você pode definir forma de pagamento e marcar como pago.');
      onFechada?.();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao converter orçamento');
    } finally {
      setLoadingConverter(false);
    }
  };

  const handleCancelarOrcamento = async () => {
    if (!window.confirm('Tem certeza que deseja cancelar este orçamento?')) return;
    setLoadingCancelar(true);
    try {
      await api.patch(`/vendas/${venda.id}/cancelar-orcamento`);
      toast.success('Orçamento cancelado.');
      onFechada?.();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao cancelar orçamento');
    } finally {
      setLoadingCancelar(false);
    }
  };

  const handleConverterOsEmVenda = async () => {
    setLoadingConverterOs(true);
    try {
      await api.patch(`/vendas/${venda.id}/converter-os-em-venda`);
      toast.success('Ordem de serviço convertida em venda. Defina a forma de pagamento e marque como pago.');
      onFechada?.();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao converter OS');
    } finally {
      setLoadingConverterOs(false);
    }
  };

  const handleCancelarOs = async () => {
    if (!window.confirm('Tem certeza que deseja cancelar esta ordem de serviço?')) return;
    setLoadingCancelarOs(true);
    try {
      await api.patch(`/vendas/${venda.id}/cancelar-os`);
      toast.success('Ordem de serviço cancelada.');
      onFechada?.();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao cancelar OS');
    } finally {
      setLoadingCancelarOs(false);
    }
  };

  const handleGerarPdfOs = async () => {
    setLoadingPdf(true);
    try {
      const { data } = await api.get<Blob>(`/vendas/${venda.id}/os-pdf`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(data);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success('PDF aberto em nova aba.');
    } catch (err: any) {
      let msg = 'Erro ao gerar PDF';
      const data = err.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const parsed = JSON.parse(text);
          msg = parsed?.error || parsed?.message || msg;
        } catch {
          msg = 'Erro ao gerar PDF';
        }
      } else if (data?.error || data?.message) {
        msg = data.error || data.message;
      } else if (err.message) msg = err.message;
      toast.error(typeof msg === 'string' ? msg : 'Erro ao gerar PDF');
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleGerarPdfPedido = async () => {
    setLoadingPdf(true);
    try {
      const { data } = await api.get<Blob>(`/vendas/${venda.id}/pedido-pdf`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(data);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success('PDF aberto em nova aba.');
    } catch (err: any) {
      let msg = 'Erro ao gerar PDF';
      const data = err.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const parsed = JSON.parse(text);
          msg = parsed?.error || parsed?.message || msg;
        } catch {
          msg = 'Erro ao gerar PDF';
        }
      } else if (data?.error || data?.message) {
        msg = data.error || data.message;
      } else if (err.message) msg = err.message;
      toast.error(typeof msg === 'string' ? msg : 'Erro ao gerar PDF');
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleMarcarFechada = async () => {
    if (!confirmFechar) {
      setConfirmFechar(true);
      return;
    }
    setLoadingFechar(true);
    try {
      await api.patch(`/vendas/${venda.id}/fechar`);
      toast.success('Venda marcada como fechada. Não poderá mais ser editada.');
      setConfirmFechar(false);
      onFechada?.();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao marcar como fechada');
    } finally {
      setLoadingFechar(false);
    }
  };

  return (
    <ModalPortal>
      <div className="aurix-modal-overlay fixed inset-0 flex items-stretch md:items-center justify-center p-0 md:p-4 overflow-y-auto overscroll-contain touch-manipulation" style={{ backgroundColor: 'var(--color-overlay)' }}>
        <div className="bg-bg-elevated border-0 md:border border-border-soft md:rounded-2xl rounded-none shadow-xl max-w-2xl w-full min-h-[100dvh] md:min-h-0 md:max-h-[90vh] overflow-y-auto my-0 md:my-4 safe-area-pad flex flex-col">
        <div className="sticky top-0 z-20 p-4 sm:p-6 border-b border-border flex items-center justify-between shrink-0 bg-bg-elevated">
          <h2 className="text-lg sm:text-xl font-bold text-text-main">{isOs ? 'Detalhes da Ordem de Serviço' : isQuote ? 'Detalhes do Orçamento' : 'Detalhes da Venda'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-elevated min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 flex-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {(venda.sale_code || venda.os_code) && (
              <div className="col-span-2">
                <span className="text-text-muted block">{isOs ? 'Número da OS' : 'Código'}</span>
                <span className="font-mono font-semibold text-text-main tabular-nums">{isOs ? venda.os_code : venda.sale_code}</span>
              </div>
            )}
            <div>
              <span className="text-text-muted block">Data e hora</span>
              <span className="font-semibold text-text-main">{formatDateTime(venda.createdAt)}</span>
            </div>
            <div className="col-span-2">
              <span className="text-text-muted block">Cliente</span>
              <span className="font-semibold text-text-main">{venda.cliente.nome}</span>
              {(venda.cliente as unknown as { cpf?: string | null }).cpf && (
                <span className="text-text-muted text-xs block mt-0.5">CPF: {(venda.cliente as unknown as { cpf: string }).cpf}</span>
              )}
              {(venda.cliente as unknown as { telefone?: string | null }).telefone && (
                <span className="text-text-muted text-xs block">Tel.: {(venda.cliente as unknown as { telefone: string }).telefone}</span>
              )}
            </div>
            {venda.client_extra_item && (
              <div className="col-span-2">
                <span className="text-text-muted block">Item do cliente</span>
                <span className="font-semibold text-text-main">{venda.client_extra_item.title}</span>
                <span className="text-text-muted text-xs ml-1">({venda.client_extra_item.type})</span>
                {extraDj && extraType === 'veiculo' && (
                  <div className="mt-2 space-y-0.5">
                    {(extraDj as any).placa != null && (
                      <p className="text-xs text-text-muted">Placa: {String((extraDj as any).placa)}</p>
                    )}
                    {(extraDj as any).km != null && (
                      <p className="text-xs text-text-muted">KM: {String((extraDj as any).km)}</p>
                    )}
                    {(extraDj as any).ano != null && (
                      <p className="text-xs text-text-muted">Ano: {String((extraDj as any).ano)}</p>
                    )}
                  </div>
                )}
                {extraDj && extraType === 'equipamento' && (
                  <div className="mt-2 space-y-0.5">
                    {(extraDj as any).numero_serie_imei != null && (
                      <p className="text-xs text-text-muted">Série/IMEI: {String((extraDj as any).numero_serie_imei)}</p>
                    )}
                    {(extraDj as any).marca_modelo != null && (
                      <p className="text-xs text-text-muted">Marca/Modelo: {String((extraDj as any).marca_modelo)}</p>
                    )}
                  </div>
                )}
              </div>
            )}
            {!isQuote && (
              <div>
                <span className="text-text-muted block">Forma de pagamento</span>
                <span className="font-semibold text-text-main">{venda.forma_pagamento ?? '—'}</span>
              </div>
            )}
            <div>
              <span className="text-text-muted block">Status</span>
              <span className={`text-xs px-2 py-1 rounded font-medium ${isOs && venda.os_status ? (venda.os_status === 'CANCELADA' || venda.os_status === 'CONVERTIDA_EM_VENDA' ? 'bg-text-muted/20 text-text-muted' : 'bg-blue-500/20 text-blue-700 dark:text-blue-300') : statusClass(venda.status)}`}>
                {isOs && venda.os_status ? (venda.os_status === 'ABERTA' ? 'Aberta' : venda.os_status === 'EM_EXECUCAO' ? 'Em execução' : venda.os_status === 'CONCLUIDA' ? 'Concluída' : venda.os_status === 'CANCELADA' ? 'Cancelada' : venda.os_status === 'CONVERTIDA_EM_VENDA' ? 'Convertida em venda' : venda.os_status) : statusLabel(venda.status)}
              </span>
            </div>
          </div>

          {!isQuote && !isOs && (
            <div>
              <h3 className="text-sm font-medium text-text-muted mb-2">Pagamentos</h3>
              {loadingPagamentos ? (
                <div className="text-sm text-text-muted px-3 py-3 border border-border rounded-lg bg-bg-elevated">
                  Carregando pagamentos…
                </div>
              ) : pagamentos.length === 0 ? (
                <div className="text-sm text-text-muted px-3 py-3 border border-border rounded-lg bg-bg-elevated">
                  Nenhum pagamento registrado.
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-bg-elevated">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-text-muted">Tipo</th>
                        <th className="px-3 py-2 text-right font-semibold text-text-muted">Valor</th>
                        <th className="px-3 py-2 text-right font-semibold text-text-muted">Parcelas</th>
                        <th className="px-3 py-2 text-right font-semibold text-text-muted">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pagamentos.map((p) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2 font-medium text-text-main">{tipoPagamentoLabel(p.tipo_pagamento)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-text-main">{formatCurrency(Number(p.valor))}</td>
                          <td className="px-3 py-2 text-right text-text-muted text-sm">
                            {p.tipo_pagamento === 'credito' ? (p.parcelas ?? '—') : '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-text-muted text-sm">
                            {p.data_pagamento ? formatDateTime(p.data_pagamento) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {isOs && venda.problema_relatado && (
            <div>
              <h3 className="text-sm font-medium text-text-muted mb-1">Problema relatado</h3>
              <p className="text-text-main whitespace-pre-wrap bg-bg-elevated p-3 rounded-lg border border-border">{venda.problema_relatado}</p>
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-text-muted mb-2">{isOs ? 'Peças' : 'Itens'}</h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-bg-elevated">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Produto</th>
                    <th className="px-3 py-2 text-right font-semibold text-text-muted">Qtd</th>
                    <th className="px-3 py-2 text-right font-semibold text-text-muted">Preço</th>
                    <th className="px-3 py-2 text-right font-semibold text-text-muted">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {venda.itens.map((item) => {
                    const precoCadastrado = item.produto?.preco != null ? Number(item.produto.preco) : null;
                    const precoAlterado = precoCadastrado != null && Number(item.preco_unitario) !== precoCadastrado;
                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <span className="font-medium text-text-main">{item.produto.nome}</span>
                          {precoAlterado && (
                            <span className="ml-2 text-xs text-primary font-medium" title="Valor alterado em relação ao cadastro">Preço alterado manualmente</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-text-main">{item.quantidade}</td>
                        <td className="px-3 py-2 text-right text-text-main">
                          {formatCurrency(Number(item.preco_unitario))}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-text-main">
                          {formatCurrency(Number(item.preco_unitario) * item.quantidade)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {(venda.servicos?.length ?? 0) > 0 && (
            <div>
              <h3 className="text-sm font-medium text-text-muted mb-2">
                {isOs ? 'Serviços executados' : 'Serviços'}
              </h3>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-bg-elevated">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-text-muted">Descrição</th>
                      <th className="px-3 py-2 text-right font-semibold text-text-muted">Qtd</th>
                      <th className="px-3 py-2 text-right font-semibold text-text-muted">Valor</th>
                      <th className="px-3 py-2 text-right font-semibold text-text-muted">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {venda.servicos!.map((s, idx) => (
                      <tr key={s.id ?? idx}>
                        <td className="px-3 py-2 font-medium text-text-main">{s.descricao}</td>
                        <td className="px-3 py-2 text-right text-text-main">{s.quantidade}</td>
                        <td className="px-3 py-2 text-right text-text-main">{formatCurrency(Number(s.valor_unitario))}</td>
                        <td className="px-3 py-2 text-right font-semibold text-text-main">{formatCurrency(Number(s.valor_unitario) * s.quantidade)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {isOs && (venda.observacoes_tecnicas || venda.texto_garantia) && (
            <div className="space-y-2">
              {venda.observacoes_tecnicas && (
                <div>
                  <h3 className="text-sm font-medium text-text-muted mb-1">Observações técnicas</h3>
                  <p className="text-text-main whitespace-pre-wrap text-sm bg-bg-elevated p-3 rounded-lg border border-border">{venda.observacoes_tecnicas}</p>
                </div>
              )}
              {venda.texto_garantia && (
                <div>
                  <h3 className="text-sm font-medium text-text-muted mb-1">Garantia</h3>
                  <p className="text-text-main whitespace-pre-wrap text-sm bg-bg-elevated p-3 rounded-lg border border-border">{venda.texto_garantia}</p>
                </div>
              )}
            </div>
          )}

          <div className="bg-bg-elevated p-4 rounded-lg border border-border space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Subtotal</span>
              <span className="font-semibold text-text-main">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">{descontoPct >= 0 ? 'Desconto' : 'Acréscimo'} ({descontoPct >= 0 ? descontoPct : Math.abs(descontoPct)}%)</span>
              <span className="font-semibold text-text-main">
                {descontoPct >= 0 ? `- ${formatCurrency(Number(venda.desconto))}` : `+ ${formatCurrency(-Number(venda.desconto))}`}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="font-bold text-text-main">Total</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(Number(venda.total))}</span>
            </div>
          </div>

          <div ref={anexosRef} />
          {(loadingAnexos || anexos.length > 0) && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="text-sm font-medium text-text-muted">Anexos do pedido</h3>
                {anexos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => anexosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="px-3 py-1.5 border border-border rounded-lg text-text-main hover:bg-bg-elevated text-sm flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">attach_file</span>
                    Ver anexos
                  </button>
                )}
              </div>
              {loadingAnexos ? (
                <div className="text-sm text-text-muted px-3 py-3 border border-border rounded-lg bg-bg-elevated">Carregando anexos…</div>
              ) : anexos.length === 0 ? null : (
                <ul className="border border-border rounded-lg divide-y divide-border">
                  {anexos.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-sm text-text-main truncate" title={a.nome_original}>{a.nome_original}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await api.get(`/vendas/${venda.id}/anexos/${a.id}/download`, { responseType: 'blob' });
                            const url = URL.createObjectURL(res.data as Blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = a.nome_original;
                            link.click();
                            URL.revokeObjectURL(url);
                          } catch {
                            toast.error('Erro ao baixar anexo');
                          }
                        }}
                        className="p-1.5 rounded text-text-muted hover:bg-bg-elevated flex items-center gap-1 text-sm"
                        title="Baixar anexo"
                      >
                        <span className="material-symbols-outlined text-lg">download</span>
                        Baixar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!confirmFechar ? (
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-w-[100px] px-3 py-1.5 border border-border rounded-lg text-text-main hover:bg-bg-elevated text-sm"
              >
                Fechar
              </button>
              {isQuoteOrcamento && (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(venda)}
                    className="flex-1 min-w-[100px] px-3 py-1.5 border border-border rounded-lg text-text-main hover:bg-bg-elevated flex items-center justify-center gap-1.5 text-sm"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={handleConverterEmVenda}
                    disabled={loadingConverter}
                    className="flex-1 min-w-[140px] bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 text-sm"
                  >
                    {loadingConverter ? 'Convertendo…' : 'Converter em venda'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelarOrcamento}
                    disabled={loadingCancelar}
                    className="flex-1 min-w-[100px] px-3 py-1.5 border border-red-500/50 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-500/10 disabled:opacity-50 text-sm"
                  >
                    {loadingCancelar ? 'Cancelando…' : 'Cancelar'}
                  </button>
                </>
              )}
              {isOsAtiva && (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(venda)}
                    className="flex-1 min-w-[100px] px-3 py-1.5 border border-border rounded-lg text-text-main hover:bg-bg-elevated flex items-center justify-center gap-1.5 text-sm"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={handleConverterOsEmVenda}
                    disabled={loadingConverterOs}
                    className="flex-1 min-w-[140px] bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 text-sm"
                  >
                    {loadingConverterOs ? 'Convertendo…' : 'Converter em venda'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelarOs}
                    disabled={loadingCancelarOs}
                    className="flex-1 min-w-[100px] px-3 py-1.5 border border-red-500/50 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-500/10 disabled:opacity-50 text-sm"
                  >
                    {loadingCancelarOs ? 'Cancelando…' : 'Cancelar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleGerarPdfOs}
                    disabled={loadingPdf}
                    className="flex-1 min-w-[140px] px-3 py-1.5 border border-border rounded-lg text-text-muted hover:bg-bg-elevated flex items-center justify-center gap-1 disabled:opacity-50 text-sm"
                  >
                    {loadingPdf ? (
                      <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                    )}
                    {loadingPdf ? 'Gerando…' : 'Gerar PDF da OS'}
                  </button>
                </>
              )}
              {!isQuote && !isOs && !isFechada && (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(venda)}
                    className="flex-1 min-w-[100px] bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-sm"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={handleGerarPdfPedido}
                    disabled={loadingPdf}
                    className="flex-1 min-w-[140px] px-3 py-1.5 border border-border rounded-lg text-text-muted hover:bg-bg-elevated flex items-center justify-center gap-1 disabled:opacity-50 text-sm"
                  >
                    {loadingPdf ? (
                      <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                    )}
                    {loadingPdf ? 'Gerando…' : 'Gerar PDF do pedido'}
                  </button>
                  <button
                    type="button"
                    onClick={handleMarcarFechada}
                    className="flex-1 min-w-[120px] px-3 py-1.5 border border-border rounded-lg text-text-muted hover:bg-bg-elevated text-sm"
                  >
                    Marcar como Fechada
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4 space-y-3">
              <p className="text-sm text-text-main">
                Após faturar/fechar, esta venda não poderá mais ser editada. Deseja continuar?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmFechar(false)}
                  className="flex-1 px-3 py-1.5 border border-border rounded-lg text-text-main hover:bg-bg-elevated text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleMarcarFechada}
                  disabled={loadingFechar}
                  className="flex-1 bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 text-sm"
                >
                  {loadingFechar ? 'Salvando…' : 'Sim, marcar como Fechada'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

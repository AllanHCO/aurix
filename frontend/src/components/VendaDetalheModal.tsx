import { useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatDateTime } from '../utils/format';

export interface VendaDetalhe {
  id: string;
  cliente_id?: string;
  total: number;
  desconto: number;
  forma_pagamento: string;
  status: 'PAGO' | 'PENDENTE' | 'FECHADA';
  createdAt: string;
  cliente: { nome: string };
  itens: Array<{
    id: string;
    quantidade: number;
    preco_unitario: number;
    produto: { nome: string };
  }>;
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
    case 'FECHADA': return 'Fechada';
    default: return s;
  }
}

function statusClass(s: string): string {
  switch (s) {
    case 'PAGO': return 'bg-badge-pago text-badge-pago-text';
    case 'PENDENTE': return 'bg-badge-pendente text-badge-pendente-text';
    case 'FECHADA': return 'bg-text-muted/20 text-text-muted';
    default: return 'bg-bg-elevated text-text-main';
  }
}

export default function VendaDetalheModal({ venda, onClose, onEdit, onFechada }: VendaDetalheModalProps) {
  const [confirmFechar, setConfirmFechar] = useState(false);
  const [loadingFechar, setLoadingFechar] = useState(false);

  const subtotal = venda.itens.reduce(
    (acc, item) => acc + Number(item.preco_unitario) * item.quantidade,
    0
  );
  const descontoPct = subtotal > 0 ? Math.round((Number(venda.desconto) / subtotal) * 100 * 100) / 100 : 0;
  const isFechada = venda.status === 'FECHADA';

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
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto" style={{ backgroundColor: 'var(--color-overlay)' }}>
      <div className="bg-bg-elevated border border-border-soft rounded-2xl shadow-xl max-w-2xl w-full my-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-text-main">Detalhes da Venda</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-elevated min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-muted block">Data e hora</span>
              <span className="font-semibold text-text-main">{formatDateTime(venda.createdAt)}</span>
            </div>
            <div>
              <span className="text-text-muted block">Cliente</span>
              <span className="font-semibold text-text-main">{venda.cliente.nome}</span>
            </div>
            <div>
              <span className="text-text-muted block">Forma de pagamento</span>
              <span className="font-semibold text-text-main">{venda.forma_pagamento}</span>
            </div>
            <div>
              <span className="text-text-muted block">Status</span>
              <span className={`text-xs px-2 py-1 rounded font-medium ${statusClass(venda.status)}`}>
                {statusLabel(venda.status)}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-text-muted mb-2">Itens</h3>
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
                  {venda.itens.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-text-main">{item.produto.nome}</td>
                      <td className="px-3 py-2 text-right text-text-main">{item.quantidade}</td>
                      <td className="px-3 py-2 text-right text-text-main">
                        {formatCurrency(Number(item.preco_unitario))}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-text-main">
                        {formatCurrency(Number(item.preco_unitario) * item.quantidade)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-bg-elevated p-4 rounded-lg border border-border space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Subtotal</span>
              <span className="font-semibold text-text-main">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Desconto ({descontoPct}%)</span>
              <span className="font-semibold text-text-main">{formatCurrency(Number(venda.desconto))}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="font-bold text-text-main">Total</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(Number(venda.total))}</span>
            </div>
          </div>

          {!confirmFechar ? (
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-text-main hover:bg-bg-elevated"
              >
                Fechar
              </button>
              {!isFechada && (
                <button
                  type="button"
                  onClick={() => onEdit(venda)}
                  className="flex-1 bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                  Editar venda
                </button>
              )}
              {!isFechada && (
                <button
                  type="button"
                  onClick={handleMarcarFechada}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-text-muted hover:bg-bg-elevated"
                >
                  Marcar como Fechada
                </button>
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
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-text-main hover:bg-bg-elevated"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleMarcarFechada}
                  disabled={loadingFechar}
                  className="flex-1 bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {loadingFechar ? 'Salvando…' : 'Sim, marcar como Fechada'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

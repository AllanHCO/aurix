import { formatCurrency, formatDate } from '../utils/format';

export interface VendaDetalhe {
  id: string;
  cliente_id?: string;
  total: number;
  desconto: number;
  forma_pagamento: string;
  status: 'PAGO' | 'PENDENTE';
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
}

export default function VendaDetalheModal({ venda, onClose, onEdit }: VendaDetalheModalProps) {
  const subtotal = venda.itens.reduce(
    (acc, item) => acc + Number(item.preco_unitario) * item.quantidade,
    0
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-surface-light rounded-xl shadow-lg max-w-2xl w-full my-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-border-light flex items-center justify-between shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-text-main">Detalhes da Venda</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-elevated min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-muted block">Data</span>
              <span className="font-semibold text-text-main">{formatDate(venda.createdAt)}</span>
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
              <span
                className={`text-xs px-2 py-1 rounded ${
                  venda.status === 'PAGO' ? 'bg-badge-pago text-badge-pago-text' : 'bg-badge-pendente text-badge-pendente-text'
                }`}
              >
                {venda.status}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-text-muted mb-2">Itens</h3>
            <div className="border border-border-light rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-background-light">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Produto</th>
                    <th className="px-3 py-2 text-right font-semibold text-text-muted">Qtd</th>
                    <th className="px-3 py-2 text-right font-semibold text-text-muted">Valor unit.</th>
                    <th className="px-3 py-2 text-right font-semibold text-text-muted">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
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

          <div className="bg-background-light p-4 rounded-lg border border-border-light space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Subtotal</span>
              <span className="font-semibold text-text-main">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Desconto</span>
              <span className="font-semibold text-text-main">{formatCurrency(Number(venda.desconto))}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border-light">
              <span className="font-bold text-text-main">Total</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(Number(venda.total))}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border-light rounded-lg text-text-main hover:bg-background-light"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => onEdit(venda)}
              className="flex-1 bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
              Editar venda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

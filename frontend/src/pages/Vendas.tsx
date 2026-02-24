import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatDateTime } from '../utils/format';
import VendaModal from '../components/VendaModal';
import VendaDetalheModal, { type VendaDetalhe } from '../components/VendaDetalheModal';

interface Venda extends VendaDetalhe {
  itens: Array<{
    id: string;
    produto_id: string;
    quantidade: number;
    preco_unitario: number;
    produto: { nome: string };
  }>;
}

export default function Vendas() {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') === 'PENDENTE' ? 'PENDENTE' : undefined;

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detalheVenda, setDetalheVenda] = useState<VendaDetalhe | null>(null);
  const [vendaEditando, setVendaEditando] = useState<Venda | null>(null);

  useEffect(() => {
    loadVendas();
  }, [statusFilter]);

  const loadVendas = async () => {
    try {
      const response = await api.get('/vendas', { params: statusFilter ? { status: statusFilter } : {} });
      setVendas(response.data);
    } catch (error: any) {
      toast.error('Erro ao carregar vendas');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setVendaEditando(null);
    loadVendas();
  };

  const handleVerDetalhe = (venda: Venda) => {
    setDetalheVenda(venda);
  };

  const handleEditarVenda = (venda: VendaDetalhe) => {
    setDetalheVenda(null);
    const full = vendas.find((v) => v.id === venda.id);
    if (full) {
      setVendaEditando(full);
      setModalOpen(true);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-main mb-1 sm:mb-2">Vendas</h1>
          <p className="text-sm sm:text-base text-text-muted">Registre e acompanhe suas vendas</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-3 sm:px-5 sm:py-2.5 rounded-lg flex items-center justify-center gap-2 min-h-[44px] touch-manipulation shrink-0"
        >
          <span className="material-symbols-outlined">add</span>
          Nova Venda
        </button>
      </div>

      {vendas.length === 0 ? (
        <div className="bg-bg-card rounded-xl border border-border p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-text-muted mb-4 block">
            payments
          </span>
          <h3 className="text-xl font-bold text-text-main mb-2">Nenhuma venda registrada</h3>
          <p className="text-text-muted mb-6">
            Comece registrando sua primeira venda
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-6 py-3 rounded-lg"
          >
            Registrar Venda
          </button>
        </div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
          <table className="w-full min-w-[480px]">
            <thead className="bg-bg-elevated border-b border-border">
              <tr>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                  Data / Hora
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                  Cliente
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-text-muted">
                  Total
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                  Pagamento
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-text-muted">
                  Status
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-text-muted">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendas.map((venda) => {
                const status = venda.status || 'PENDENTE';
                const statusLabel = status === 'PAGO' ? 'Pago' : status === 'FECHADA' ? 'Fechada' : 'Pendente';
                const statusClass = status === 'PAGO' ? 'bg-badge-pago text-badge-pago-text' : status === 'FECHADA' ? 'bg-text-muted/20 text-text-muted' : 'bg-badge-pendente text-badge-pendente-text';
                return (
                  <tr key={venda.id} className="hover:bg-bg-elevated">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-sm">{formatDateTime(venda.createdAt)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 font-semibold text-text-main truncate max-w-[120px] sm:max-w-none">{venda.cliente.nome}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-bold text-text-main">
                      {formatCurrency(Number(venda.total))}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-sm">{venda.forma_pagamento}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className={`text-xs px-2 py-1 rounded shrink-0 ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleVerDetalhe(venda)}
                          className="p-2 text-primary hover:bg-primary/10 rounded touch-manipulation"
                          title="Ver detalhes"
                        >
                          <span className="material-symbols-outlined">visibility</span>
                        </button>
                        {status !== 'FECHADA' && (
                          <button
                            type="button"
                            onClick={() => handleEditarVenda(venda)}
                            className="p-2 text-text-muted hover:bg-surface-elevated rounded touch-manipulation"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <VendaModal
          onClose={handleCloseModal}
          vendaId={vendaEditando?.id}
          venda={vendaEditando ?? undefined}
        />
      )}
      {detalheVenda && (
        <VendaDetalheModal
          venda={detalheVenda}
          onClose={() => setDetalheVenda(null)}
          onEdit={handleEditarVenda}
          onFechada={loadVendas}
        />
      )}
    </div>
  );
}

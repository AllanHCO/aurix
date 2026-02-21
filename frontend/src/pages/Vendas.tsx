import { useEffect, useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../utils/format';
import VendaModal from '../components/VendaModal';

interface Venda {
  id: string;
  total: number;
  desconto: number;
  forma_pagamento: string;
  status: 'PAGO' | 'PENDENTE';
  createdAt: string;
  cliente: { nome: string };
  itens: Array<{
    quantidade: number;
    preco_unitario: number;
    produto: { nome: string };
  }>;
}

export default function Vendas() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    loadVendas();
  }, []);

  const loadVendas = async () => {
    try {
      const response = await api.get('/vendas');
      setVendas(response.data);
    } catch (error: any) {
      toast.error('Erro ao carregar vendas');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    loadVendas();
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
          className="bg-primary hover:bg-primary-dark text-white font-bold px-4 py-3 sm:px-5 sm:py-2.5 rounded-lg flex items-center justify-center gap-2 min-h-[44px] touch-manipulation shrink-0"
        >
          <span className="material-symbols-outlined">add</span>
          Nova Venda
        </button>
      </div>

      {vendas.length === 0 ? (
        <div className="bg-surface-light rounded-xl border border-border-light p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-text-muted mb-4 block">
            payments
          </span>
          <h3 className="text-xl font-bold text-text-main mb-2">Nenhuma venda registrada</h3>
          <p className="text-text-muted mb-6">
            Comece registrando sua primeira venda
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-primary hover:bg-primary-dark text-white font-bold px-6 py-3 rounded-lg"
          >
            Registrar Venda
          </button>
        </div>
      ) : (
        <div className="bg-surface-light rounded-xl border border-border-light shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
          <table className="w-full min-w-[480px]">
            <thead className="bg-background-light border-b border-border-light">
              <tr>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                  Data
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
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {vendas.map((venda) => (
                <tr key={venda.id} className="hover:bg-background-light">
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-sm">{formatDate(venda.createdAt)}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 font-semibold text-text-main truncate max-w-[120px] sm:max-w-none">{venda.cliente.nome}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-bold text-text-main">
                    {formatCurrency(Number(venda.total))}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-sm">{venda.forma_pagamento}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded shrink-0 ${
                        venda.status === 'PAGO'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {venda.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
            </div>
          </div>
        </div>
      )}

      {modalOpen && <VendaModal onClose={handleCloseModal} />}
    </div>
  );
}

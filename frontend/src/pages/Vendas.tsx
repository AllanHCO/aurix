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
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-main mb-2">Vendas</h1>
          <p className="text-text-muted">Registre e acompanhe suas vendas</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-primary hover:bg-primary-dark text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-2"
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
          <table className="w-full">
            <thead className="bg-background-light border-b border-border-light">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-muted">
                  Data
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-muted">
                  Cliente
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-text-muted">
                  Total
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-muted">
                  Pagamento
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-text-muted">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {vendas.map((venda) => (
                <tr key={venda.id} className="hover:bg-background-light">
                  <td className="px-6 py-4 text-text-muted">{formatDate(venda.createdAt)}</td>
                  <td className="px-6 py-4 font-semibold text-text-main">{venda.cliente.nome}</td>
                  <td className="px-6 py-4 text-right font-bold text-text-main">
                    {formatCurrency(Number(venda.total))}
                  </td>
                  <td className="px-6 py-4 text-text-muted">{venda.forma_pagamento}</td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
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
      )}

      {modalOpen && <VendaModal onClose={handleCloseModal} />}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/format';

interface DashboardData {
  faturamento: number;
  totalVendas: number;
  produtosEstoqueBaixo: Array<{
    id: string;
    nome: string;
    estoque_atual: number;
    estoque_minimo: number;
  }>;
  ultimasVendas: Array<{
    id: string;
    total: number;
    status: string;
    createdAt: string;
    cliente: { nome: string };
  }>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await api.get('/dashboard');
      setData(response.data);
    } catch (error: any) {
      toast.error('Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  if (!data) {
    return <div className="text-center py-12">Erro ao carregar dados</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-main mb-1 sm:mb-2">Dashboard</h1>
        <p className="text-sm sm:text-base text-text-muted">Visão geral do seu negócio</p>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-surface-light p-4 sm:p-6 rounded-xl border border-border-light shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">attach_money</span>
            </div>
          </div>
          <h3 className="text-text-muted text-sm font-medium mb-1">Faturamento do Mês</h3>
          <p className="text-xl sm:text-2xl font-bold text-text-main">{formatCurrency(data.faturamento)}</p>
        </div>

        <div className="bg-surface-light p-4 sm:p-6 rounded-xl border border-border-light shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined">receipt_long</span>
            </div>
          </div>
          <h3 className="text-text-muted text-sm font-medium mb-1">Total de Vendas</h3>
          <p className="text-xl sm:text-2xl font-bold text-text-main">{data.totalVendas}</p>
        </div>

        <div className="bg-surface-light p-4 sm:p-6 rounded-xl border border-border-light shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
              <span className="material-symbols-outlined">inventory_2</span>
            </div>
          </div>
          <h3 className="text-text-muted text-sm font-medium mb-1">Estoque Baixo</h3>
          <p className="text-xl sm:text-2xl font-bold text-text-main">{data.produtosEstoqueBaixo.length}</p>
        </div>

        <div className="bg-surface-light p-4 sm:p-6 rounded-xl border border-border-light shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
              <span className="material-symbols-outlined">trending_up</span>
            </div>
          </div>
          <h3 className="text-text-muted text-sm font-medium mb-1">Últimas Vendas</h3>
          <p className="text-xl sm:text-2xl font-bold text-text-main">{data.ultimasVendas.length}</p>
        </div>
      </div>

      {/* Produtos com Estoque Baixo */}
      {data.produtosEstoqueBaixo.length > 0 && (
        <div className="bg-surface-light rounded-xl border border-red-100 shadow-sm p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-text-main mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600">warning</span>
            Produtos com Estoque Baixo
          </h3>
          <div className="space-y-2">
            {data.produtosEstoqueBaixo.map((produto) => (
              <div
                key={produto.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-red-50 rounded-lg"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-text-main truncate">{produto.nome}</p>
                  <p className="text-sm text-text-muted">
                    Estoque mínimo: {produto.estoque_minimo}
                  </p>
                </div>
                <span className="text-red-600 font-bold shrink-0">
                  {produto.estoque_atual} restantes
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Últimas Vendas */}
      <div className="bg-surface-light rounded-xl border border-border-light shadow-sm p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-text-main mb-4">Últimas Vendas</h3>
        {data.ultimasVendas.length === 0 ? (
          <p className="text-text-muted text-center py-8 text-sm sm:text-base">Nenhuma venda registrada ainda</p>
        ) : (
          <div className="space-y-3">
            {data.ultimasVendas.map((venda) => (
              <div
                key={venda.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-4 bg-background-light rounded-lg"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-text-main truncate">{venda.cliente.nome}</p>
                  <p className="text-sm text-text-muted">
                    {new Date(venda.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="text-left sm:text-right flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-text-main">{formatCurrency(Number(venda.total))}</p>
                  <span
                    className={`text-xs px-2 py-1 rounded shrink-0 ${
                      venda.status === 'PAGO'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {venda.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

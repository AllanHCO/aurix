import { useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../utils/format';

export default function Relatorios() {
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [loading, setLoading] = useState(false);
  const [relatorio, setRelatorio] = useState<any>(null);

  const gerarRelatorio = async () => {
    if (!dataInicial || !dataFinal) {
      toast.error('Selecione o período');
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/relatorios', {
        params: { dataInicial, dataFinal }
      });
      setRelatorio(response.data);
    } catch (error: any) {
      toast.error('Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = async () => {
    if (!dataInicial || !dataFinal) {
      toast.error('Selecione o período');
      return;
    }

    try {
      const response = await api.get('/relatorios/exportar', {
        params: { dataInicial, dataFinal },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Relatório exportado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao exportar relatório');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-main mb-2">Relatórios</h1>
        <p className="text-text-muted">Gere relatórios de vendas por período</p>
      </div>

      <div className="bg-surface-light rounded-xl border border-border-light shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
              className="w-full px-4 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
              className="w-full px-4 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={gerarRelatorio}
              disabled={loading}
              className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Gerando...' : 'Gerar Relatório'}
            </button>
            {relatorio && (
              <button
                onClick={exportarCSV}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">download</span>
                CSV
              </button>
            )}
          </div>
        </div>

        {relatorio && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-background-light p-4 rounded-lg border border-border-light">
                <p className="text-text-muted text-sm mb-1">Total de Vendas</p>
                <p className="text-2xl font-bold text-text-main">{relatorio.totalVendas}</p>
              </div>
              <div className="bg-background-light p-4 rounded-lg border border-border-light">
                <p className="text-text-muted text-sm mb-1">Faturamento Total</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(relatorio.faturamento)}
                </p>
              </div>
            </div>

            {relatorio.vendas.length > 0 ? (
              <div className="bg-background-light rounded-lg border border-border-light overflow-hidden">
                <table className="w-full">
                  <thead className="bg-surface-light border-b border-border-light">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-text-muted">
                        Data
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-text-muted">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-text-muted">
                        Total
                      </th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-text-muted">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-text-muted">
                        Pagamento
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {relatorio.vendas.map((venda: any) => (
                      <tr key={venda.id} className="hover:bg-surface-light">
                        <td className="px-6 py-4 text-text-muted">
                          {formatDate(venda.createdAt)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-text-main">
                          {venda.cliente.nome}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-text-main">
                          {formatCurrency(Number(venda.total))}
                        </td>
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
                        <td className="px-6 py-4 text-text-muted">
                          {venda.forma_pagamento}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-text-muted">
                Nenhuma venda encontrada no período selecionado
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

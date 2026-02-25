import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../utils/format';

function getMesAtual(): { inicio: string; fim: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const inicio = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const fim = new Date(y, m + 1, 0);
  const fimStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`;
  return { inicio, fim: fimStr };
}

interface VendaItem {
  id: string;
  createdAt: string;
  cliente: string;
  total: number;
  status: string;
  forma_pagamento: string;
}

interface RelatorioPeriodo {
  periodo: { inicio: string; fim: string };
  periodo_anterior: { inicio: string; fim: string };
  faturamento_total: number;
  total_vendas: number;
  ticket_medio: number;
  faturamento_periodo_anterior: number;
  variacao_percentual: number | null;
  lista_vendas: VendaItem[];
  paginacao: { page: number; limit: number; total: number; total_paginas: number };
}

const LIMIT = 20;

export default function Relatorios() {
  const [searchParams] = useSearchParams();
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [loading, setLoading] = useState(false);
  const [relatorio, setRelatorio] = useState<RelatorioPeriodo | null>(null);
  const [, setPage] = useState(1);
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const loadRelatorio = async (inicio: string, fim: string, pageNum: number = 1, orderDir: 'asc' | 'desc' = order) => {
    setLoading(true);
    try {
      const { data } = await api.get<RelatorioPeriodo>('/relatorios/periodo', {
        params: { dataInicial: inicio, dataFinal: fim, page: pageNum, limit: LIMIT, order: orderDir }
      });
      setRelatorio(data);
      setPage(pageNum);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao gerar relatório';
      toast.error(msg);
      setRelatorio(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const mes = searchParams.get('mes');
    const comparativo = searchParams.get('comparativo');
    if (mes === 'atual' || comparativo === '1') {
      const { inicio, fim } = getMesAtual();
      setDataInicial(inicio);
      setDataFinal(fim);
      loadRelatorio(inicio, fim);
    }
  }, [searchParams]);

  const gerarRelatorio = () => {
    if (!dataInicial || !dataFinal) {
      toast.error('Selecione o período');
      return;
    }
    if (new Date(dataFinal) < new Date(dataInicial)) {
      toast.error('Data final não pode ser anterior à data inicial');
      return;
    }
    loadRelatorio(dataInicial, dataFinal, 1);
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
      const disposition = response.headers['content-disposition'];
      let filename = `relatorio_${dataInicial}_${dataFinal}.csv`;
      if (typeof disposition === 'string' && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1].trim();
      }
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Relatório exportado com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao exportar relatório');
    }
  };

  const goToPage = (p: number) => {
    if (!relatorio || !dataInicial || !dataFinal) return;
    const totalPaginas = relatorio.paginacao.total_paginas;
    const next = Math.max(1, Math.min(p, totalPaginas));
    loadRelatorio(dataInicial, dataFinal, next);
  };

  const toggleOrder = () => {
    const next = order === 'desc' ? 'asc' : 'desc';
    setOrder(next);
    if (dataInicial && dataFinal) loadRelatorio(dataInicial, dataFinal, 1, next);
  };

  const statusLabel = (s: string) => (s === 'PAGO' ? 'Pago' : s === 'FECHADA' ? 'Fechada' : 'Pendente');

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-main mb-1 sm:mb-2">Relatórios</h1>
        <p className="text-sm sm:text-base text-text-muted">Gere relatórios de vendas por período e compare com o mês anterior</p>
      </div>

      <div className="bg-bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Data inicial</label>
            <input
              type="date"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-input-bg text-text-main"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Data final</label>
            <input
              type="date"
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-input-bg text-text-main"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <button
              onClick={gerarRelatorio}
              disabled={loading}
              className="flex-1 bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-3 rounded-lg disabled:opacity-50 min-h-[44px] touch-manipulation"
            >
              {loading ? 'Gerando...' : 'Gerar Relatório'}
            </button>
            <button
              onClick={exportarCSV}
              disabled={!dataInicial || !dataFinal}
              className="flex-1 bg-success hover:bg-success/90 text-text-on-primary font-bold px-4 py-3 rounded-lg flex items-center justify-center gap-2 min-h-[44px] touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">download</span>
              Exportar CSV
            </button>
          </div>
        </div>

        {relatorio && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-bg-elevated p-4 rounded-lg border border-border">
                <p className="text-text-muted text-sm mb-1">Total de vendas</p>
                <p className="text-2xl font-bold text-text-main">{relatorio.total_vendas}</p>
                <p className="text-xs text-text-muted mt-0.5">somente vendas pagas</p>
              </div>
              <div className="bg-bg-elevated p-4 rounded-lg border border-border">
                <p className="text-text-muted text-sm mb-1">Faturamento total</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(relatorio.faturamento_total)}</p>
                <p className="text-xs text-text-muted mt-0.5">somente vendas pagas</p>
              </div>
              <div className="bg-bg-elevated p-4 rounded-lg border border-border">
                <p className="text-text-muted text-sm mb-1">Ticket médio</p>
                <p className="text-2xl font-bold text-text-main">{formatCurrency(relatorio.ticket_medio)}</p>
              </div>
              <div className="bg-bg-elevated p-4 rounded-lg border border-border">
                <p className="text-text-muted text-sm mb-1">Crescimento vs período anterior</p>
                {relatorio.variacao_percentual === null ? (
                  <p className="text-lg font-bold text-text-muted">—</p>
                ) : (
                  <p
                    className={`text-2xl font-bold flex items-center gap-1 ${
                      relatorio.variacao_percentual >= 0 ? 'text-success' : 'text-error'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {relatorio.variacao_percentual >= 0 ? 'trending_up' : 'trending_down'}
                    </span>
                    {relatorio.variacao_percentual >= 0 ? '+' : ''}
                    {relatorio.variacao_percentual.toFixed(1)}%
                  </p>
                )}
                <p className="text-xs text-text-muted mt-0.5">faturamento vs mês anterior</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-4 mb-3">
                <h2 className="text-lg font-semibold text-text-main">Vendas do período</h2>
                <button
                  type="button"
                  onClick={toggleOrder}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Ordenar por data {order === 'desc' ? '(mais recente primeiro)' : '(mais antiga primeiro)'}
                  <span className="material-symbols-outlined text-lg">swap_vert</span>
                </button>
              </div>

              {relatorio.lista_vendas.length > 0 ? (
                <>
                  <div className="bg-bg-elevated rounded-lg border border-border overflow-x-auto">
                    <table className="w-full min-w-[400px]">
                      <thead className="bg-bg-card border-b border-border">
                        <tr>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-text-muted">Data</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-text-muted">Cliente</th>
                          <th className="px-6 py-3 text-right text-sm font-semibold text-text-muted">Total</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-text-muted">Status</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-text-muted">Forma de pagamento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {relatorio.lista_vendas.map((venda) => (
                          <tr key={venda.id} className="hover:bg-bg-card">
                            <td className="px-6 py-4 text-text-muted text-sm">{formatDate(venda.createdAt)}</td>
                            <td className="px-6 py-4 font-semibold text-text-main">{venda.cliente}</td>
                            <td className="px-6 py-4 text-right font-bold text-text-main">{formatCurrency(venda.total)}</td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  venda.status === 'PAGO'
                                    ? 'bg-badge-pago text-badge-pago-text'
                                    : venda.status === 'FECHADA'
                                    ? 'bg-text-muted/20 text-text-muted'
                                    : 'bg-badge-pendente text-badge-pendente-text'
                                }`}
                              >
                                {statusLabel(venda.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-text-muted text-sm">{venda.forma_pagamento}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {relatorio.paginacao.total_paginas > 1 && (
                    <div className="flex items-center justify-between gap-4 mt-4">
                      <p className="text-sm text-text-muted">
                        {relatorio.paginacao.total} venda(s) no período
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => goToPage(relatorio.paginacao.page - 1)}
                          disabled={relatorio.paginacao.page <= 1}
                          className="px-3 py-2 rounded-lg border border-border text-text-main hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Anterior
                        </button>
                        <span className="text-sm text-text-muted">
                          Página {relatorio.paginacao.page} de {relatorio.paginacao.total_paginas}
                        </span>
                        <button
                          type="button"
                          onClick={() => goToPage(relatorio.paginacao.page + 1)}
                          disabled={relatorio.paginacao.page >= relatorio.paginacao.total_paginas}
                          className="px-3 py-2 rounded-lg border border-border text-text-main hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-text-muted bg-bg-elevated rounded-lg border border-border">
                  Nenhuma venda encontrada no período selecionado
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

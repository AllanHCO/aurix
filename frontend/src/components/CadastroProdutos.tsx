import { useEffect, useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/format';
import ProdutoModal from './ProdutoModal';

type FiltroDesempenho = 'todos' | 'mais_vendidos' | 'menos_vendidos';
type PeriodoDesempenho = 'este_mes' | 'ultimos_3_meses';

export interface Produto {
  id: string;
  nome: string;
  preco: number;
  custo: number;
  estoque_atual: number;
  estoque_minimo: number;
  categoria_id?: string;
  categoria_nome?: string;
  qtdVendidaMesAtual?: number;
}

export default function CadastroProdutos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [filtro, setFiltro] = useState<FiltroDesempenho>('todos');
  const [periodo, setPeriodo] = useState<PeriodoDesempenho>('este_mes');

  const loadProdutos = async (filtroAtual?: FiltroDesempenho, periodoAtual?: PeriodoDesempenho) => {
    const f = filtroAtual ?? filtro;
    const p = periodoAtual ?? periodo;
    try {
      setLoading(true);
      const response = await api.get<Produto[]>('/produtos', {
        params: { filtro: f, periodo: p }
      });
      setProdutos(response.data);
    } catch (error: any) {
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProdutos('todos', 'este_mes');
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      await api.delete(`/produtos/${id}`);
      toast.success('Produto excluído com sucesso!');
      loadProdutos(filtro, periodo);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao excluir produto');
    }
  };

  const handleEdit = (produto: Produto) => {
    setProdutoEditando(produto);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setProdutoEditando(null);
    loadProdutos(filtro, periodo);
  };

  const handleFiltroChange = (novoFiltro: FiltroDesempenho) => {
    setFiltro(novoFiltro);
    loadProdutos(novoFiltro, periodo);
  };

  const handlePeriodoChange = (novoPeriodo: PeriodoDesempenho) => {
    setPeriodo(novoPeriodo);
    loadProdutos(filtro, novoPeriodo);
  };

  const isEstoqueBaixo = (produto: Produto) =>
    produto.estoque_atual <= produto.estoque_minimo;

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-text-main mb-1">Cadastro de Produtos</h2>
          <p className="text-sm text-text-muted">Listagem, filtros e indicadores de vendas</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-3 sm:px-5 sm:py-2.5 rounded-lg flex items-center justify-center gap-2 min-h-[44px] touch-manipulation shrink-0"
        >
          <span className="material-symbols-outlined">add</span>
          Novo Produto
        </button>
      </div>

      {produtos.length === 0 ? (
        <div className="bg-surface-light rounded-xl border border-border-light p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-text-muted mb-4 block">
            inventory_2
          </span>
          <h3 className="text-xl font-bold text-text-main mb-2">Nenhum produto cadastrado</h3>
          <p className="text-text-muted mb-6">
            Comece adicionando seu primeiro produto ao estoque
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-6 py-3 rounded-lg"
          >
            Adicionar Produto
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-text-muted">Período:</span>
            <div className="flex flex-wrap gap-2">
              {(['este_mes', 'ultimos_3_meses'] as PeriodoDesempenho[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodoChange(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[40px] touch-manipulation ${
                    periodo === p
                      ? 'bg-primary text-text-on-primary'
                      : 'bg-surface-light text-text-main border border-border-light hover:bg-background-light'
                  }`}
                >
                  {p === 'este_mes' ? 'Este mês' : 'Últimos 3 meses'}
                </button>
              ))}
            </div>
            <span className="text-sm text-text-muted ml-1 sm:ml-0">Filtro:</span>
            <div className="flex flex-wrap gap-2">
              {(['todos', 'mais_vendidos', 'menos_vendidos'] as FiltroDesempenho[]).map((f) => (
                <button
                  key={f}
                  onClick={() => handleFiltroChange(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[40px] touch-manipulation ${
                    filtro === f
                      ? 'bg-primary text-text-on-primary'
                      : 'bg-surface-light text-text-main border border-border-light hover:bg-background-light'
                  }`}
                >
                  {f === 'todos' ? 'Todos' : f === 'mais_vendidos' ? 'Mais Vendidos' : 'Menos Vendidos'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-light rounded-xl border border-border-light shadow-sm overflow-hidden">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-background-light border-b border-border-light">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                        Nome
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                        Categoria
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-text-muted">
                        Preço
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-text-muted">
                        Custo
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-text-muted">
                        Estoque
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-text-muted">
                        Mínimo
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-text-muted" title="Apenas vendas com status PAGO no período selecionado">
                        Qtd vendida
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-text-muted">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {produtos.map((produto, index) => {
                      const qtd = produto.qtdVendidaMesAtual ?? 0;
                      const top3MaisVendidos = filtro === 'mais_vendidos' && index < 3;
                      const zeroVendasMenosVendidos = filtro === 'menos_vendidos' && qtd === 0;
                      return (
                        <tr
                          key={produto.id}
                          className={`hover:bg-background-light ${
                            isEstoqueBaixo(produto) ? 'bg-badge-estoque' : ''
                          }`}
                        >
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold text-text-main truncate">{produto.nome}</span>
                              {isEstoqueBaixo(produto) && (
                                <span className="text-xs bg-badge-estoque text-badge-estoque-text px-2 py-1 rounded shrink-0">
                                  Estoque Baixo
                                </span>
                              )}
                              {top3MaisVendidos && (
                                <span className="text-info shrink-0" title={periodo === 'este_mes' ? 'Top 3 mais vendidos no mês' : 'Top 3 mais vendidos no período'}>🔥</span>
                              )}
                              {zeroVendasMenosVendidos && (
                                <span className="text-warning shrink-0" title={periodo === 'este_mes' ? 'Sem vendas no mês' : 'Sem vendas no período'}>⚠️</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-sm">
                            {produto.categoria_nome ?? '-'}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-semibold text-text-main text-sm sm:text-base">
                            {formatCurrency(produto.preco)}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-right text-text-muted text-sm">
                            {formatCurrency(produto.custo)}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-semibold text-text-main">
                            {produto.estoque_atual}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-right text-text-muted">
                            {produto.estoque_minimo}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-medium text-text-main">
                            {produto.qtdVendidaMesAtual ?? 0}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-center justify-center gap-1 sm:gap-2">
                              <button
                                onClick={() => handleEdit(produto)}
                                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-primary hover:bg-primary/10 rounded touch-manipulation"
                              >
                                <span className="material-symbols-outlined">edit</span>
                              </button>
                              <button
                                onClick={() => handleDelete(produto.id)}
                                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-error hover:bg-badge-erro rounded touch-manipulation"
                              >
                                <span className="material-symbols-outlined">delete</span>
                              </button>
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
        </>
      )}

      {modalOpen && (
        <ProdutoModal
          produto={produtoEditando}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/format';
import ProdutoModal from './ProdutoModal';

type FiltroDesempenho = 'todos' | 'mais_vendidos' | 'menos_vendidos' | 'estoque_baixo';
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
  linha?: string | null;
  qtdVendidaMesAtual?: number;
}

interface CadastroProdutosProps {
  initialFiltro?: FiltroDesempenho;
  initialPeriodo?: PeriodoDesempenho;
}

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function CadastroProdutos({ initialFiltro, initialPeriodo }: CadastroProdutosProps = {}) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [filtro, setFiltro] = useState<FiltroDesempenho>(initialFiltro ?? 'todos');
  const [periodo, setPeriodo] = useState<PeriodoDesempenho>(initialPeriodo ?? 'este_mes');
  const [buscaNome, setBuscaNome] = useState('');
  const debouncedNome = useDebounce(buscaNome.trim(), 350);

  const loadProdutos = async (filtroAtual?: FiltroDesempenho, periodoAtual?: PeriodoDesempenho, nome?: string) => {
    const f = filtroAtual ?? filtro;
    const p = periodoAtual ?? periodo;
    const n = nome !== undefined ? nome : debouncedNome;
    try {
      setLoading(true);
      const params: Record<string, string> = { filtro: f, periodo: p };
      if (n) params.nome = n;
      const response = await api.get<Produto[]>('/produtos', { params });
      setProdutos(response.data);
    } catch (error: any) {
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProdutos(filtro, periodo, debouncedNome);
  }, [filtro, periodo, debouncedNome]);

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

  const handleFiltroChange = (novoFiltro: FiltroDesempenho) => setFiltro(novoFiltro);
  const handlePeriodoChange = (novoPeriodo: PeriodoDesempenho) => setPeriodo(novoPeriodo);

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
        <div className="bg-bg-card rounded-xl border border-border p-12 text-center">
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0 max-w-md">
              <label htmlFor="busca-produto" className="block text-sm font-medium text-text-muted mb-1">Busca por nome</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none">search</span>
                <input
                  id="busca-produto"
                  type="text"
                  value={buscaNome}
                  onChange={(e) => setBuscaNome(e.target.value)}
                  placeholder="Nome do produto..."
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-input-bg text-text-main placeholder:text-text-muted focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>
          </div>
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
                      : 'bg-bg-card text-text-main border border-border hover:bg-bg-elevated'
                  }`}
                >
                  {p === 'este_mes' ? 'Este mês' : 'Últimos 3 meses'}
                </button>
              ))}
            </div>
            <span className="text-sm text-text-muted ml-1 sm:ml-0">Filtro:</span>
            <div className="flex flex-wrap gap-2">
              {(['todos', 'mais_vendidos', 'menos_vendidos', 'estoque_baixo'] as FiltroDesempenho[]).map((f) => (
                <button
                  key={f}
                  onClick={() => handleFiltroChange(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[40px] touch-manipulation ${
                    filtro === f
                      ? 'bg-primary text-text-on-primary'
                      : 'bg-bg-card text-text-main border border-border hover:bg-bg-elevated'
                  }`}
                >
                  {f === 'todos' ? 'Todos' : f === 'mais_vendidos' ? 'Mais Vendidos' : f === 'menos_vendidos' ? 'Menos Vendidos' : 'Estoque Baixo'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-bg-elevated border-b border-border">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                        Nome
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                        Categoria
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-text-muted">
                        Linha
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
                  <tbody className="divide-y divide-border">
                    {produtos.map((produto, index) => {
                      const qtd = produto.qtdVendidaMesAtual ?? 0;
                      const top3MaisVendidos = filtro === 'mais_vendidos' && index < 3;
                      const zeroVendasMenosVendidos = filtro === 'menos_vendidos' && qtd === 0;
                      return (
                        <tr
                          key={produto.id}
                          className={`hover:bg-bg-elevated ${
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
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-sm">
                            {produto.linha ?? '-'}
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

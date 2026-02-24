import { useEffect, useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/format';
import StockStatusBadge, { isStockAvailable } from './StockStatusBadge';

interface Produto {
  id: string;
  nome: string;
  preco: number;
  estoque_atual: number;
  estoque_minimo?: number;
  categoria_id?: string;
}

interface Categoria {
  id: string;
  nome: string;
  produtosCount?: number;
}

export interface ItemVenda {
  produto_id: string;
  nome: string;
  preco_unitario: number;
  quantidade: number;
}

interface SelecaoProdutosModalProps {
  open: boolean;
  onClose: () => void;
  itensDaVenda: ItemVenda[];
  setItensDaVenda: React.Dispatch<React.SetStateAction<ItemVenda[]>>;
}

export default function SelecaoProdutosModal({
  open,
  onClose,
  itensDaVenda,
  setItensDaVenda
}: SelecaoProdutosModalProps) {
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCat, setLoadingCat] = useState(true);
  const [rowState, setRowState] = useState<Record<string, { quantidade: number }>>({});

  const categoriaIds = categoriasSelecionadas.length > 0 ? categoriasSelecionadas : [];
  const debouncedSearch = useDebounce(searchQuery, 300);

  const loadCategorias = async () => {
    setLoadingCat(true);
    try {
      const res = await api.get<Categoria[]>('/categorias');
      setCategorias(res.data);
    } catch {
      toast.error('Erro ao carregar categorias');
    } finally {
      setLoadingCat(false);
    }
  };

  const loadProdutos = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | string[]> = {};
      if (categoriaIds.length) params.categoria_ids = categoriaIds;
      if (debouncedSearch.trim()) params.nome = debouncedSearch.trim();
      const res = await api.get<Produto[]>('/produtos', { params });
      setProdutos(res.data);
    } catch {
      setProdutos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadCategorias();
  }, [open]);

  useEffect(() => {
    if (open) loadProdutos();
  }, [open, categoriasSelecionadas.join(','), debouncedSearch]);

  const toggleCategoria = (id: string) => {
    setCategoriasSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const limparFiltros = () => {
    setCategoriasSelecionadas([]);
    setSearchQuery('');
  };

  const listaProdutosFiltrados = produtos;

  const getRowState = (produtoId: string) => rowState[produtoId] ?? { quantidade: 1 };

  const setRowStateFor = (produtoId: string, upd: Partial<{ quantidade: number }>) => {
    setRowState((prev) => ({
      ...prev,
      [produtoId]: { ...getRowState(produtoId), ...upd }
    }));
  };

  const handleAdicionar = (p: Produto) => {
    const { quantidade } = getRowState(p.id);
    const qty = Math.max(1, Math.floor(Number(quantidade) || 1));

    setItensDaVenda((prev) => {
      const idx = prev.findIndex((i) => i.produto_id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantidade: next[idx].quantidade + qty };
        return next;
      }
      return [
        ...prev,
        { produto_id: p.id, nome: p.nome, preco_unitario: p.preco, quantidade: qty }
      ];
    });
    toast.success('Produto adicionado');
  };

  const totalItens = itensDaVenda.length;
  const totalProdutos = categorias.reduce((acc, c) => acc + (c.produtosCount ?? 0), 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[60] p-4" style={{ backgroundColor: 'var(--color-overlay)' }}>
      <div className="bg-bg-elevated border border-border-soft rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-text-main">Seleção de Produtos</h2>
            <p className="text-sm text-text-muted mt-0.5">
              Configure o pedido e adicione itens ao fluxo de venda atual
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary font-medium text-sm">
              {totalItens} {totalItens === 1 ? 'item' : 'itens'} no carrinho
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-elevated"
              aria-label="Fechar"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 flex-1 min-h-0 flex flex-col">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex-1 min-w-[200px] relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por nome, SKU ou código de barras..."
                className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-input-bg text-text-main placeholder:text-text-muted focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-medium text-text-muted">Filtro por categorias (multi-seleção)</p>
              {(categoriasSelecionadas.length > 0 || searchQuery.trim()) && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoriasSelecionadas([])}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  categoriasSelecionadas.length === 0
                    ? 'bg-primary text-text-on-primary'
                    : 'bg-bg-elevated text-text-main hover:bg-bg-card border border-border'
                }`}
              >
                Todos os produtos ({totalProdutos})
              </button>
              {!loadingCat &&
                categorias.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategoria(c.id)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      categoriasSelecionadas.includes(c.id)
                        ? 'bg-primary text-text-on-primary'
                        : 'bg-bg-elevated text-text-main hover:bg-bg-card border border-border'
                    }`}
                  >
                    {c.nome} ({c.produtosCount ?? 0})
                  </button>
                ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto border border-border rounded-lg">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-elevated text-text-muted sticky top-0 z-10">
                <tr>
                  <th className="p-3 font-medium">Produto</th>
                  <th className="p-3 font-medium w-28">Preço unit.</th>
                  <th className="p-3 font-medium w-24">Estoque</th>
                  <th className="p-3 font-medium w-32">Quantidade</th>
                  <th className="p-3 font-medium w-28">Ação</th>
                </tr>
              </thead>
              <tbody className="text-text-main divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-text-muted">
                      Carregando...
                    </td>
                  </tr>
                ) : listaProdutosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-text-muted">
                      Nenhum produto encontrado
                    </td>
                  </tr>
                ) : (
                  listaProdutosFiltrados.map((p) => {
                    const { quantidade } = getRowState(p.id);
                    const disponivel = isStockAvailable(p.estoque_atual);
                    const adicionado = itensDaVenda.some((item) => item.produto_id === p.id);
                    return (
                      <tr
                        key={p.id}
                        className={`transition-all duration-200 hover:bg-bg-elevated/50 ${
                          adicionado ? 'ring-1 ring-inset ring-mint/60' : ''
                        }`}
                      >
                        <td className="p-3 font-medium">{p.nome}</td>
                        <td className="p-3">{formatCurrency(p.preco)}</td>
                        <td className="p-3">
                          <StockStatusBadge
                            estoque={p.estoque_atual}
                            estoqueMinimo={p.estoque_minimo ?? 0}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              max={p.estoque_atual}
                              value={quantidade}
                              onChange={(e) =>
                                setRowStateFor(p.id, {
                                  quantidade: parseInt(e.target.value, 10) || 1
                                })
                              }
                              disabled={!disponivel}
                              className="w-14 px-2 py-1 border border-border rounded bg-input-bg text-text-main disabled:opacity-50"
                            />
                          </div>
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => disponivel && handleAdicionar(p)}
                            disabled={!disponivel}
                            className={
                              disponivel
                                ? 'bg-primary hover:bg-primary-hover text-text-on-primary px-2 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 focus:ring-0 focus:outline-none h-[26px] min-w-[4.5rem]'
                                : 'bg-bg-elevated text-text-muted cursor-not-allowed px-2 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 focus:ring-0 focus:outline-none h-[26px] min-w-[4.5rem]'
                            }
                          >
                            {disponivel ? (
                              <>
                                <span className="material-symbols-outlined text-sm">add</span>
                                Adicionar
                              </>
                            ) : (
                              'Indisponível'
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-text-on-primary font-semibold rounded-lg"
            >
              Finalizar Seleção
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

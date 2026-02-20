import { useEffect, useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/format';
import ProdutoModal from '../components/ProdutoModal';

interface Produto {
  id: string;
  nome: string;
  preco: number;
  custo: number;
  estoque_atual: number;
  estoque_minimo: number;
}

export default function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);

  useEffect(() => {
    loadProdutos();
  }, []);

  const loadProdutos = async () => {
    try {
      const response = await api.get('/produtos');
      setProdutos(response.data);
    } catch (error: any) {
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      await api.delete(`/produtos/${id}`);
      toast.success('Produto excluído com sucesso!');
      loadProdutos();
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
    loadProdutos();
  };

  const isEstoqueBaixo = (produto: Produto) =>
    produto.estoque_atual <= produto.estoque_minimo;

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-main mb-2">Produtos</h1>
          <p className="text-text-muted">Gerencie seu estoque</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-primary hover:bg-primary-dark text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-2"
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
            className="bg-primary hover:bg-primary-dark text-white font-bold px-6 py-3 rounded-lg"
          >
            Adicionar Produto
          </button>
        </div>
      ) : (
        <div className="bg-surface-light rounded-xl border border-border-light shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-background-light border-b border-border-light">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text-muted">
                  Nome
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-text-muted">
                  Preço
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-text-muted">
                  Custo
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-text-muted">
                  Estoque
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-text-muted">
                  Mínimo
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-text-muted">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {produtos.map((produto) => (
                <tr
                  key={produto.id}
                  className={`hover:bg-background-light ${
                    isEstoqueBaixo(produto) ? 'bg-red-50' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-main">{produto.nome}</span>
                      {isEstoqueBaixo(produto) && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                          Estoque Baixo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-text-main">
                    {formatCurrency(produto.preco)}
                  </td>
                  <td className="px-6 py-4 text-right text-text-muted">
                    {formatCurrency(produto.custo)}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-text-main">
                    {produto.estoque_atual}
                  </td>
                  <td className="px-6 py-4 text-right text-text-muted">
                    {produto.estoque_minimo}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEdit(produto)}
                        className="p-2 text-primary hover:bg-primary/10 rounded"
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(produto.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

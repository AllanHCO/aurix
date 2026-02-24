import { useEffect, useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface Categoria {
  id: string;
  nome: string;
  produtosCount?: number;
}

export default function CategoriasTab() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<Categoria | null>(null);
  const [nome, setNome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCategorias = async () => {
    try {
      setLoading(true);
      const res = await api.get<Categoria[]>('/categorias');
      setCategorias(res.data);
    } catch {
      toast.error('Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategorias();
  }, []);

  const openNew = () => {
    setCategoriaEditando(null);
    setNome('');
    setModalOpen(true);
  };

  const openEdit = (c: Categoria) => {
    setCategoriaEditando(c);
    setNome(c.nome);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setCategoriaEditando(null);
    setNome('');
    loadCategorias();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const n = nome.trim().replace(/\s+/g, ' ');
    if (!n) {
      toast.error('Nome da categoria é obrigatório');
      return;
    }
    setIsSubmitting(true);
    try {
      if (categoriaEditando) {
        await api.put(`/categorias/${categoriaEditando.id}`, { nome: n });
        toast.success('Categoria atualizada');
      } else {
        const idempotencyKey = crypto.randomUUID?.() ?? `cat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await api.post('/categorias', { nome: n }, { headers: { 'Idempotency-Key': idempotencyKey } });
        toast.success('Categoria criada');
      }
      closeModal();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao salvar categoria';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (c: Categoria) => {
    if (!confirm(`Excluir a categoria "${c.nome}"?`)) return;
    try {
      await api.delete(`/categorias/${c.id}`);
      toast.success('Categoria excluída');
      loadCategorias();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao excluir categoria';
      toast.error(msg);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-text-main mb-1">Categorias</h2>
          <p className="text-sm text-text-muted">Organize produtos por categoria</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-3 sm:px-5 sm:py-2.5 rounded-lg flex items-center justify-center gap-2 min-h-[44px] touch-manipulation shrink-0"
        >
          <span className="material-symbols-outlined">add</span>
          Nova Categoria
        </button>
      </div>

      {categorias.length === 0 ? (
        <div className="bg-bg-card rounded-xl border border-border p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-text-muted mb-4 block">
            folder
          </span>
          <h3 className="text-xl font-bold text-text-main mb-2">Nenhuma categoria</h3>
          <p className="text-text-muted mb-6">
            Crie categorias para organizar seus produtos
          </p>
          <button
            type="button"
            onClick={openNew}
            className="bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-6 py-3 rounded-lg"
          >
            Nova Categoria
          </button>
        </div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <ul className="divide-y divide-border">
            {categorias.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 hover:bg-bg-main"
              >
                <span className="font-medium text-text-main">
                  {c.nome}
                  <span className="text-text-muted font-normal ml-2">
                    ({c.produtosCount ?? 0} {c.produtosCount === 1 ? 'produto' : 'produtos'})
                  </span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-primary hover:bg-primary/10 rounded touch-manipulation"
                    title="Editar"
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-error hover:bg-badge-erro rounded touch-manipulation"
                    title="Excluir"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'var(--color-overlay)' }}>
          <div className="bg-bg-elevated border border-border-soft rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-text-main mb-4">
              {categoriaEditando ? 'Editar categoria' : 'Nova categoria'}
            </h3>
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Nome
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-border bg-bg-main text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ex: Bebidas"
                maxLength={100}
                autoFocus
              />
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-3 rounded-lg border border-border text-text-main font-medium hover:bg-bg-main"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 rounded-lg bg-primary hover:bg-primary-hover text-text-on-primary font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Salvando…' : categoriaEditando ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

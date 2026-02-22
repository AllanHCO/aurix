import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const produtoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  preco: z.number().positive('Preço deve ser positivo'),
  custo: z.number().nonnegative('Custo não pode ser negativo'),
  estoque_atual: z.number().int().nonnegative('Estoque atual não pode ser negativo'),
  estoque_minimo: z.number().int().nonnegative('Estoque mínimo não pode ser negativo'),
  categoria_id: z.string().min(1, 'Categoria é obrigatória')
});

type ProdutoForm = z.infer<typeof produtoSchema>;

interface Categoria {
  id: string;
  nome: string;
}

interface ProdutoModalProps {
  produto?: {
    id: string;
    nome: string;
    preco: number;
    custo: number;
    estoque_atual: number;
    estoque_minimo: number;
    categoria_id?: string;
  } | null;
  onClose: () => void;
}

export default function ProdutoModal({ produto, onClose }: ProdutoModalProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [novaCategoriaOpen, setNovaCategoriaOpen] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<ProdutoForm>({
    resolver: zodResolver(produtoSchema),
    defaultValues: { categoria_id: '' }
  });

  const categoriaId = watch('categoria_id');

  useEffect(() => {
    api.get<Categoria[]>('/categorias').then((r) => setCategorias(r.data)).catch(() => toast.error('Erro ao carregar categorias'));
  }, []);

  useEffect(() => {
    if (produto) {
      reset({
        nome: produto.nome,
        preco: produto.preco,
        custo: produto.custo,
        estoque_atual: produto.estoque_atual,
        estoque_minimo: produto.estoque_minimo,
        categoria_id: produto.categoria_id ?? ''
      });
    } else {
      reset({
        nome: '',
        preco: 0,
        custo: 0,
        estoque_atual: 0,
        estoque_minimo: 0,
        categoria_id: ''
      });
    }
  }, [produto, reset]);

  useEffect(() => {
    if (!produto && categorias.length > 0 && !categoriaId) {
      setValue('categoria_id', categorias[0].id);
    }
  }, [produto, categorias, categoriaId, setValue]);

  const onSubmit = async (data: ProdutoForm) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (produto) {
        await api.put(`/produtos/${produto.id}`, data);
        toast.success('Produto atualizado com sucesso!');
      } else {
        const idempotencyKey = crypto.randomUUID?.() ?? `produto-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await api.post('/produtos', data, {
          headers: { 'Idempotency-Key': idempotencyKey }
        });
        toast.success('Produto criado com sucesso!');
      }
      onClose();
    } catch (error: any) {
      setIsSubmitting(false);
      toast.error(error.response?.data?.error || 'Erro ao salvar produto');
    }
  };

  const criarCategoria = async () => {
    const nome = novaCategoriaNome.trim();
    if (!nome) {
      toast.error('Informe o nome da categoria');
      return;
    }
    try {
      const { data } = await api.post<Categoria>('/categorias', { nome });
      setCategorias((prev) => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      setValue('categoria_id', data.id);
      setNovaCategoriaNome('');
      setNovaCategoriaOpen(false);
      toast.success('Categoria criada');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao criar categoria');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-surface-light rounded-xl shadow-lg max-w-2xl w-full my-auto max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-border-light flex items-center justify-between shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-text-main">
            {produto ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-elevated min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Nome *
            </label>
            <input
              type="text"
              {...register('nome')}
              className="w-full px-4 py-3 sm:py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-base min-h-[44px] touch-manipulation"
            />
            {errors.nome && (
              <p className="text-red-500 text-sm mt-1">{errors.nome.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Categoria *
            </label>
            <div className="flex gap-2">
              <select
                {...register('categoria_id')}
                className="flex-1 px-4 py-3 sm:py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-base min-h-[44px] touch-manipulation"
              >
                <option value="">Selecione uma categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setNovaCategoriaOpen(true)}
                className="px-3 py-2 border border-primary text-primary rounded-lg hover:bg-primary/10 shrink-0 min-h-[44px] touch-manipulation flex items-center gap-1"
                title="Nova categoria"
              >
                <span className="material-symbols-outlined">add</span>
                Nova
              </button>
            </div>
            {errors.categoria_id && (
              <p className="text-red-500 text-sm mt-1">{errors.categoria_id.message}</p>
            )}
          </div>

          {novaCategoriaOpen && (
            <div className="flex gap-2 p-3 bg-background-light rounded-lg border border-border-light">
              <input
                type="text"
                value={novaCategoriaNome}
                onChange={(e) => setNovaCategoriaNome(e.target.value)}
                placeholder="Nome da nova categoria"
                className="flex-1 px-3 py-2 border border-border-light rounded-lg outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <button type="button" onClick={criarCategoria} className="px-3 py-2 bg-primary text-white rounded-lg font-medium">
                Criar
              </button>
              <button type="button" onClick={() => { setNovaCategoriaOpen(false); setNovaCategoriaNome(''); }} className="px-3 py-2 border border-border-light rounded-lg">
                Cancelar
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">
                Preço *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('preco', { valueAsNumber: true })}
                className="w-full px-4 py-3 sm:py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-base min-h-[44px] touch-manipulation"
              />
              {errors.preco && (
                <p className="text-red-500 text-sm mt-1">{errors.preco.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-main mb-1">
                Custo *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('custo', { valueAsNumber: true })}
                className="w-full px-4 py-3 sm:py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-base min-h-[44px] touch-manipulation"
              />
              {errors.custo && (
                <p className="text-red-500 text-sm mt-1">{errors.custo.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">
                Estoque Atual *
              </label>
              <input
                type="number"
                {...register('estoque_atual', { valueAsNumber: true })}
                className="w-full px-4 py-3 sm:py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-base min-h-[44px] touch-manipulation"
              />
              {errors.estoque_atual && (
                <p className="text-red-500 text-sm mt-1">{errors.estoque_atual.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-main mb-1">
                Estoque Mínimo *
              </label>
              <input
                type="number"
                {...register('estoque_minimo', { valueAsNumber: true })}
                className="w-full px-4 py-3 sm:py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-base min-h-[44px] touch-manipulation"
              />
              {errors.estoque_minimo && (
                <p className="text-red-500 text-sm mt-1">{errors.estoque_minimo.message}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 border border-border-light rounded-lg text-text-main hover:bg-background-light min-h-[44px] touch-manipulation disabled:opacity-50 disabled:pointer-events-none"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold px-4 py-3 rounded-lg min-h-[44px] touch-manipulation flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  Processando...
                </>
              ) : produto ? (
                'Atualizar'
              ) : (
                'Criar Produto'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

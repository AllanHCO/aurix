import { useEffect } from 'react';
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
  estoque_minimo: z.number().int().nonnegative('Estoque mínimo não pode ser negativo')
});

type ProdutoForm = z.infer<typeof produtoSchema>;

interface ProdutoModalProps {
  produto?: {
    id: string;
    nome: string;
    preco: number;
    custo: number;
    estoque_atual: number;
    estoque_minimo: number;
  } | null;
  onClose: () => void;
}

export default function ProdutoModal({ produto, onClose }: ProdutoModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ProdutoForm>({
    resolver: zodResolver(produtoSchema)
  });

  useEffect(() => {
    if (produto) {
      reset({
        nome: produto.nome,
        preco: produto.preco,
        custo: produto.custo,
        estoque_atual: produto.estoque_atual,
        estoque_minimo: produto.estoque_minimo
      });
    } else {
      reset({
        nome: '',
        preco: 0,
        custo: 0,
        estoque_atual: 0,
        estoque_minimo: 0
      });
    }
  }, [produto, reset]);

  const onSubmit = async (data: ProdutoForm) => {
    try {
      if (produto) {
        await api.put(`/produtos/${produto.id}`, data);
        toast.success('Produto atualizado com sucesso!');
      } else {
        await api.post('/produtos', data);
        toast.success('Produto criado com sucesso!');
      }
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao salvar produto');
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
            className="p-2 -m-2 rounded-lg text-text-muted hover:text-text-main hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
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
              className="flex-1 px-4 py-3 border border-border-light rounded-lg text-text-main hover:bg-background-light min-h-[44px] touch-manipulation"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold px-4 py-3 rounded-lg min-h-[44px] touch-manipulation"
            >
              {produto ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

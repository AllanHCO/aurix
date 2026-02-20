import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const clienteSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  telefone: z.string().optional(),
  observacoes: z.string().optional()
});

type ClienteForm = z.infer<typeof clienteSchema>;

interface ClienteModalProps {
  cliente?: {
    id: string;
    nome: string;
    telefone: string | null;
    observacoes: string | null;
  } | null;
  onClose: () => void;
}

export default function ClienteModal({ cliente, onClose }: ClienteModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema)
  });

  useEffect(() => {
    if (cliente) {
      reset({
        nome: cliente.nome,
        telefone: cliente.telefone || '',
        observacoes: cliente.observacoes || ''
      });
    } else {
      reset({
        nome: '',
        telefone: '',
        observacoes: ''
      });
    }
  }, [cliente, reset]);

  const onSubmit = async (data: ClienteForm) => {
    try {
      if (cliente) {
        await api.put(`/clientes/${cliente.id}`, data);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await api.post('/clientes', data);
        toast.success('Cliente criado com sucesso!');
      }
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao salvar cliente');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-light rounded-xl shadow-lg max-w-2xl w-full">
        <div className="p-6 border-b border-border-light flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-main">
            {cliente ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Nome *
            </label>
            <input
              type="text"
              {...register('nome')}
              className="w-full px-4 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
            {errors.nome && (
              <p className="text-red-500 text-sm mt-1">{errors.nome.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Telefone
            </label>
            <input
              type="text"
              {...register('telefone')}
              className="w-full px-4 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="(11) 99999-9999"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Observações
            </label>
            <textarea
              {...register('observacoes')}
              rows={4}
              className="w-full px-4 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="Anotações sobre o cliente..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border-light rounded-lg text-text-main hover:bg-background-light"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold px-4 py-2 rounded-lg"
            >
              {cliente ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../services/api';
import toast from 'react-hot-toast';
type ClienteStatusManual = 'ativo' | 'atencao' | 'inativo';

const clienteSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  telefone: z.string().optional(),
  observacoes: z.string().optional()
});

type ClienteForm = z.infer<typeof clienteSchema>;

const STATUS_OPCOES: { valor: ClienteStatusManual; label: string; cor: string; bg: string }[] = [
  { valor: 'ativo', label: 'Ativo', cor: 'text-green-700 dark:text-green-300', bg: 'bg-green-500' },
  { valor: 'atencao', label: 'Atenção', cor: 'text-amber-800 dark:text-amber-200', bg: 'bg-amber-400' },
  { valor: 'inativo', label: 'Inativo', cor: 'text-red-700 dark:text-red-300', bg: 'bg-red-500' }
];

interface ClienteModalProps {
  cliente?: {
    id: string;
    nome: string;
    telefone: string | null;
    observacoes: string | null;
    status?: ClienteStatusManual;
  } | null;
  onClose: () => void;
}

export default function ClienteModal({ cliente, onClose }: ClienteModalProps) {
  const [statusLocal, setStatusLocal] = useState<ClienteStatusManual>(cliente?.status ?? 'ativo');
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
      setStatusLocal(cliente.status ?? 'ativo');
    } else {
      reset({
        nome: '',
        telefone: '',
        observacoes: ''
      });
      setStatusLocal('ativo');
    }
  }, [cliente, reset]);

  const onSubmit = async (data: ClienteForm) => {
    try {
      const payload = { ...data, status: statusLocal };
      if (cliente) {
        await api.put(`/clientes/${cliente.id}`, payload);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await api.post('/clientes', payload);
        toast.success('Cliente criado com sucesso!');
      }
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao salvar cliente');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-surface-light rounded-xl shadow-lg max-w-2xl w-full my-auto max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-border-light flex items-center justify-between shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-text-main">
            {cliente ? 'Editar Cliente' : 'Novo Cliente'}
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
              Telefone
            </label>
            <input
              type="text"
              {...register('telefone')}
              className="w-full px-4 py-3 sm:py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-base min-h-[44px] touch-manipulation"
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

          <div className="pt-2 pb-2 border-t border-border-light">
            <p className="text-sm font-medium text-text-main mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPCOES.map((op) => {
                const ativo = statusLocal === op.valor;
                return (
                  <button
                    key={op.valor}
                    type="button"
                    onClick={() => setStatusLocal(op.valor)}
                    className={`
                      inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium
                      transition-all duration-200 cursor-pointer
                      ${ativo
                        ? `${op.bg} text-white shadow-md`
                        : 'bg-surface-elevated text-text-muted hover:bg-surface-light border border-border-light'
                      }
                    `}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${ativo ? 'bg-white/90' : op.bg}`}
                      aria-hidden
                    />
                    {op.label}
                  </button>
                );
              })}
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
              {cliente ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

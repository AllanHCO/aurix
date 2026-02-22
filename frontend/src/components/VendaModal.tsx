import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/format';
import SelecaoProdutosModal, { type ItemVenda } from './SelecaoProdutosModal';

const vendaSchema = z.object({
  cliente_id: z.string().min(1, 'Cliente é obrigatório'),
  desconto_percentual: z
    .number()
    .min(0, 'Desconto não pode ser negativo')
    .max(100, 'Desconto não pode ser maior que 100%')
    .default(0),
  forma_pagamento: z.string().min(1, 'Forma de pagamento é obrigatória'),
  status: z.enum(['PAGO', 'PENDENTE']).default('PENDENTE')
});

type VendaForm = z.infer<typeof vendaSchema>;

function subtotalItem(item: ItemVenda): number {
  return Math.round(item.preco_unitario * item.quantidade * 100) / 100;
}

interface Cliente {
  id: string;
  nome: string;
}

interface VendaParaEdicao {
  id: string;
  cliente_id?: string;
  cliente?: { nome: string };
  desconto: number;
  forma_pagamento: string;
  status: 'PAGO' | 'PENDENTE';
  itens: Array<{
    produto_id: string;
    quantidade: number;
    preco_unitario: number;
    produto?: { nome: string };
  }>;
}

/** Calcula percentual de desconto a partir do valor em R$ e do subtotal. */
function descontoPercentualFromValor(descontoValor: number, subtotal: number): number {
  if (subtotal <= 0) return 0;
  return Math.min(100, Math.max(0, (descontoValor / subtotal) * 100));
}

interface VendaModalProps {
  onClose: () => void;
  vendaId?: string;
  venda?: VendaParaEdicao | null;
}

export default function VendaModal({ onClose, vendaId, venda }: VendaModalProps) {
  const isEdit = Boolean(vendaId && venda);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSelecaoProdutos, setShowSelecaoProdutos] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<VendaForm>({
    resolver: zodResolver(vendaSchema),
    defaultValues: {
      status: 'PENDENTE',
      desconto_percentual: 0
    }
  });

  const descontoPercentual = watch('desconto_percentual') ?? 0;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading && venda && venda.itens?.length) {
      const itensIniciais: ItemVenda[] = venda.itens.map((i) => ({
        produto_id: i.produto_id,
        nome: i.produto?.nome ?? '',
        preco_unitario: Number(i.preco_unitario),
        quantidade: i.quantidade
      }));
      const subtotalBruto = itensIniciais.reduce((acc, i) => acc + subtotalItem(i), 0);
      const percentual = descontoPercentualFromValor(Number(venda.desconto) || 0, subtotalBruto);
      reset({
        cliente_id: venda.cliente_id ?? '',
        desconto_percentual: Math.round(percentual * 100) / 100,
        forma_pagamento: venda.forma_pagamento ?? '',
        status: venda.status ?? 'PENDENTE'
      });
      setItens(itensIniciais);
    }
  }, [loading, venda, reset]);

  const loadData = async () => {
    setLoading(true);
    try {
      const clientesRes = await api.get('/clientes');
      setClientes(clientesRes.data);
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const atualizarItemVenda = (index: number, valor: number) => {
    const novosItens = [...itens];
    novosItens[index] = { ...novosItens[index], quantidade: Math.max(1, Math.floor(valor)) };
    setItens(novosItens);
  };

  const subtotalItens = Math.round(itens.reduce((acc, item) => acc + item.preco_unitario * item.quantidade, 0) * 100) / 100;
  const descontoPct = Math.max(0, Math.min(100, Number(descontoPercentual) ?? 0));
  const valorDesconto = Math.round(subtotalItens * (descontoPct / 100) * 100) / 100;
  const totalFinal = Math.round((subtotalItens - valorDesconto) * 100) / 100;

  const onSubmit = async (data: VendaForm) => {
    if (!data.cliente_id || data.cliente_id === '') {
      toast.error('Selecione um cliente');
      return;
    }

    if (!data.forma_pagamento || data.forma_pagamento === '') {
      toast.error('Selecione uma forma de pagamento');
      return;
    }

    if (itens.length === 0) {
      toast.error('Adicione pelo menos um produto à venda');
      return;
    }

    const itensInvalidos = itens.filter(
      (item) => !item.produto_id || item.quantidade <= 0 || item.preco_unitario <= 0
    );
    if (itensInvalidos.length > 0) {
      toast.error('Revise os itens (quantidade e preço devem ser positivos)');
      return;
    }

    const payloadItens = itens.map((item) => ({
      produto_id: item.produto_id,
      quantidade: Number(item.quantidade),
      preco_unitario: Math.round(Number(item.preco_unitario) * 100) / 100
    }));

    if (isEdit && vendaId) {
      try {
        setIsSubmitting(true);
        const vendaData = {
          cliente_id: data.cliente_id,
          desconto_percentual: Math.min(100, Math.max(0, Number(data.desconto_percentual) ?? 0)),
          forma_pagamento: data.forma_pagamento,
          status: data.status || 'PENDENTE',
          itens: payloadItens
        };
        await api.put(`/vendas/${vendaId}`, vendaData);
        toast.success('Venda atualizada com sucesso!');
        onClose();
      } catch (error: any) {
        setIsSubmitting(false);
        const errorMessage = error.response?.data?.error || error.message || 'Erro ao atualizar venda';
        toast.error(errorMessage);
      }
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = crypto.randomUUID?.() ?? `venda-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const vendaData = {
      cliente_id: data.cliente_id,
      desconto_percentual: Math.min(100, Math.max(0, Number(data.desconto_percentual) ?? 0)),
      forma_pagamento: data.forma_pagamento,
      status: data.status || 'PENDENTE',
      itens: payloadItens
    };

    try {
      await api.post('/vendas', vendaData, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });
      toast.success('Venda registrada com sucesso!');
      onClose();
    } catch (error: any) {
      setIsSubmitting(false);
      const errorMessage = error.response?.data?.error || error.message || 'Erro ao registrar venda';
      toast.error(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface-light rounded-xl p-8">
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-surface-light rounded-xl shadow-lg max-w-4xl w-full my-4 sm:my-8 max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-border-light flex items-center justify-between shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-text-main">{isEdit ? 'Editar Venda' : 'Nova Venda'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-elevated min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Cliente *
            </label>
            <select
              {...register('cliente_id')}
              className="w-full px-4 py-3 sm:py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-base min-h-[44px] touch-manipulation"
            >
              <option value="">Selecione um cliente</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
            {errors.cliente_id && (
              <p className="text-red-500 text-sm mt-1">{errors.cliente_id.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-text-main">
                Itens da Venda *
              </label>
              <button
                type="button"
                onClick={() => setShowSelecaoProdutos(true)}
                className="bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined">add</span>
                Adicionar Produtos
              </button>
            </div>

            {itens.length === 0 ? (
              <div className="text-center py-8 border border-border-light rounded-lg text-text-muted bg-background-light">
                Nenhum item adicionado. Clique em &quot;Adicionar Produtos&quot; para abrir o catálogo.
              </div>
            ) : (
              <div className="border border-border-light rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-background-light text-text-muted">
                    <tr>
                      <th className="p-3 font-medium">Produto</th>
                      <th className="p-3 font-medium w-24">Quantidade</th>
                      <th className="p-3 font-medium w-28">Preço unit.</th>
                      <th className="p-3 font-medium w-28 text-right">Subtotal</th>
                      <th className="p-3 w-12" aria-label="Remover" />
                    </tr>
                  </thead>
                  <tbody className="text-text-main divide-y divide-border-light">
                    {itens.map((item, index) => (
                      <tr key={`${item.produto_id}-${index}`} className="hover:bg-surface-elevated/50">
                        <td className="p-3 font-medium">{item.nome}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            min={1}
                            value={item.quantidade}
                            onChange={(e) =>
                              atualizarItemVenda(index, parseInt(e.target.value, 10) || 1)
                            }
                            className="w-16 px-2 py-1 border border-border-light rounded bg-input-bg text-text-main"
                          />
                        </td>
                        <td className="p-3">{formatCurrency(item.preco_unitario)}</td>
                        <td className="p-3 text-right font-medium">
                          {formatCurrency(subtotalItem(item))}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => removerItem(index)}
                            className="text-error hover:bg-badge-erro p-2 rounded"
                            title="Remover item"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">
                Desconto (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  {...register('desconto_percentual', {
                    valueAsNumber: true,
                    min: { value: 0, message: 'Mínimo 0%' },
                    max: { value: 100, message: 'Máximo 100%' }
                  })}
                  className="w-full px-4 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
                <span className="text-text-muted font-medium shrink-0">%</span>
              </div>
              {errors.desconto_percentual && (
                <p className="text-red-500 text-sm mt-1">{errors.desconto_percentual.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-main mb-1">
                Forma de Pagamento *
              </label>
              <select
                {...register('forma_pagamento')}
                className="w-full px-4 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              >
                <option value="">Selecione</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Pix">Pix</option>
              </select>
              {errors.forma_pagamento && (
                <p className="text-red-500 text-sm mt-1">{errors.forma_pagamento.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Status
            </label>
            <select
              {...register('status')}
              className="w-full px-4 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            >
              <option value="PENDENTE">Pendente</option>
              <option value="PAGO">Pago</option>
            </select>
          </div>

          <div className="bg-background-light p-4 rounded-lg border border-border-light">
            <div className="flex justify-between items-center mb-2">
              <span className="text-text-muted">Subtotal</span>
              <span className="font-semibold text-text-main">
                {formatCurrency(subtotalItens)}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-text-muted">Desconto ({descontoPct}%)</span>
              <span className="font-semibold text-text-main">
                {formatCurrency(valorDesconto)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border-light">
              <span className="text-lg font-bold text-text-main">Total final</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(totalFinal)}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-border-light rounded-lg text-text-main hover:bg-background-light disabled:opacity-50 disabled:pointer-events-none"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || itens.length === 0}
              className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  Processando...
                </>
              ) : isEdit ? (
                'Salvar alterações'
              ) : (
                'Finalizar Venda'
              )}
            </button>
          </div>
        </form>
      </div>

      <SelecaoProdutosModal
        open={showSelecaoProdutos}
        onClose={() => setShowSelecaoProdutos(false)}
        itensDaVenda={itens}
        setItensDaVenda={setItens}
      />
    </div>
  );
}

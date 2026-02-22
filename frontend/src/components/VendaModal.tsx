import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/format';

const itemSchema = z.object({
  produto_id: z.string().min(1, 'Produto é obrigatório'),
  quantidade: z.number().int().positive('Quantidade deve ser positiva'),
  preco_unitario: z.number().positive('Preço unitário deve ser positivo')
});

const vendaSchema = z.object({
  cliente_id: z.string().min(1, 'Cliente é obrigatório'),
  desconto: z.number().nonnegative('Desconto não pode ser negativo').default(0),
  forma_pagamento: z.string().min(1, 'Forma de pagamento é obrigatória'),
  status: z.enum(['PAGO', 'PENDENTE']).default('PENDENTE')
});

type VendaForm = z.infer<typeof vendaSchema>;
type ItemForm = z.infer<typeof itemSchema>;

interface Produto {
  id: string;
  nome: string;
  preco: number;
  estoque_atual: number;
  categoria_id?: string;
}

interface Categoria {
  id: string;
  nome: string;
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

interface VendaModalProps {
  onClose: () => void;
  vendaId?: string;
  venda?: VendaParaEdicao | null;
}

export default function VendaModal({ onClose, vendaId, venda }: VendaModalProps) {
  const isEdit = Boolean(vendaId && venda);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoriaIds, setSelectedCategoriaIds] = useState<string[]>([]);
  const [searchNome, setSearchNome] = useState('');

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
      desconto: 0
    }
  });

  const desconto = watch('desconto') || 0;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading && venda && venda.itens?.length) {
      reset({
        cliente_id: venda.cliente_id ?? '',
        desconto: Number(venda.desconto) || 0,
        forma_pagamento: venda.forma_pagamento || '',
        status: venda.status || 'PENDENTE'
      });
      setItens(
        venda.itens.map((i) => ({
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          preco_unitario: Number(i.preco_unitario)
        }))
      );
    }
  }, [loading, venda, reset]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientesRes, categoriasRes] = await Promise.all([
        api.get('/clientes'),
        api.get('/categorias')
      ]);
      setClientes(clientesRes.data);
      setCategorias(categoriasRes.data);
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadProdutos = async (categoriaIds: string[], nome: string) => {
    try {
      const params: Record<string, string | string[]> = {};
      if (categoriaIds.length) params.categoria_ids = categoriaIds;
      if (nome.trim()) params.nome = nome.trim();
      const res = await api.get<Produto[]>('/produtos', { params });
      setProdutos(res.data);
    } catch {
      setProdutos([]);
    }
  };

  useEffect(() => {
    if (!loading) loadProdutos(selectedCategoriaIds, searchNome);
  }, [loading, selectedCategoriaIds, searchNome]);

  const toggleCategoria = (id: string) => {
    setSelectedCategoriaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const adicionarItem = () => {
    setItens([
      ...itens,
      {
        produto_id: '',
        quantidade: 1,
        preco_unitario: 0
      }
    ]);
  };

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const atualizarItem = (index: number, campo: keyof ItemForm, valor: any) => {
    const novosItens = [...itens];
    
    // Converter valores para o tipo correto
    if (campo === 'quantidade') {
      novosItens[index] = { ...novosItens[index], [campo]: Number(valor) || 0 };
    } else if (campo === 'preco_unitario') {
      novosItens[index] = { ...novosItens[index], [campo]: Number(valor) || 0 };
    } else {
      novosItens[index] = { ...novosItens[index], [campo]: valor };
    }

    // Se mudou o produto, atualizar preço
    if (campo === 'produto_id') {
      const produto = produtos.find(p => p.id === valor);
      if (produto) {
        novosItens[index].preco_unitario = Number(produto.preco);
      }
    }

    setItens(novosItens);
  };

  const calcularTotal = () => {
    const subtotal = itens.reduce(
      (acc, item) => acc + item.preco_unitario * item.quantidade,
      0
    );
    return subtotal - (desconto || 0);
  };

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
      toast.error('Adicione pelo menos um item à venda');
      return;
    }

    // Validar itens antes de enviar
    const itensInvalidos = itens.filter(
      item => !item.produto_id || item.quantidade <= 0 || item.preco_unitario <= 0
    );

    if (itensInvalidos.length > 0) {
      toast.error('Preencha todos os campos dos itens corretamente (produto, quantidade e preço)');
      return;
    }

    // Validar se todos os produtos foram selecionados
    const produtosNaoSelecionados = itens.filter(item => !item.produto_id || item.produto_id === '');
    if (produtosNaoSelecionados.length > 0) {
      toast.error('Selecione um produto para todos os itens');
      return;
    }

    try {
      const vendaData = {
        cliente_id: data.cliente_id,
        desconto: Number(data.desconto) || 0,
        forma_pagamento: data.forma_pagamento,
        status: data.status || 'PENDENTE',
        itens: itens.map(item => ({
          produto_id: item.produto_id,
          quantidade: Number(item.quantidade),
          preco_unitario: Number(item.preco_unitario)
        }))
      };

      if (isEdit && vendaId) {
        await api.put(`/vendas/${vendaId}`, vendaData);
        toast.success('Venda atualizada com sucesso!');
      } else {
        await api.post('/vendas', vendaData);
        toast.success('Venda registrada com sucesso!');
      }
      onClose();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || (isEdit ? 'Erro ao atualizar venda' : 'Erro ao registrar venda');
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
                onClick={adicionarItem}
                className="text-primary hover:text-primary-dark text-sm font-semibold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Adicionar Item
              </button>
            </div>

            <div className="mb-3 p-3 bg-background-light rounded-lg border border-border-light">
              <p className="text-xs font-medium text-text-muted mb-2">Filtrar produtos por categoria</p>
              <div className="flex flex-wrap gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCategoriaIds.length === 0}
                    onChange={() => setSelectedCategoriaIds([])}
                    className="rounded border-border-light"
                  />
                  <span className="text-sm text-text-main">Todos</span>
                </label>
                {categorias.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCategoriaIds.includes(c.id)}
                      onChange={() => toggleCategoria(c.id)}
                      className="rounded border-border-light"
                    />
                    <span className="text-sm text-text-main">{c.nome}</span>
                  </label>
                ))}
              </div>
              <input
                type="text"
                value={searchNome}
                onChange={(e) => setSearchNome(e.target.value)}
                placeholder="Buscar por nome do produto"
                className="w-full px-3 py-2 text-sm border border-border-light rounded-lg outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {itens.length === 0 ? (
              <div className="text-center py-8 border border-border-light rounded-lg text-text-muted">
                Nenhum item adicionado
              </div>
            ) : (
              <div className="space-y-3">
                {itens.map((item, index) => (
                    <div
                      key={index}
                      className="flex gap-3 p-4 border border-border-light rounded-lg"
                    >
                      <div className="flex-1">
                        <select
                          value={item.produto_id}
                          onChange={(e) => atualizarItem(index, 'produto_id', e.target.value)}
                          className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary outline-none"
                        >
                          <option value="">Selecione o produto</option>
                          {produtos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome} - Estoque: {p.estoque_atual}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          value={item.quantidade}
                          onChange={(e) =>
                            atualizarItem(index, 'quantidade', parseInt(e.target.value) || 0)
                          }
                          min="1"
                          className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary outline-none"
                          placeholder="Qtd"
                        />
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          step="0.01"
                          value={item.preco_unitario}
                          onChange={(e) =>
                            atualizarItem(index, 'preco_unitario', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary outline-none"
                          placeholder="Preço"
                        />
                      </div>
                      <div className="w-24 text-right font-semibold text-text-main flex items-center">
                        {formatCurrency(item.preco_unitario * item.quantidade)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removerItem(index)}
                        className="text-error hover:bg-badge-erro p-2 rounded"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">
                Desconto (R$)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('desconto', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
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
              <span className="text-text-muted">Subtotal:</span>
              <span className="font-semibold text-text-main">
                {formatCurrency(
                  itens.reduce(
                    (acc, item) => acc + item.preco_unitario * item.quantidade,
                    0
                  )
                )}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-text-muted">Desconto:</span>
              <span className="font-semibold text-text-main">
                {formatCurrency(desconto)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border-light">
              <span className="text-lg font-bold text-text-main">Total:</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(calcularTotal())}
              </span>
            </div>
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
              {isEdit ? 'Salvar alterações' : 'Registrar Venda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

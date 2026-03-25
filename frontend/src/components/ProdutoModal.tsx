import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import SearchableSelect from './SearchableSelect';
import ModalPortal from './ModalPortal';
import { useBusinessAreas } from '../contexts/BusinessAreaContext';

const itemTypeSchema = z.enum(['product', 'service']);
const pricingTypeSchema = z.enum(['fixed', 'manual', 'percentage']).optional().nullable();
const percentageBaseSchema = z.enum(['over_parts_total', 'over_sale_total', 'over_previous_subtotal']).optional().nullable();

const produtoSchema = z.object({
  item_type: itemTypeSchema,
  nome: z.string().min(1, 'Nome é obrigatório'),
  preco: z.number().nonnegative('Preço não pode ser negativo'),
  custo: z.number().nonnegative('Custo não pode ser negativo'),
  estoque_atual: z.number().int().nonnegative().optional(),
  estoque_minimo: z.number().int().nonnegative().optional(),
  categoria_id: z.string().min(1, 'Categoria é obrigatória'),
  supplier_id: z.string().optional().or(z.literal('')),
  linha: z.string().max(100).optional().or(z.literal('')),
  business_area_id: z.string().optional().or(z.literal('')),
  pricing_type: pricingTypeSchema,
  percentage_value: z.number().min(0).max(100).optional().nullable(),
  percentage_base: percentageBaseSchema,
  observacao: z.string().max(2000).optional().or(z.literal(''))
}).refine((d) => d.item_type !== 'service' || d.pricing_type != null, { message: 'Selecione o tipo de precificação', path: ['pricing_type'] })
  .refine((d) => d.item_type !== 'service' || d.pricing_type !== 'percentage' || (d.percentage_value != null && d.percentage_base != null), { message: 'Percentual e base são obrigatórios para precificação percentual', path: ['percentage_value'] });

type ProdutoForm = z.infer<typeof produtoSchema>;

interface Categoria {
  id: string;
  nome: string;
  tipo?: string;
}

interface Supplier { id: string; name: string }

interface ProdutoModalProps {
  produto?: {
    id: string;
    nome: string;
    preco: number;
    custo: number;
    estoque_atual?: number;
    estoque_minimo?: number;
    categoria_id?: string;
    supplier_id?: string | null;
    linha?: string | null;
    item_type?: 'product' | 'service';
    business_area_id?: string | null;
    pricing_type?: string | null;
    percentage_value?: number | null;
    percentage_base?: string | null;
    observacao?: string | null;
  } | null;
  onClose: () => void;
  stockEnabled?: boolean;
  onVerHistoricoCompras?: () => void;
}

const PERCENTAGE_BASE_LABELS: Record<string, string> = {
  over_parts_total: 'Percentual sobre total de peças',
  over_sale_total: 'Percentual sobre valor total da venda/OS',
  over_previous_subtotal: 'Percentual sobre subtotal anterior'
};

export default function ProdutoModal({ produto, onClose, stockEnabled = true, onVerHistoricoCompras }: ProdutoModalProps) {
  const { areas: businessAreas, enabled: businessAreasEnabled, selectedAreaId } = useBusinessAreas();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [novaCategoriaOpen, setNovaCategoriaOpen] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [novaCategoriaTipo, setNovaCategoriaTipo] = useState<'produto' | 'servico'>('produto');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isService = (t: string) => t === 'service';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<ProdutoForm>({
    resolver: zodResolver(produtoSchema),
    defaultValues: {
      item_type: 'product',
      categoria_id: '',
      supplier_id: '',
      linha: '',
      business_area_id: '',
      pricing_type: null,
      percentage_value: null,
      percentage_base: null,
      observacao: ''
    }
  });

  const itemType = watch('item_type');
  const categoriaId = watch('categoria_id');
  const supplierId = watch('supplier_id');
  const pricingType = watch('pricing_type');
  const percentageValue = watch('percentage_value');
  const percentageBase = watch('percentage_base');

  const categoriaTipo = isService(itemType) ? 'servico' : 'produto';

  useEffect(() => {
    api.get<Supplier[]>('/fornecedores').then((r) => setSuppliers(r.data || [])).catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    const params = categoriaTipo === 'servico' ? '?tipo=servico' : '?tipo=produto';
    api.get<Categoria[]>(`/categorias${params}`).then((r) => setCategorias(r.data || [])).catch(() => setCategorias([]));
  }, [categoriaTipo]);

  useEffect(() => {
    if (produto) {
      reset({
        item_type: (produto.item_type as 'product' | 'service') ?? 'product',
        nome: produto.nome,
        preco: produto.preco,
        custo: produto.custo,
        estoque_atual: produto.estoque_atual ?? 0,
        estoque_minimo: produto.estoque_minimo ?? 0,
        categoria_id: produto.categoria_id ?? '',
        supplier_id: produto.supplier_id ?? '',
        linha: produto.linha ?? '',
        business_area_id: produto.business_area_id ?? '',
        pricing_type: (produto.pricing_type as 'fixed' | 'manual' | 'percentage') ?? null,
        percentage_value: produto.percentage_value ?? null,
        percentage_base: (produto.percentage_base as 'over_parts_total' | 'over_sale_total' | 'over_previous_subtotal' | null) ?? null,
        observacao: produto.observacao ?? ''
      });
    } else {
      reset({
        item_type: 'product',
        nome: '',
        preco: 0,
        custo: 0,
        estoque_atual: 0,
        estoque_minimo: 0,
        categoria_id: '',
        supplier_id: '',
        linha: '',
        business_area_id: selectedAreaId ?? '',
        pricing_type: null,
        percentage_value: null,
        percentage_base: null,
        observacao: ''
      });
    }
  }, [produto, reset, selectedAreaId]);

  useEffect(() => {
    if (!produto && categorias.length > 0 && !categoriaId) {
      setValue('categoria_id', categorias[0].id);
    }
  }, [produto, categorias, categoriaId, setValue]);

  useEffect(() => {
    if (isService(itemType)) {
      setValue('supplier_id', '');
      setValue('linha', '');
      setValue('estoque_atual', 0);
      setValue('estoque_minimo', 0);
      if (!pricingType) setValue('pricing_type', 'manual');
    }
  }, [itemType, setValue, pricingType]);

  const onSubmit = async (data: ProdutoForm) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        item_type: data.item_type,
        nome: data.nome.trim(),
        preco: data.preco,
        custo: data.custo,
        categoria_id: data.categoria_id,
        linha: data.linha?.trim() || null,
        supplier_id: data.supplier_id?.trim() || null,
        observacao: data.observacao?.trim() || null
      };
      if (businessAreasEnabled) {
        payload.business_area_id = data.business_area_id?.trim() || null;
      }
      if (data.item_type === 'product') {
        payload.estoque_atual = data.estoque_atual ?? 0;
        payload.estoque_minimo = data.estoque_minimo ?? 0;
      } else {
        payload.estoque_atual = 0;
        payload.estoque_minimo = 0;
        payload.pricing_type = data.pricing_type;
        payload.percentage_value = data.percentage_value ?? null;
        payload.percentage_base = data.percentage_base ?? null;
        if (data.pricing_type === 'percentage') payload.preco = 0;
      }
      if (produto) {
        await api.put(`/produtos/${produto.id}`, payload);
        toast.success(data.item_type === 'service' ? 'Serviço atualizado!' : 'Produto atualizado com sucesso!');
      } else {
        const idempotencyKey = crypto.randomUUID?.() ?? `produto-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await api.post('/produtos', payload, { headers: { 'Idempotency-Key': idempotencyKey } });
        toast.success(data.item_type === 'service' ? 'Serviço criado!' : 'Produto criado com sucesso!');
      }
      onClose();
    } catch (error: any) {
      setIsSubmitting(false);
      toast.error(error.response?.data?.error || 'Erro ao salvar');
    }
  };

  const criarCategoria = async () => {
    const nome = novaCategoriaNome.trim();
    if (!nome) {
      toast.error('Informe o nome da categoria');
      return;
    }
    try {
      const { data } = await api.post<Categoria & { tipo?: string }>('/categorias', { nome, tipo: novaCategoriaTipo });
      setCategorias((prev) => [...prev, { id: data.id, nome: data.nome, tipo: data.tipo }].sort((a, b) => a.nome.localeCompare(b.nome)));
      setValue('categoria_id', data.id);
      setNovaCategoriaNome('');
      setNovaCategoriaOpen(false);
      toast.success('Categoria criada');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao criar categoria');
    }
  };

  const isServiceForm = isService(itemType);

  return (
    <ModalPortal>
      <div className="aurix-modal-overlay fixed inset-0 flex items-center justify-center p-4 overflow-y-auto" style={{ backgroundColor: 'var(--color-overlay)' }}>
        <div className="bg-bg-elevated border border-border-soft rounded-2xl shadow-xl max-w-2xl w-full my-auto max-h-[90vh] overflow-y-auto">
          <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between shrink-0">
            <h2 className="text-lg sm:text-xl font-bold text-text-main">
              {produto ? (isServiceForm ? 'Editar Serviço' : 'Editar Produto') : (isServiceForm ? 'Novo Serviço' : 'Novo Produto')}
            </h2>
            <button type="button" onClick={onClose} className="p-2 -m-2 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-elevated min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation" aria-label="Fechar">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-4">
            {/* Tipo do item */}
            <div>
              <label className="block text-sm font-medium text-text-main mb-2">Tipo do item</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="product" {...register('item_type')} className="rounded-full border-border text-primary" />
                  <span>Produto</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="service" {...register('item_type')} className="rounded-full border-border text-primary" />
                  <span>Serviço</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-main mb-1">{isServiceForm ? 'Nome do serviço' : 'Nome'} *</label>
              <input type="text" {...register('nome')} className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-base min-h-[44px] touch-manipulation" />
              {errors.nome && <p className="text-error text-sm mt-1">{errors.nome.message}</p>}
            </div>

            <div>
              <SearchableSelect
                label={isServiceForm ? 'Categoria de serviço *' : 'Categoria *'}
                options={categorias.map((c) => ({ value: String(c.id), label: c.nome }))}
                value={categoriaId != null ? String(categoriaId) : ''}
                onChange={(v) => setValue('categoria_id', v)}
                placeholder="Pesquisar categoria..."
                addNewLabel="Criar nova categoria"
                onAddNew={() => { setNovaCategoriaTipo(categoriaTipo); setNovaCategoriaOpen(true); }}
                emptyMessage="Nenhuma categoria encontrada"
              />
              {errors.categoria_id && <p className="text-error text-sm mt-1">{errors.categoria_id.message}</p>}
            </div>

            {!isServiceForm && (
              <>
                <div>
                  <SearchableSelect
                    label="Fornecedor principal (opcional)"
                    options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
                    value={supplierId != null ? String(supplierId) : ''}
                    onChange={(v) => setValue('supplier_id', v)}
                    placeholder="Pesquisar fornecedor..."
                    allowClear
                    emptyMessage="Nenhum fornecedor encontrado"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Linha <span className="text-text-muted font-normal">(opcional)</span></label>
                  <input type="text" {...register('linha')} placeholder="Ex: Premium, Básico" className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-base min-h-[44px] touch-manipulation" maxLength={100} />
                </div>
              </>
            )}

            {isServiceForm && (
              <>
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Tipo de precificação *</label>
                  <select {...register('pricing_type')} className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-base min-h-[44px] bg-bg-main text-text-main">
                    <option value="">Selecione</option>
                    <option value="fixed">Fixo</option>
                    <option value="manual">Manual</option>
                    <option value="percentage">Percentual</option>
                  </select>
                  {errors.pricing_type && <p className="text-error text-sm mt-1">{errors.pricing_type.message}</p>}
                </div>
                {pricingType === 'fixed' && (
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Preço padrão *</label>
                    <input type="number" step="0.01" {...register('preco', { valueAsNumber: true })} className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-base min-h-[44px]" />
                    {errors.preco && <p className="text-error text-sm mt-1">{errors.preco.message}</p>}
                  </div>
                )}
                {pricingType === 'manual' && (
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Preço sugerido <span className="text-text-muted">(opcional)</span></label>
                    <input type="number" step="0.01" {...register('preco', { valueAsNumber: true })} placeholder="Valor definido na venda/OS" className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-base min-h-[44px]" />
                  </div>
                )}
                {pricingType === 'percentage' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-text-main mb-1">Percentual (%) *</label>
                        <input type="number" step="0.01" min={0} max={100} {...register('percentage_value', { valueAsNumber: true })} className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-base min-h-[44px]" />
                        {errors.percentage_value && <p className="text-error text-sm mt-1">{errors.percentage_value.message}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-main mb-1">Base do cálculo *</label>
                        <select {...register('percentage_base')} className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-base min-h-[44px] bg-bg-main text-text-main">
                          <option value="">Selecione</option>
                          {Object.entries(PERCENTAGE_BASE_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                        {errors.percentage_base && <p className="text-error text-sm mt-1">{errors.percentage_base.message}</p>}
                      </div>
                    </div>
                    {percentageValue != null && percentageBase && (
                      <p className="text-sm text-text-muted bg-bg-elevated px-3 py-2 rounded-lg">
                        Prévia: {percentageValue}% sobre {PERCENTAGE_BASE_LABELS[percentageBase]?.toLowerCase() ?? percentageBase}
                      </p>
                    )}
                  </>
                )}
                {pricingType && (
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Custo <span className="text-text-muted">(opcional)</span></label>
                    <input type="number" step="0.01" {...register('custo', { valueAsNumber: true })} className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-base min-h-[44px]" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Observação</label>
                  <textarea {...register('observacao')} rows={2} className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-base resize-none" placeholder="Opcional" maxLength={2000} />
                </div>
              </>
            )}

            {!isServiceForm && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Preço *</label>
                  <input type="number" step="0.01" {...register('preco', { valueAsNumber: true })} className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-base min-h-[44px] touch-manipulation" />
                  {errors.preco && <p className="text-error text-sm mt-1">{errors.preco.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Custo *</label>
                  <input type="number" step="0.01" {...register('custo', { valueAsNumber: true })} className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-base min-h-[44px] touch-manipulation" />
                  {errors.custo && <p className="text-error text-sm mt-1">{errors.custo.message}</p>}
                </div>
              </div>
            )}

            {businessAreasEnabled && businessAreas.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Área de negócio</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Nenhuma' },
                    ...(businessAreas?.map((a) => ({ value: a.id, label: a.name })) ?? [])
                  ]}
                  value={watch('business_area_id') ?? ''}
                  onChange={(v) => setValue('business_area_id', v)}
                  placeholder="Selecione a área"
                  emptyMessage="Nenhuma área"
                />
              </div>
            )}

            {!isServiceForm && stockEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Estoque Atual *</label>
                  <input type="number" {...register('estoque_atual', { valueAsNumber: true })} className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-base min-h-[44px] touch-manipulation" />
                  {errors.estoque_atual && <p className="text-error text-sm mt-1">{errors.estoque_atual.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Estoque Mínimo *</label>
                  <input type="number" {...register('estoque_minimo', { valueAsNumber: true })} className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-base min-h-[44px] touch-manipulation" />
                  {errors.estoque_minimo && <p className="text-error text-sm mt-1">{errors.estoque_minimo.message}</p>}
                </div>
              </div>
            )}

            {novaCategoriaOpen && (
              <div className="flex flex-col gap-2 p-3 bg-bg-elevated rounded-lg border border-border">
                <input type="text" value={novaCategoriaNome} onChange={(e) => setNovaCategoriaNome(e.target.value)} placeholder="Nome da nova categoria" className="flex-1 px-3 py-2 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary" autoFocus />
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={criarCategoria} className="px-3 py-2 bg-primary text-text-on-primary rounded-lg font-medium">Criar</button>
                  <button type="button" onClick={() => { setNovaCategoriaOpen(false); setNovaCategoriaNome(''); }} className="px-3 py-2 border border-border rounded-lg">Cancelar</button>
                </div>
              </div>
            )}

            {!isServiceForm && produto && onVerHistoricoCompras && (
              <div className="pt-2">
                <button type="button" onClick={onVerHistoricoCompras} className="text-sm text-primary hover:underline flex items-center gap-1">
                  <span className="material-symbols-outlined text-lg">history</span>
                  Ver histórico de compras deste produto
                </button>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="flex-1 px-4 py-3 border border-border rounded-lg text-text-main hover:bg-bg-elevated min-h-[44px] touch-manipulation disabled:opacity-50 disabled:pointer-events-none">Cancelar</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-3 rounded-lg min-h-[44px] touch-manipulation flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                {isSubmitting ? (<><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> Processando...</>) : produto ? 'Atualizar' : (isServiceForm ? 'Criar Serviço' : 'Criar Produto')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

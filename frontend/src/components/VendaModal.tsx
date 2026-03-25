import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/format';
import { usePersonalizacao } from '../contexts/PersonalizacaoContext';
import { useAuth } from '../contexts/AuthContext';
import SelecaoProdutosModal, { type ItemVenda } from './SelecaoProdutosModal';
import type { ClientExtraItem } from './ClienteExtraItemModal';
import SearchableSelect from './SearchableSelect';
import ModalPortal from './ModalPortal';
import { useBusinessAreas } from '../contexts/BusinessAreaContext';

const CLIENTE_DEBOUNCE_MS = 300;
const CLIENTES_PAGE_SIZE = 20;

const vendaSchema = z.object({
  cliente_id: z.string().min(1, 'Cliente é obrigatório'),
  desconto_percentual: z
    .number()
    .min(-100, 'Use entre -100% (acréscimo) e 100% (desconto)')
    .max(100, 'Use entre -100% e 100%')
    .default(0),
  forma_pagamento: z.string().optional(),
  status: z.enum(['PAGO', 'PENDENTE', 'PARCIAL']).default('PENDENTE')
});

type VendaForm = z.infer<typeof vendaSchema>;

function subtotalItem(item: ItemVenda): number {
  return Math.round(item.preco_unitario * item.quantidade * 100) / 100;
}

function resolveServicoValorUnitario(s: ItemServicoOs, _idx: number, servicos: ItemServicoOs[], subtotalPecas: number): number {
  if (!s.is_percentage || s.percentage_value == null || !s.percentage_base) return s.valor_unitario;
  let base = 0;
  if (s.percentage_base === 'over_parts_total' || s.percentage_base === 'over_previous_subtotal') base = subtotalPecas;
  else if (s.percentage_base === 'over_sale_total') {
    const subNaoPct = servicos.filter((x) => !x.is_percentage).reduce((a, x) => a + x.valor_unitario * x.quantidade, 0);
    base = subtotalPecas + subNaoPct;
  }
  const total = (base * s.percentage_value) / 100;
  const qty = s.quantidade || 1;
  return qty > 0 ? Math.round((total / qty) * 100) / 100 : 0;
}

interface Cliente {
  id: string;
  nome: string;
  cpf?: string | null;
  telefone?: string | null;
}

export interface ItemServicoOs {
  produto_id?: string | null;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  /** Serviço percentual: valor calculado na submissão */
  is_percentage?: boolean;
  percentage_value?: number;
  percentage_base?: string;
}

interface VendaParaEdicao {
  id: string;
  tipo?: 'sale' | 'quote' | 'service_order';
  cliente_id?: string;
  cliente?: { nome: string; cpf?: string | null; telefone?: string | null };
  business_area_id?: string | null;
  business_area?: { id: string; name: string; color: string | null } | null;
  client_extra_item_id?: string | null;
  client_extra_item?: { id: string; title: string; type: string } | null;
  desconto: number;
  forma_pagamento?: string | null;
  status: 'PAGO' | 'PENDENTE' | 'PARCIAL' | 'FECHADA' | 'ORCAMENTO' | 'CANCELADO';
  problema_relatado?: string | null;
  observacoes_tecnicas?: string | null;
  texto_garantia?: string | null;
  os_agradecimento?: string | null;
  os_status?: string | null;
  itens: Array<{
    produto_id: string;
    quantidade: number;
    preco_unitario: number;
    produto?: { nome: string; preco?: number; estoque_atual?: number };
  }>;
  servicos?: Array<{ descricao: string; quantidade: number; valor_unitario: number }>;
}

type PaymentTipo = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'fiado';
type PaymentDraft = {
  id?: string;
  tipo_pagamento: PaymentTipo;
  valor: number;
  parcelas: number | null;
  data_pagamento: string; // ISO
  __autoSecond?: boolean;
};

function tipoPagamentoToFormaPag(t: PaymentTipo): string {
  switch (t) {
    case 'dinheiro':
      return 'Dinheiro';
    case 'pix':
      return 'Pix';
    case 'debito':
      return 'Cartão de Débito';
    case 'credito':
      return 'Cartão de Crédito';
    case 'fiado':
      return 'Fiado';
    default:
      return 'A definir';
  }
}

/** Calcula percentual de desconto/acréscimo a partir do valor em R$ e do subtotal (aceita negativo = acréscimo). */
function descontoPercentualFromValor(descontoValor: number, subtotal: number): number {
  if (subtotal <= 0) return 0;
  return Math.min(100, Math.max(-100, (descontoValor / subtotal) * 100));
}

interface AgendamentoInfo {
  data: string;
  hora_inicio: string;
  observacao?: string | null;
}

interface VendaModalProps {
  onClose: () => void;
  vendaId?: string;
  venda?: VendaParaEdicao | null;
  initialClienteId?: string;
  initialAgendamentoId?: string;
}

export default function VendaModal({ onClose, vendaId, venda, initialClienteId, initialAgendamentoId }: VendaModalProps) {
  const isEdit = Boolean(vendaId && venda);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID?.() ?? `venda-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSelecaoProdutos, setShowSelecaoProdutos] = useState(false);

  const { getModuleConfig } = usePersonalizacao();
  const clientesConfig = getModuleConfig('clientes');
  const vendasConfig = getModuleConfig('vendas');
  const permitirOrcamentos = vendasConfig.permitir_orcamentos ?? false;
  const permitirOrdemServico = vendasConfig.permitir_ordem_servico ?? false;
  const showDadosAdicionaisVenda = (clientesConfig.mostrar_dados_adicionais_venda ?? false) && (clientesConfig.ativar_dados_adicionais ?? false);
  const showDadosAdicionaisOrcamento = (clientesConfig.mostrar_dados_adicionais_orcamento ?? false) && (clientesConfig.ativar_dados_adicionais ?? false);
  const showDadosAdicionaisOs = (clientesConfig.mostrar_dados_adicionais_venda ?? false) && (clientesConfig.ativar_dados_adicionais ?? false);

  const [tipoRegistro, setTipoRegistro] = useState<'sale' | 'quote' | 'service_order'>('sale');
  const [servicos, setServicos] = useState<ItemServicoOs[]>([]);
  const [servicosCadastrados, setServicosCadastrados] = useState<{ id: string; nome: string; preco: number; pricing_type?: string; percentage_value?: number; percentage_base?: string }[]>([]);
  const [servicoSelecionadoId, setServicoSelecionadoId] = useState<string>('');
  const [problemaRelatado, setProblemaRelatado] = useState('');
  const [observacoesTecnicas, setObservacoesTecnicas] = useState('');
  const [textoGarantia, setTextoGarantia] = useState('');
  const [osAgradecimento, setOsAgradecimento] = useState('');
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteDebounced, setClienteDebounced] = useState('');
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);
  const [clienteOptions, setClienteOptions] = useState<Cliente[]>([]);
  const [clienteOptionsLoading, setClienteOptionsLoading] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clientExtraItems, setClientExtraItems] = useState<ClientExtraItem[]>([]);
  const [selectedExtraItemId, setSelectedExtraItemId] = useState<string | null>(null);
  const [agendamentoInfo, setAgendamentoInfo] = useState<AgendamentoInfo | null>(null);
  const [observacaoSugerida, setObservacaoSugerida] = useState<string>('');
  const [businessAreaId, setBusinessAreaId] = useState<string | null>(null);
  const [anexosVenda, setAnexosVenda] = useState<{ id: string; nome_original: string; mime_type?: string | null; tamanho?: number | null }[]>([]);
  const [loadingAnexos, setLoadingAnexos] = useState(false);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const [pagamentos, setPagamentos] = useState<PaymentDraft[]>([]);
  const [loadingPagamentos, setLoadingPagamentos] = useState(false);
  const [pagamentosErro, setPagamentosErro] = useState<string | null>(null);
  const inputAnexoRef = useRef<HTMLInputElement>(null);

  const { areas: businessAreas, selectedAreaId, enabled: businessAreasEnabled } = useBusinessAreas();
  const { user } = useAuth();

  const [itensErro, setItensErro] = useState<string | null>(null);
  const [servicosErro, setServicosErro] = useState<string | null>(null);

  useEffect(() => {
    if (!businessAreasEnabled) {
      setBusinessAreaId(null);
      return;
    }
    if (!vendaId && !venda) setBusinessAreaId(selectedAreaId);
  }, [vendaId, venda, selectedAreaId, businessAreasEnabled]);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    setError,
    clearErrors,
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
  }, [initialClienteId, initialAgendamentoId]);

  useEffect(() => {
    if (!vendaId) {
      setAnexosVenda([]);
      return;
    }
    let cancelled = false;
    setLoadingAnexos(true);
    api.get<{ id: string; nome_original: string; mime_type?: string | null; tamanho?: number | null }[]>(`/vendas/${vendaId}/anexos`)
      .then((res) => { if (!cancelled) setAnexosVenda(res.data ?? []); })
      .catch(() => { if (!cancelled) setAnexosVenda([]); })
      .finally(() => { if (!cancelled) setLoadingAnexos(false); });
    return () => { cancelled = true; };
  }, [vendaId]);

  useEffect(() => {
    if (!vendaId || !venda || venda.tipo !== 'sale') {
      setPagamentos([]);
      setPagamentosErro(null);
      return;
    }

    let cancelled = false;
    setLoadingPagamentos(true);
    api
      .get<
        Array<{
          id: string;
          tipo_pagamento: PaymentTipo;
          valor: number;
          parcelas: number | null;
          data_pagamento: string;
        }>
      >(`/vendas/${vendaId}/pagamentos`)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setPagamentos(
          list.map((p) => ({
            id: p.id,
            tipo_pagamento: p.tipo_pagamento,
            valor: Number(p.valor),
            parcelas: p.parcelas ?? null,
            data_pagamento: p.data_pagamento,
            __autoSecond: false
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setPagamentos([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPagamentos(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vendaId, venda]);

  useEffect(() => {
    if (!loading && venda) {
      const itensIniciais: ItemVenda[] = (venda.itens ?? []).map((i) => ({
        produto_id: i.produto_id,
        nome: i.produto?.nome ?? '',
        preco_unitario: Number(i.preco_unitario),
        quantidade: i.quantidade,
        preco_cadastrado: i.produto?.preco != null ? Number(i.produto.preco) : undefined,
        estoque_atual: i.produto?.estoque_atual,
        sku: (i.produto as { sku?: string })?.sku
      }));
      const servicosIniciais: ItemServicoOs[] = (venda as VendaParaEdicao & { servicos?: ItemServicoOs[] }).servicos?.map((s) => ({
        produto_id: (s as any).produto_id ?? null,
        descricao: s.descricao,
        quantidade: s.quantidade,
        valor_unitario: Number(s.valor_unitario)
      })) ?? [];

      const subtotalPecas = itensIniciais.reduce((acc, i) => acc + subtotalItem(i), 0);
      const subtotalServicos = servicosIniciais.reduce((acc, s) => acc + Number(s.valor_unitario) * Number(s.quantidade), 0);
      const subtotalGeral = subtotalPecas + subtotalServicos;

      const percentual = descontoPercentualFromValor(Number(venda.desconto) || 0, subtotalGeral);
      const statusForForm =
        venda.status === 'FECHADA' || venda.status === 'ORCAMENTO' || venda.status === 'CANCELADO'
          ? 'PAGO'
          : venda.status === 'PAGO' || venda.status === 'PENDENTE' || venda.status === 'PARCIAL'
            ? venda.status
            : 'PENDENTE';
      reset({
        cliente_id: venda.cliente_id ?? '',
        desconto_percentual: Math.round(percentual * 100) / 100,
        forma_pagamento: venda.forma_pagamento ?? '',
        status: statusForForm
      });
      setItens(itensIniciais);
      setServicos(servicosIniciais);
      if (venda.cliente_id && venda.cliente?.nome) {
        setSelectedCliente({ id: venda.cliente_id, nome: venda.cliente.nome, telefone: null });
        setClienteSearch('');
      }
      if (venda.client_extra_item_id) setSelectedExtraItemId(venda.client_extra_item_id);
      else setSelectedExtraItemId(null);
      setBusinessAreaId(venda.business_area_id ?? venda.business_area?.id ?? null);
      setTipoRegistro((venda.tipo === 'quote' ? 'quote' : venda.tipo === 'service_order' ? 'service_order' : 'sale') as 'sale' | 'quote' | 'service_order');
      setProblemaRelatado((venda as VendaParaEdicao).problema_relatado ?? '');
      setObservacoesTecnicas((venda as VendaParaEdicao).observacoes_tecnicas ?? '');
      setTextoGarantia((venda as VendaParaEdicao).texto_garantia ?? '');
      setOsAgradecimento((venda as VendaParaEdicao).os_agradecimento ?? '');
    }
  }, [loading, venda, reset]);

  const loadData = async () => {
    setLoading(true);
    try {
      let telefoneFromAgendamento: string | undefined;
      if (initialAgendamentoId) {
        const res = await api.get<{
          data?: string | Date;
          hora_inicio?: string;
          observacao?: string | null;
          telefone_cliente?: string;
        }>(`/agendamentos/${initialAgendamentoId}`);
        const a = res.data;
        const dataStr = a?.data
          ? typeof a.data === 'string'
            ? a.data.slice(0, 10)
            : new Date(a.data).toISOString().slice(0, 10)
          : '';
        if (dataStr && a?.hora_inicio) {
          setAgendamentoInfo({
            data: dataStr,
            hora_inicio: a.hora_inicio,
            observacao: a?.observacao ?? null
          });
        }
        if (a?.observacao?.trim()) setObservacaoSugerida(String(a?.observacao ?? '').trim());
        const telDigits = a?.telefone_cliente?.replace(/\D/g, '');
        if (telDigits && telDigits.length >= 10) {
          telefoneFromAgendamento = telDigits;
        }
      }
      if (initialClienteId && !vendaId) {
        const res = await api.get<Cliente>(`/clientes/${initialClienteId}`);
        const c = res.data;
        if (c?.id && c?.nome) {
          setSelectedCliente({ id: c.id, nome: c.nome, telefone: c.telefone ?? null });
          setValue('cliente_id', c.id);
        }
      } else if (telefoneFromAgendamento && !vendaId) {
        const res = await api.get<{ data: Cliente[] }>('/clientes', {
          params: { search: telefoneFromAgendamento, limit: 5 }
        });
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        const match = list.find(
          (c) => c.telefone && c.telefone.replace(/\D/g, '') === telefoneFromAgendamento
        );
        if (match?.id && match?.nome) {
          setSelectedCliente({ id: match.id, nome: match.nome, telefone: match.telefone ?? null });
          setValue('cliente_id', match.id);
        }
      }
    } catch (error) {
      if (initialAgendamentoId || initialClienteId) {
        toast.error('Erro ao carregar dados do agendamento ou cliente');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setClienteDebounced(clienteSearch.trim()), CLIENTE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [clienteSearch]);

  const fetchClienteOptions = useCallback(async (search: string) => {
    setClienteOptionsLoading(true);
    try {
      const params: Record<string, string | number> = { limit: CLIENTES_PAGE_SIZE };
      if (search) params.search = search;
      const res = await api.get<{ data: Cliente[] }>('/clientes', { params });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setClienteOptions(list);
    } catch {
      setClienteOptions([]);
    } finally {
      setClienteOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!clienteDropdownOpen) return;
    fetchClienteOptions(clienteDebounced);
  }, [clienteDropdownOpen, clienteDebounced, fetchClienteOptions]);

  useEffect(() => {
    api
      .get<{ id: string; nome: string; preco: number; pricing_type?: string; percentage_value?: number; percentage_base?: string }[]>('/produtos', {
        params: { item_type: 'service', filtro: 'todos', periodo: 'este_mes' }
      })
      .then((r) => {
        const data = r.data;
        setServicosCadastrados(Array.isArray(data) ? data : []);
      })
      .catch(() => setServicosCadastrados([]));
  }, []);

  const adicionarServicoCadastrado = () => {
    if (!servicoSelecionadoId) return;
    const s = servicosCadastrados.find((x) => x.id === servicoSelecionadoId);
    if (!s) return;
    const isPct = s.pricing_type === 'percentage';
    setServicos((prev) => [
      ...prev,
      {
        produto_id: s.id,
        descricao: s.nome,
        quantidade: 1,
        valor_unitario: isPct ? 0 : Number(s.preco),
        ...(isPct && { is_percentage: true, percentage_value: s.percentage_value ?? 0, percentage_base: s.percentage_base ?? undefined })
      }
    ]);
    setServicoSelecionadoId('');
  };

  useEffect(() => {
    const forQuote = tipoRegistro === 'quote' && showDadosAdicionaisOrcamento;
    const forSale = tipoRegistro === 'sale' && showDadosAdicionaisVenda;
    if (!selectedCliente?.id || (!forQuote && !forSale)) {
      setClientExtraItems([]);
      setSelectedExtraItemId(null);
      return;
    }
    api
      .get<ClientExtraItem[]>(`/clientes/${selectedCliente.id}/extra-items`)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        if (tipoRegistro === 'quote') {
          setClientExtraItems(list.filter((it) => it.show_on_quote && !it.internal_only));
        } else {
          setClientExtraItems(list.filter((it) => it.show_on_sale && !it.internal_only));
        }
      })
      .catch(() => setClientExtraItems([]));
  }, [selectedCliente?.id, tipoRegistro, showDadosAdicionaisVenda, showDadosAdicionaisOrcamento]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setClienteDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCliente = (c: Cliente) => {
    setSelectedCliente(c);
    setValue('cliente_id', c.id);
    setClienteSearch('');
    setClienteDropdownOpen(false);
    setSelectedExtraItemId(null);
    setClientExtraItems([]);
  };

  const handleClienteInputFocus = () => {
    setClienteDropdownOpen(true);
    if (selectedCliente) {
      setClienteSearch('');
      setSelectedCliente(null);
      setValue('cliente_id', '');
    }
  };

  const handleClienteInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClienteSearch(e.target.value);
    setClienteDropdownOpen(true);
    if (selectedCliente) {
      setSelectedCliente(null);
      setValue('cliente_id', '');
    }
  };

  const handleClienteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setClienteDropdownOpen(false);
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'Enter' && clienteOptions.length > 0 && !selectedCliente) {
      e.preventDefault();
      handleSelectCliente(clienteOptions[0]);
    }
  };

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (itensErro) setItensErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens.length]);

  useEffect(() => {
    if (servicosErro) setServicosErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicos.length]);

  const atualizarItemVenda = (index: number, valor: number) => {
    const novosItens = [...itens];
    novosItens[index] = { ...novosItens[index], quantidade: Math.max(1, Math.floor(valor)) };
    setItens(novosItens);
  };

  const atualizarPrecoUnitario = (index: number, valor: number) => {
    const v = Math.max(0, Math.round(valor * 100) / 100);
    const novosItens = [...itens];
    novosItens[index] = { ...novosItens[index], preco_unitario: v };
    setItens(novosItens);
  };

  const isQuote = tipoRegistro === 'quote';
  const isOs = tipoRegistro === 'service_order';
  const subtotalItens = Math.round(itens.reduce((acc, item) => acc + item.preco_unitario * item.quantidade, 0) * 100) / 100;
  const subtotalServicos = servicos.length === 0 ? 0 : Math.round(servicos.reduce((acc, s, idx) => acc + s.quantidade * resolveServicoValorUnitario(s, idx, servicos, subtotalItens), 0) * 100) / 100;
  const subtotalGeral = subtotalItens + subtotalServicos;
  const descontoPct = Math.max(-100, Math.min(100, Number(descontoPercentual) ?? 0));
  const valorDesconto = Math.round(subtotalGeral * (descontoPct / 100) * 100) / 100;
  const totalFinal = Math.round((subtotalGeral - valorDesconto) * 100) / 100;

  const totalPago = Math.round(pagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0) * 100) / 100;
  const restante = Math.round((totalFinal - totalPago) * 100) / 100;
  const statusCalculadoVenda: 'PENDENTE' | 'PARCIAL' | 'PAGO' =
    totalPago <= 0 ? 'PENDENTE' : totalPago + 0.0001 < totalFinal ? 'PARCIAL' : 'PAGO';
  const pagamentosExcedemTotal = totalPago - totalFinal > 0.0001;

  useEffect(() => {
    if (isQuote || isOs) return;
    const p0 = pagamentos[0];
    if (!p0) return;

    const rem = Math.round((totalFinal - p0.valor) * 100) / 100;

    if (pagamentos.length === 1) {
      return;
    }

    if (pagamentos.length === 2 && pagamentos[1]?.__autoSecond) {
      setPagamentos((prev) => {
        if (prev.length !== 2) return prev;
        const p1 = prev[1];
        if (!p1.__autoSecond) return prev;
        if (rem <= 0.0001) return [prev[0]];
        if (Math.abs(Number(p1.valor) - rem) <= 0.0001) return prev;
        return [prev[0], { ...p1, valor: rem }];
      });
    }
  }, [totalFinal, pagamentos.length, pagamentos[0]?.valor, pagamentos[0]?.tipo_pagamento, pagamentos[0]?.parcelas, pagamentos[1]?.__autoSecond, isQuote, isOs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        setShowSelecaoProdutos(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isSubmitting && (isOs ? itens.length > 0 || servicos.length > 0 : itens.length > 0)) {
          formRef.current?.requestSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSubmitting, isOs, itens.length, servicos.length]);

  const onSubmit = async (data: VendaForm) => {
    if (isSubmitting) return;
    if (!data.cliente_id || data.cliente_id === '') {
      setError('cliente_id', { type: 'manual', message: 'Selecione um cliente' });
      return;
    }
    if (!isQuote && !isOs && pagamentosExcedemTotal) {
      setPagamentosErro('A soma dos pagamentos excede o total da venda.');
      return;
    }
    if (isOs) {
      if (itens.length === 0 && servicos.length === 0) {
        setItensErro('Adicione pelo menos uma peça ou um serviço');
        setServicosErro('Adicione pelo menos uma peça ou um serviço');
        return;
      }
      const servicosInvalidos = servicos.filter((s) => !s.descricao?.trim() || s.quantidade <= 0 || s.valor_unitario < 0);
      if (servicosInvalidos.length > 0) {
        setServicosErro('Revise os serviços (descrição, quantidade e valor)');
        return;
      }
    } else if (itens.length === 0) {
      // Venda direta pode ter apenas serviços (sem produtos).
      if (servicos.length === 0) {
        setItensErro(isQuote ? 'Adicione pelo menos um produto ao orçamento' : 'Adicione pelo menos um produto à venda');
        return;
      }
    }
    const itensInvalidos = itens.filter(
      (item) => !item.produto_id || item.quantidade <= 0 || item.preco_unitario <= 0
    );
    if (itensInvalidos.length > 0) {
      setItensErro('Revise os itens (quantidade e preço devem ser positivos)');
      return;
    }

    setIsSubmitting(true);
    clearErrors(['cliente_id', 'forma_pagamento']);

    const isSaleDirect = !isQuote && !isOs;
    const pagamentosPayload = isSaleDirect
      ? pagamentos.map((p) => ({
          tipo_pagamento: p.tipo_pagamento,
          valor: Math.round((Number(p.valor) || 0) * 100) / 100,
          parcelas: p.tipo_pagamento === 'credito' ? p.parcelas : null,
          data_pagamento: p.data_pagamento
        }))
      : [];
    const statusPayloadVenda: 'PENDENTE' | 'PAGO' | 'PARCIAL' =
      isEdit && venda?.status && (venda.status === 'PAGO' || venda.status === 'PENDENTE' || venda.status === 'PARCIAL') ? venda.status : 'PENDENTE';
    const formaPagamentoPayloadVenda =
      isSaleDirect
        ? pagamentos.length === 1
          ? tipoPagamentoToFormaPag(pagamentos[0].tipo_pagamento)
          : pagamentos.length > 1
            ? 'Múltiplos'
            : 'A definir'
        : '';

    const payloadItens = itens.map((item) => ({
      produto_id: item.produto_id,
      quantidade: Number(item.quantidade),
      preco_unitario: Math.round(Number(item.preco_unitario) * 100) / 100
    }));

    const subtotalPeças = itens.reduce((acc, i) => acc + Number(i.preco_unitario) * Number(i.quantidade), 0);
    const servicosResolvidos = servicos.map((s) => {
      if (s.is_percentage && s.percentage_value != null && s.percentage_base) {
        let base = 0;
        if (s.percentage_base === 'over_parts_total' || s.percentage_base === 'over_previous_subtotal') {
          base = subtotalPeças;
        } else if (s.percentage_base === 'over_sale_total') {
          const subtotalServicosNaoPct = servicos.filter((x) => !x.is_percentage).reduce((a, x) => a + Number(x.valor_unitario) * Number(x.quantidade), 0);
          base = subtotalPeças + subtotalServicosNaoPct;
        }
        const totalServico = (base * s.percentage_value) / 100;
        const valorUnitario = (Number(s.quantidade) || 1) > 0 ? totalServico / (Number(s.quantidade) || 1) : 0;
        return { ...s, valor_unitario: Math.round(valorUnitario * 100) / 100 };
      }
      return s;
    });

    const payloadServicos = servicosResolvidos.map((s) => ({
      produto_id: s.produto_id || null,
      descricao: s.descricao.trim(),
      quantidade: Number(s.quantidade) || 1,
      valor_unitario: Math.round(Number(s.valor_unitario) * 100) / 100
    }));

    if (isEdit && vendaId) {
      try {
        const vendaData: Record<string, unknown> = {
          cliente_id: data.cliente_id,
          desconto_percentual: Math.min(100, Math.max(-100, Number(data.desconto_percentual) ?? 0)),
          status: isQuote ? 'ORCAMENTO' : (data.status || 'PENDENTE'),
          itens: payloadItens
        };
        if (isOs) {
          vendaData.servicos = payloadServicos;
          vendaData.problema_relatado = problemaRelatado.trim() || null;
          vendaData.observacoes_tecnicas = observacoesTecnicas.trim() || null;
          vendaData.texto_garantia = textoGarantia.trim() || null;
          vendaData.os_agradecimento = osAgradecimento.trim() || null;
          vendaData.forma_pagamento = (data.forma_pagamento?.trim() || null) as string | null;
        } else {
          if (payloadServicos.length > 0) vendaData.servicos = payloadServicos;
          if (!isQuote) vendaData.forma_pagamento = data.forma_pagamento ?? '';
          else vendaData.forma_pagamento = null;
        }
        if (showDadosAdicionaisVenda || showDadosAdicionaisOrcamento || showDadosAdicionaisOs) vendaData.client_extra_item_id = selectedExtraItemId || null;

        if (!isQuote && !isOs) {
          // Mantém o “status” do cabeçalho compatível no momento da edição.
          // O status final (PENDENTE/PARCIAL/PAGO) e o financeiro são sincronizados no endpoint de pagamentos.
          vendaData.status = statusPayloadVenda;
          vendaData.forma_pagamento = formaPagamentoPayloadVenda;
        }
        await api.put(`/vendas/${vendaId}`, vendaData);

        if (!isQuote && !isOs) {
          await api.put(`/vendas/${vendaId}/pagamentos`, { payments: pagamentosPayload });
        }
        toast.success(isOs ? 'Ordem de serviço atualizada!' : isQuote ? 'Orçamento atualizado!' : 'Venda atualizada com sucesso!');
        onClose();
      } catch (error: any) {
        setIsSubmitting(false);
        const errorMessage = error.response?.data?.error || error.message || 'Erro ao atualizar';
        toast.error(errorMessage);
      }
      return;
    }

    const vendaData: Record<string, unknown> = {
      tipo: tipoRegistro,
      cliente_id: data.cliente_id,
      desconto_percentual: Math.min(100, Math.max(-100, Number(data.desconto_percentual) ?? 0)),
      status: isQuote ? 'ORCAMENTO' : (data.status || 'PENDENTE'),
      itens: payloadItens
    };
    if (isOs) {
      vendaData.servicos = payloadServicos;
      vendaData.problema_relatado = problemaRelatado.trim() || null;
      vendaData.observacoes_tecnicas = observacoesTecnicas.trim() || null;
      vendaData.texto_garantia = textoGarantia.trim() || null;
      vendaData.os_agradecimento = osAgradecimento.trim() || null;
      vendaData.forma_pagamento = (data.forma_pagamento?.trim() || null) as string | null;
    } else {
      if (payloadServicos.length > 0) vendaData.servicos = payloadServicos;
      if (!isQuote) vendaData.forma_pagamento = data.forma_pagamento ?? '';
      else vendaData.forma_pagamento = null;
    }
    if (initialAgendamentoId) vendaData.agendamento_id = initialAgendamentoId;
    if (showDadosAdicionaisVenda || showDadosAdicionaisOrcamento || showDadosAdicionaisOs) vendaData.client_extra_item_id = selectedExtraItemId || null;
    vendaData.business_area_id = businessAreaId || null;

    if (!isQuote && !isOs) {
      vendaData.status = statusPayloadVenda;
      vendaData.forma_pagamento = formaPagamentoPayloadVenda;
    }

    try {
      const created = await api.post('/vendas', vendaData, {
        headers: { 'Idempotency-Key': idempotencyKeyRef.current }
      });

      if (!isQuote && !isOs) {
        const createdId = (created.data as any)?.id;
        if (createdId) {
          await api.put(`/vendas/${createdId}/pagamentos`, { payments: pagamentosPayload });
        }
      }
      toast.success(isOs ? 'Ordem de serviço salva!' : isQuote ? 'Orçamento salvo!' : 'Venda registrada com sucesso!');
      onClose();
    } catch (error: any) {
      setIsSubmitting(false);
      const errorMessage = error.response?.data?.error || error.message || 'Erro ao registrar venda';
      toast.error(errorMessage);
    }
  };

  if (loading) {
    return (
      <ModalPortal>
        <div className="aurix-modal-overlay fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'var(--color-overlay)' }}>
          <div className="bg-bg-elevated border border-border-soft rounded-2xl p-8">
            <p>Carregando...</p>
          </div>
        </div>
      </ModalPortal>
    );
  }

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm z-50"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      >
        <div className="bg-bg-elevated border border-border-soft rounded-2xl shadow-2xl w-full max-w-[1280px] max-h-[92vh] overflow-hidden flex flex-col my-4">
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-border shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-text-main">
                  {isEdit ? (venda?.tipo === 'quote' ? 'Editar Orçamento' : venda?.tipo === 'service_order' ? 'Editar Ordem de Serviço' : 'Editar Venda') : 'Nova Venda'}
                </h2>
                <p className="text-sm text-text-muted mt-1">
                  Gerencie vendas, orçamentos e ordens de serviço em um só lugar.
                </p>
                {agendamentoInfo && (
                  <p className="text-sm text-primary mt-1">
                    Venda vinculada ao agendamento: {agendamentoInfo.data.split('-').reverse().join('/')} às {agendamentoInfo.hora_inicio}
                  </p>
                )}
                {observacaoSugerida && (
                  <p className="text-sm text-text-muted mt-0.5">Observação do agendamento: {observacaoSugerida}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 -m-2 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-card min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation transition-colors"
                aria-label="Fechar"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Tabs */}
            {(permitirOrcamentos || permitirOrdemServico) && !isEdit && (
              <nav className="flex gap-0 mt-4 border-b border-border -mb-px" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tipoRegistro === 'sale'}
                  onClick={() => setTipoRegistro('sale')}
                  className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                    tipoRegistro === 'sale'
                      ? 'border-primary text-primary font-bold'
                      : 'border-transparent text-text-muted hover:text-text-main'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">shopping_cart</span>
                  Venda Direta
                </button>
                {permitirOrcamentos && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tipoRegistro === 'quote'}
                    onClick={() => setTipoRegistro('quote')}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                      tipoRegistro === 'quote'
                        ? 'border-primary text-primary font-bold'
                        : 'border-transparent text-text-muted hover:text-text-main'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">description</span>
                    Orçamento
                  </button>
                )}
                {permitirOrdemServico && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tipoRegistro === 'service_order'}
                    onClick={() => setTipoRegistro('service_order')}
                    className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                      tipoRegistro === 'service_order'
                        ? 'border-primary text-primary font-bold'
                        : 'border-transparent text-text-muted hover:text-text-main'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">build</span>
                    Ordem de Serviço
                  </button>
                )}
              </nav>
            )}
            {permitirOrcamentos && tipoRegistro === 'quote' && (
              <p className="text-sm text-primary mt-3 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                Este registro será salvo como orçamento e poderá ser convertido em venda depois.
              </p>
            )}
            {permitirOrdemServico && tipoRegistro === 'service_order' && (
              <p className="text-sm text-primary mt-3 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                Este registro será salvo como ordem de serviço. Você poderá gerar o PDF e converter em venda depois.
              </p>
            )}
          </div>

          <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 flex-1 min-h-0 overflow-hidden">
              {/* Coluna esquerda - scroll */}
              <div className="lg:col-span-2 overflow-y-auto p-4 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div ref={comboboxRef} className="relative sm:col-span-2 lg:col-span-1">
              <label htmlFor="venda-cliente" className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                Cliente *
              </label>
              <input
                id="venda-cliente"
                type="text"
                value={selectedCliente ? selectedCliente.nome : clienteSearch}
                onChange={handleClienteInputChange}
                onFocus={handleClienteInputFocus}
                onKeyDown={handleClienteKeyDown}
                placeholder="Pesquisar cliente por nome ou CPF..."
                autoComplete="off"
                className={`w-full pl-4 pr-10 py-3 border rounded-lg bg-bg-main text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 min-h-[44px] touch-manipulation transition-shadow ${
                  errors.cliente_id ? 'border-error focus:ring-error/20' : 'border-border focus:ring-primary/20'
                }`}
                aria-label="Buscar cliente"
                aria-expanded={clienteDropdownOpen}
                aria-haspopup="listbox"
                aria-autocomplete="list"
              />
            {selectedCliente && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCliente(null);
                  setValue('cliente_id', '');
                  setClienteSearch('');
                  setClienteDropdownOpen(true);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-muted hover:bg-bg-card hover:text-text-main"
                aria-label="Limpar cliente"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            )}
            {clienteDropdownOpen && (
              <ul
                role="listbox"
                className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-bg-elevated shadow-lg py-1"
              >
                {clienteOptionsLoading ? (
                  <li className="px-4 py-3 text-sm text-text-muted">Buscando...</li>
                ) : clienteOptions.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-text-muted">
                    {clienteDebounced ? 'Nenhum cliente encontrado' : 'Digite para buscar'}
                  </li>
                ) : (
                  clienteOptions.map((c) => (
                    <li
                      key={c.id}
                      role="option"
                      tabIndex={-1}
                      onClick={() => handleSelectCliente(c)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectCliente(c);
                        }
                      }}
                      className="px-4 py-2.5 cursor-pointer hover:bg-bg-card focus:bg-bg-card focus:outline-none border-b border-border last:border-b-0"
                    >
                      <span className="block font-medium text-text-main">{c.nome}</span>
                      {c.telefone && (
                        <span className="block text-xs text-text-muted mt-0.5">{c.telefone}</span>
                      )}
                    </li>
                  ))
                )}
              </ul>
            )}
            <input type="hidden" {...register('cliente_id')} />
              {errors.cliente_id && (
                <p className="text-error text-sm mt-1">{errors.cliente_id.message}</p>
              )}
            </div>
            {businessAreas.length > 0 && (
              <div className="lg:col-span-1">
                <SearchableSelect
                  label="Área de negócio"
                  options={[
                    { value: '', label: 'Nenhuma' },
                    ...businessAreas.map((a) => ({ value: a.id, label: a.name }))
                  ]}
                  value={businessAreaId ?? ''}
                  onChange={(v) => setBusinessAreaId(v || null)}
                  placeholder="Todas as áreas (opcional)"
                  emptyMessage="Nenhuma área encontrada"
                />
              </div>
            )}
          </div>

          {(tipoRegistro === 'quote' ? showDadosAdicionaisOrcamento : tipoRegistro === 'service_order' ? showDadosAdicionaisOs : showDadosAdicionaisVenda) && selectedCliente && clientExtraItems.length > 0 && (
            <div id="selecionar-item-cliente">
              <SearchableSelect
                label="Selecionar item do cliente"
                options={clientExtraItems.map((it) => ({ value: it.id, label: it.title, description: (it as { subtitle?: string }).subtitle }))}
                value={selectedExtraItemId ?? ''}
                onChange={(v) => setSelectedExtraItemId(v || null)}
                placeholder="Pesquisar item (veículo, equipamento...)"
                allowClear
                emptyMessage="Nenhum item encontrado"
              />
            </div>
          )}

          {isOs && (
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Problema relatado / Solicitação do cliente</label>
              <textarea
                value={problemaRelatado}
                onChange={(e) => setProblemaRelatado(e.target.value)}
                placeholder="Ex.: barulho no freio, troca de tela, revisão..."
                rows={3}
                className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted resize-y"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-text-main uppercase tracking-wide">
                {isOs ? 'Peças / Itens *' : 'Itens da Venda'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSelecaoProdutos(true)}
                className="bg-primary hover:bg-primary-hover text-text-on-primary text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                title="F2"
              >
                <span className="material-symbols-outlined">add</span>
                Adicionar Produtos
              </button>
            </div>

            {itensErro && (
              <p className="text-error text-sm mb-2 font-medium">{itensErro}</p>
            )}
            {itens.length === 0 ? (
              <div className={`text-center py-8 border rounded-lg text-text-muted bg-bg-elevated ${itensErro ? 'border-error' : 'border-border'}`}>
                {isOs ? 'Nenhuma peça. Adicione produtos e/ou serviços abaixo.' : 'Nenhum item adicionado. Clique em "Adicionar Produtos" para abrir o catálogo.'}
              </div>
            ) : (
              <div className={`border rounded-lg overflow-x-auto ${itensErro ? 'border-error' : 'border-border'}`}>
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-elevated text-text-muted">
                    <tr>
                      <th className="p-3 font-medium">Produto</th>
                      <th className="p-3 font-medium w-32">Quantidade</th>
                      <th className="p-3 font-medium w-28">Unitário</th>
                      <th className="p-3 font-medium w-28 text-right">Subtotal</th>
                      <th className="p-3 w-12" aria-label="Remover" />
                    </tr>
                  </thead>
                  <tbody className="text-text-main divide-y divide-border">
                    {itens.map((item, index) => (
                      <tr key={`${item.produto_id}-${index}`} className="hover:bg-bg-elevated/50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-bg-card border border-border flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-text-muted text-xl">inventory_2</span>
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium block">{item.nome}</span>
                              {(item.sku ?? ('sku' in item && (item as { sku?: string }).sku)) && (
                                <span className="text-xs text-text-muted">SKU: {item.sku ?? (item as { sku?: string }).sku}</span>
                              )}
                              {item.estoque_atual != null && (
                                <div className="mt-1 space-y-0.5">
                                  <div className="text-xs text-text-muted">
                                    <span>Estoque disponível: {Math.max(0, (item.estoque_atual ?? 0) - itens.filter((i) => i.produto_id === item.produto_id).reduce((s, i) => s + i.quantidade, 0))}</span>
                                    <span className="ml-2">Reservado nesta venda: {itens.filter((i) => i.produto_id === item.produto_id).reduce((s, i) => s + i.quantidade, 0)}</span>
                                  </div>
                                  {itens.filter((i) => i.produto_id === item.produto_id).reduce((s, i) => s + i.quantidade, 0) > (item.estoque_atual ?? 0) && (
                                    <p className="text-xs text-error font-medium">Quantidade acima do estoque disponível</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 border border-border rounded-lg bg-bg-main w-fit">
                            <button
                              type="button"
                              onClick={() => atualizarItemVenda(index, Math.max(1, item.quantidade - 1))}
                              className="p-1.5 rounded-l-md text-text-muted hover:text-text-main hover:bg-bg-elevated transition-colors"
                              aria-label="Diminuir quantidade"
                            >
                              <span className="material-symbols-outlined text-lg">remove</span>
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.quantidade}
                              onChange={(e) =>
                                atualizarItemVenda(index, Math.max(1, parseInt(e.target.value, 10) || 1))
                              }
                              className="w-12 text-center py-1.5 border-0 bg-transparent text-text-main [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              aria-label="Quantidade"
                            />
                            <button
                              type="button"
                              onClick={() => atualizarItemVenda(index, item.quantidade + 1)}
                              className="p-1.5 rounded-r-md text-text-muted hover:text-text-main hover:bg-bg-elevated transition-colors"
                              aria-label="Aumentar quantidade"
                            >
                              <span className="material-symbols-outlined text-lg">add</span>
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.preco_unitario || ''}
                              onChange={(e) => atualizarPrecoUnitario(index, parseFloat(e.target.value) || 0)}
                              className="w-28 px-2 py-1.5 border border-border rounded bg-bg-main text-text-main text-sm font-medium"
                              aria-label="Valor unitário"
                            />
                            {item.preco_cadastrado != null && item.preco_unitario !== item.preco_cadastrado && (
                              <span className="text-xs text-primary font-medium" title="Valor alterado em relação ao cadastro do produto">Preço alterado manualmente</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right font-medium">
                          {formatCurrency(subtotalItem(item))}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => removerItem(index)}
                            className="text-error hover:bg-badge-erro p-2 rounded transition-colors"
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

          {(isOs || tipoRegistro === 'sale' || tipoRegistro === 'quote') && (
            <div>
              <h3 className="text-sm font-bold text-text-main uppercase tracking-wide mb-2">
                {isOs ? 'Serviços executados' : 'Serviços'}
              </h3>
              {servicosErro && (
                <p className="text-error text-sm mb-2 font-medium">{servicosErro}</p>
              )}
              <div className="flex flex-wrap items-end gap-2 mb-2">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex flex-wrap gap-2">
                    <div className="flex-1 min-w-[180px]">
                      <SearchableSelect
                        options={servicosCadastrados.map((s) => ({ value: s.id, label: s.nome }))}
                        value={servicoSelecionadoId}
                        onChange={setServicoSelecionadoId}
                        placeholder="Buscar serviços cadastrados..."
                        emptyMessage="Nenhum serviço cadastrado"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={adicionarServicoCadastrado}
                      disabled={!servicoSelecionadoId}
                      className="px-3 py-2 rounded-lg bg-primary text-text-on-primary text-sm font-medium disabled:opacity-50 flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">add</span>
                      Adicionar serviço cadastrado
                    </button>
                    <button
                      type="button"
                      onClick={() => setServicos((prev) => [...prev, { descricao: '', quantidade: 1, valor_unitario: 0 }])}
                      className="px-3 py-2 rounded-lg border-2 border-dashed border-border bg-bg-elevated text-text-main text-sm font-medium flex items-center gap-1 hover:border-primary/50 hover:bg-bg-card transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                      Lançar Serviço Manual
                    </button>
                  </div>
                </div>
              </div>
              {servicos.length === 0 ? (
                <p className="text-sm text-text-muted py-2">Nenhum serviço. Use &quot;Adicionar serviço cadastrado&quot; ou &quot;Serviço manual&quot; para incluir.</p>
              ) : (
                <div className={`border rounded-lg overflow-hidden ${servicosErro ? 'border-error' : 'border-border'}`}>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-bg-elevated text-text-muted">
                      <tr>
                        <th className="p-3 font-medium">Serviço</th>
                        <th className="p-3 font-medium w-20">Qtd</th>
                        <th className="p-3 font-medium w-28">Valor unit.</th>
                        <th className="p-3 font-medium w-28 text-right">Subtotal</th>
                        <th className="p-3 w-12" aria-label="Remover" />
                      </tr>
                    </thead>
                    <tbody className="text-text-main divide-y divide-border">
                      {servicos.map((s, idx) => (
                        <tr key={idx} className="hover:bg-bg-elevated/50">
                          <td className="p-3">
                            <div className="flex flex-col gap-0.5">
                              <input
                                type="text"
                                value={s.descricao}
                                onChange={(e) => setServicos((prev) => prev.map((x, i) => (i === idx ? { ...x, descricao: e.target.value } : x)))}
                                placeholder="Ex.: Mão de obra, Diagnóstico"
                                className="w-full px-2 py-1.5 border border-border rounded bg-bg-main text-text-main text-sm"
                              />
                              {s.is_percentage && (
                                <span className="text-xs text-primary">Serviço calculado automaticamente</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min={1}
                              value={s.quantidade}
                              onChange={(e) => setServicos((prev) => prev.map((x, i) => (i === idx ? { ...x, quantidade: parseInt(e.target.value, 10) || 1 } : x)))}
                              className="w-16 px-2 py-1.5 border border-border rounded bg-bg-main text-text-main"
                            />
                          </td>
                          <td className="p-3">
                            {s.is_percentage ? (
                              <span className="text-sm text-text-muted">—</span>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={s.valor_unitario || ''}
                                onChange={(e) => setServicos((prev) => prev.map((x, i) => (i === idx ? { ...x, valor_unitario: parseFloat(e.target.value) || 0 } : x)))}
                                placeholder="0"
                                className="w-24 px-2 py-1.5 border border-border rounded bg-bg-main text-text-main"
                              />
                            )}
                          </td>
                          <td className="p-3 text-right font-medium">
                            {formatCurrency(s.quantidade * resolveServicoValorUnitario(s, idx, servicos, itens.reduce((a, i) => a + Number(i.preco_unitario) * Number(i.quantidade), 0)))}
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => setServicos((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-error hover:bg-badge-erro p-2 rounded"
                              title="Remover"
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
          )}

          {isOs && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Observações técnicas</label>
                <textarea
                  value={observacoesTecnicas}
                  onChange={(e) => setObservacoesTecnicas(e.target.value)}
                  placeholder="Ex.: peça com desgaste, recomendação de retorno..."
                  rows={2}
                  className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Texto de garantia</label>
                <textarea
                  value={textoGarantia}
                  onChange={(e) => setTextoGarantia(e.target.value)}
                  placeholder="Opcional. Em branco, o PDF usará o texto padrão de garantia de 3 meses."
                  rows={2}
                  className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Mensagem de agradecimento</label>
                <textarea
                  value={osAgradecimento}
                  onChange={(e) => setOsAgradecimento(e.target.value)}
                  placeholder="Ex.: Agradecemos a confiança em nosso trabalho."
                  rows={2}
                  className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted resize-y"
                />
              </div>
            </>
          )}

          <div>
            <h3 className="text-sm font-bold text-text-main uppercase tracking-wide mb-2">Anexos do pedido</h3>
            {!isEdit && (
              <p className="text-sm text-text-muted">Anexos podem ser adicionados após salvar o pedido (PDF, JPG, PNG ou WEBP).</p>
            )}
          {isEdit && vendaId && (
              loadingAnexos ? (
                <p className="text-sm text-text-muted">Carregando anexos…</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <input
                      ref={inputAnexoRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !vendaId) return;
                        setUploadingAnexo(true);
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          await api.post(`/vendas/${vendaId}/anexos`, formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          });
                          const res = await api.get<{ id: string; nome_original: string }[]>(`/vendas/${vendaId}/anexos`);
                          setAnexosVenda(res.data ?? []);
                          toast.success('Anexo adicionado');
                        } catch (err: any) {
                          toast.error(err.response?.data?.error || 'Erro ao enviar anexo');
                        } finally {
                          setUploadingAnexo(false);
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingAnexo}
                      onClick={() => inputAnexoRef.current?.click()}
                      className="px-3 py-2 rounded-lg border border-border bg-bg-elevated text-text-main text-sm font-medium flex items-center gap-1 hover:bg-bg-card transition-colors disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-lg">attach_file</span>
                      Adicionar anexo
                    </button>
                    <span className="text-xs text-text-muted">PDF, JPG, PNG ou WEBP. Máx. 10 MB.</span>
                  </div>
                  {anexosVenda.length > 0 && (
                    <ul className="border border-border rounded-lg divide-y divide-border">
                      {anexosVenda.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-2 p-2">
                          <span className="text-sm text-text-main truncate" title={a.nome_original}>{a.nome_original}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await api.get(`/vendas/${vendaId}/anexos/${a.id}/download`, { responseType: 'blob' });
                                  const url = URL.createObjectURL(res.data as Blob);
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = a.nome_original;
                                  link.click();
                                  URL.revokeObjectURL(url);
                                } catch {
                                  toast.error('Erro ao baixar anexo');
                                }
                              }}
                              className="p-1.5 rounded text-text-muted hover:bg-bg-elevated"
                              title="Baixar"
                            >
                              <span className="material-symbols-outlined text-lg">download</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm('Remover este anexo?')) return;
                                try {
                                  await api.delete(`/vendas/${vendaId}/anexos/${a.id}`);
                                  setAnexosVenda((prev) => prev.filter((x) => x.id !== a.id));
                                  toast.success('Anexo removido');
                                } catch (err: any) {
                                  toast.error(err.response?.data?.error || 'Erro ao remover');
                                }
                              }}
                              className="p-1.5 rounded text-error hover:bg-badge-erro"
                              title="Remover"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )
            )}
          </div>

          </div>

          {/* Coluna direita: Resumo da Venda (fixa, sem scroll) */}
          <div className="lg:col-span-1 flex flex-col gap-4 lg:min-h-0 overflow-y-auto pr-1">
            <div className="bg-bg-elevated p-4 rounded-xl border border-border shadow-sm flex flex-col gap-4 flex-shrink-0">
              <h3 className="text-sm font-bold text-text-main uppercase tracking-wide">Resumo da Venda</h3>
              <div className="flex justify-between items-center">
                <span className="text-text-muted text-sm">Subtotal</span>
                <span className="font-semibold text-text-main">
                  {formatCurrency(servicos.length > 0 ? subtotalGeral : (isOs ? subtotalGeral : subtotalItens))}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Desconto / Acréscimo (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={-100}
                    max={100}
                    step="0.01"
                    placeholder="0"
                    {...register('desconto_percentual', {
                      valueAsNumber: true,
                      min: { value: -100, message: 'Mín. -100% (acréscimo)' },
                      max: { value: 100, message: 'Máx. 100%' }
                    })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-bg-main text-text-main"
                    aria-label="Desconto ou acréscimo percentual"
                  />
                  <span className="text-text-muted font-medium shrink-0">%</span>
                </div>
                {errors.desconto_percentual && (
                  <p className="text-error text-sm mt-1">{errors.desconto_percentual.message}</p>
                )}
                {descontoPct >= 0 ? (
                  <p className="text-sm text-success mt-1">Desconto aplicado — {formatCurrency(valorDesconto)}</p>
                ) : (
                  <p className="text-sm text-primary mt-1">Acréscimo aplicado — +{formatCurrency(-valorDesconto)}</p>
                )}
              </div>
              {!isQuote && !isOs && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-text-main uppercase tracking-wide">Pagamentos</h4>
                    <button
                      type="button"
                      onClick={() => {
                        const remaining = Math.max(0, restante);
                        if (pagamentos.length === 0) {
                          setPagamentos([
                            {
                              tipo_pagamento: 'dinheiro',
                              valor: remaining,
                              parcelas: null,
                              data_pagamento: new Date().toISOString()
                            }
                          ]);
                          return;
                        }

                        const tipoDefault = pagamentos[0]?.tipo_pagamento ?? 'dinheiro';
                        setPagamentos((prev) => [
                          ...prev,
                          {
                            tipo_pagamento: tipoDefault,
                            valor: remaining,
                            parcelas: tipoDefault === 'credito' ? (pagamentos[0]?.parcelas ?? null) : null,
                            data_pagamento: new Date().toISOString()
                          }
                        ]);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-border bg-bg-card text-text-main hover:bg-bg-elevated text-sm font-medium flex items-center gap-1"
                      disabled={pagamentosExcedemTotal || restante <= 0.0001}
                      title="Adicionar pagamento"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                      Adicionar pagamento
                    </button>
                  </div>

                  {pagamentos.length === 1 && restante > 0.0001 && (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-text-muted">
                        Sugestão: adicionar pagamento 2 com o restante ({formatCurrency(restante)}).
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const p0 = pagamentos[0];
                          if (!p0) return;
                          setPagamentos((prev) => [
                            ...prev,
                            {
                              tipo_pagamento: p0.tipo_pagamento,
                              valor: restante,
                              parcelas: p0.tipo_pagamento === 'credito' ? p0.parcelas : null,
                              data_pagamento: new Date().toISOString(),
                              __autoSecond: true
                            }
                          ]);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-border bg-bg-card text-text-main hover:bg-bg-elevated text-sm font-medium flex items-center gap-1"
                        title="Adicionar pagamento 2 sugerido"
                      >
                        <span className="material-symbols-outlined text-base">add</span>
                        Adicionar 2
                      </button>
                    </div>
                  )}

                  <div className="bg-bg-main border border-border rounded-lg p-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Total da venda</span>
                      <span className="font-semibold text-text-main">{formatCurrency(totalFinal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Total pago</span>
                      <span className="font-semibold text-text-main">{formatCurrency(totalPago)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Restante</span>
                      <span className={`font-semibold ${restante <= 0 ? 'text-success' : 'text-text-main'}`}>{formatCurrency(restante)}</span>
                    </div>
                    <div className="pt-2">
                      <span
                        className={`text-xs px-2 py-1 rounded shrink-0 ${
                          statusCalculadoVenda === 'PAGO'
                            ? 'bg-badge-pago text-badge-pago-text'
                            : statusCalculadoVenda === 'PARCIAL'
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                              : 'bg-badge-pendente text-badge-pendente-text'
                        }`}
                      >
                        {statusCalculadoVenda === 'PAGO' ? 'Pago' : statusCalculadoVenda === 'PARCIAL' ? 'Parcial' : 'Pendente'}
                      </span>
                    </div>
                  </div>

                  <div className={`border rounded-lg p-3 ${pagamentosExcedemTotal ? 'border-error' : 'border-border'} ${pagamentos.length === 0 ? 'bg-bg-elevated/50' : ''}`}>
                    {loadingPagamentos ? (
                      <p className="text-sm text-text-muted">Carregando pagamentos…</p>
                    ) : pagamentos.length === 0 ? (
                      <p className="text-sm text-text-muted">Adicione pagamentos para calcular o status automaticamente.</p>
                    ) : (
                      <div className="space-y-2">
                        {pagamentos.map((p, idx) => (
                          <div key={`${p.id ?? idx}-${idx}`} className="flex flex-col gap-2 border border-border rounded-lg p-2 bg-bg-main">
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="min-w-[200px] flex-1">
                                <label className="block text-xs font-medium text-text-muted mb-1">Tipo</label>
                                <SearchableSelect
                                  label=""
                                  options={[
                                    { value: 'dinheiro', label: 'Dinheiro' },
                                    { value: 'pix', label: 'Pix' },
                                    { value: 'debito', label: 'Cartão de Débito' },
                                    { value: 'credito', label: 'Cartão de Crédito' },
                                    { value: 'fiado', label: 'Fiado' }
                                  ]}
                                  value={p.tipo_pagamento}
                                  onChange={(v) => {
                                    const nextTipo = v as PaymentTipo;
                                    setPagamentos((prev) =>
                                      prev.map((x, i) =>
                                        i !== idx
                                          ? x
                                          : {
                                              ...x,
                                              tipo_pagamento: nextTipo,
                                              parcelas: nextTipo === 'credito' ? (x.parcelas ?? null) : null,
                                            }
                                      )
                                    );
                                  }}
                                  placeholder="Selecionar"
                                  emptyMessage="Nenhum tipo encontrado"
                                />
                              </div>
                              <div className="w-32">
                                <label className="block text-xs font-medium text-text-muted mb-1">Valor</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={p.valor}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setPagamentos((prev) =>
                                      prev.map((x, i) => {
                                        if (i !== idx) return x;
                                        const nextValor = Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
                                        return { ...x, valor: nextValor, __autoSecond: idx === 1 ? false : x.__autoSecond };
                                      })
                                    );
                                  }}
                                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-bg-main text-text-main"
                                />
                              </div>
                              {p.tipo_pagamento === 'credito' && (
                                <div className="w-28">
                                  <label className="block text-xs font-medium text-text-muted mb-1">Parcelas</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={p.parcelas ?? ''}
                                    onChange={(e) => {
                                      const v = e.target.value === '' ? null : Math.max(1, Math.floor(Number(e.target.value)));
                                      setPagamentos((prev) => prev.map((x, i) => (i === idx ? { ...x, parcelas: v } : x)));
                                    }}
                                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-bg-main text-text-main"
                                  />
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setPagamentos((prev) => prev.filter((_, i) => i !== idx));
                                }}
                                className="p-2 rounded-lg text-error hover:bg-badge-erro/20"
                                title="Remover pagamento"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {pagamentosExcedemTotal && (
                      <p className="text-error text-sm mt-2 font-medium">A soma dos pagamentos excede o total da venda.</p>
                    )}
                    {!pagamentosExcedemTotal && pagamentosErro && (
                      <p className="text-error text-sm mt-2 font-medium">{pagamentosErro}</p>
                    )}
                  </div>
                </div>
              )}

              {!isQuote && isOs && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Forma de Pagamento {!isOs ? '*' : ''}</label>
                    <select
                      {...register('forma_pagamento')}
                      className={`w-full pl-3 pr-8 py-2 border rounded-lg focus:ring-2 outline-none bg-bg-main text-text-main ${
                        errors.forma_pagamento ? 'border-error focus:ring-error/20 focus:border-error' : 'border-border focus:ring-primary focus:border-primary'
                      }`}
                    >
                      <option value="">Selecione</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Cartão de Débito">Cartão de Débito</option>
                      <option value="Pix">Pix</option>
                      <option value="Transferência">Transferência</option>
                      <option value="Outro">Outro</option>
                    </select>
                    {errors.forma_pagamento && (
                      <p className="text-error text-sm mt-1">{errors.forma_pagamento.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">Status</label>
                    <select
                      {...register('status')}
                      className="w-full pl-3 pr-8 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-bg-main text-text-main"
                    >
                      <option value="PENDENTE">● Aguardando pagamento</option>
                      <option value="PAGO">● Pago</option>
                      <option value="PARCIAL">● Parcial</option>
                    </select>
                  </div>
                </>
              )}
              <div className="pt-3 border-t border-border space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-text-main uppercase tracking-wide">Total final</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(totalFinal)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || (!isQuote && !isOs && pagamentosExcedemTotal)}
                  className="w-full bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed min-h-[48px] transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                      Salvando…
                    </>
                  ) : (
                    <>
                      {isEdit
                        ? (isOs ? 'Atualizar ordem de serviço' : isQuote ? 'Atualizar orçamento' : 'Salvar alterações')
                        : isOs
                          ? 'Salvar ordem de serviço'
                          : isQuote
                            ? 'Salvar orçamento'
                            : 'Finalizar e Salvar Venda'}
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 border border-border rounded-lg text-text-main hover:bg-bg-elevated disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  Cancelar operação
                </button>
              </div>
            </div>
          </div>
        </div>
        </form>

        {/* Rodapé: Data, Hora, Operador */}
        <footer className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 border-t border-border bg-bg-elevated/50 text-sm text-text-muted">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5" title="Data">
              <span className="material-symbols-outlined text-lg">calendar_today</span>
              {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1.5" title="Hora">
              <span className="material-symbols-outlined text-lg">schedule</span>
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-lg">person</span>
            Operador: {user?.nome ?? user?.email ?? '—'}
          </span>
        </footer>
      </div>

      <SelecaoProdutosModal
        open={showSelecaoProdutos}
        onClose={() => setShowSelecaoProdutos(false)}
        itensDaVenda={itens}
        setItensDaVenda={setItens}
      />
    </div>
    </ModalPortal>
  );
}

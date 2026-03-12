import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { usePersonalizacao } from '../contexts/PersonalizacaoContext';
import { useBusinessAreas } from '../contexts/BusinessAreaContext';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate, maskPhone, maskCpfCnpj } from '../utils/format';
import SearchableSelect from '../components/SearchableSelect';
import TableActionsMenu from '../components/TableActionsMenu';
import ModalPortal from '../components/ModalPortal';

type TabFornecedores = 'lista' | 'categorias' | 'analise';

interface SupplierCategory {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  suppliersCount?: number;
}

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  cpf_cnpj: string | null;
  category_id: string | null;
  category?: { id: string; name: string } | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  business_area_id?: string | null;
  createdAt?: string;
  updatedAt?: string;
  produtosCount?: number;
  transactionsCount?: number;
  totalGasto?: number;
  ultimaCompra?: string | null;
}

interface SupplierDetail extends Supplier {
  produtos?: { id: string; nome: string; custo: number; preco: number; estoque_atual: number; ultimaVenda: string | null }[];
  movimentacoes?: { id: string; date: string; description: string; category: string; value: number; status: string; source_type: string }[];
  compras?: { id: string; product_id: string; product_name: string; quantity: number; total_cost: number; date: string }[];
  ticketMedio?: number;
  alertaSemMovimentacoes?: boolean;
  ultimaCompra?: { date: string; value: number; description: string } | null;
}

/** Formata telefone para link WhatsApp (apenas dígitos, 55 + DDD + número) */
function whatsappLink(phone: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, '');
  const num = d.startsWith('0') ? d.slice(1) : d;
  return num.length >= 10 ? `55${num}` : null;
}

function IndicadoresTopo({ tab }: { tab: TabFornecedores }) {
  const [stats, setStats] = useState<{ total: number; ativos: number; gastoTotal: number } | null>(null);
  useEffect(() => {
    api.get<{ total: number; ativos: number; gastoTotal: number }>('/fornecedores/stats').then((r) => setStats(r.data)).catch(() => setStats(null));
  }, [tab]);
  if (!stats) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
        <p className="text-sm text-[var(--color-text-muted)] mb-1">Total de fornecedores</p>
        <p className="text-2xl font-bold text-[var(--color-text-main)]">{stats.total}</p>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
        <p className="text-sm text-[var(--color-text-muted)] mb-1">Fornecedores ativos</p>
        <p className="text-2xl font-bold text-[var(--color-text-main)]">{stats.ativos}</p>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm">
        <p className="text-sm text-[var(--color-text-muted)] mb-1">Gasto total com fornecedores</p>
        <p className="text-2xl font-bold text-[var(--color-text-main)]">{formatCurrency(stats.gastoTotal)}</p>
      </div>
    </div>
  );
}

export default function Fornecedores() {
  const { getModuleLabel } = usePersonalizacao();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabFornecedores | null;
  const [tab, setTab] = useState<TabFornecedores>(tabParam && ['lista', 'categorias', 'analise'].includes(tabParam) ? tabParam : 'lista');

  const setTabAndUrl = (t: TabFornecedores) => {
    setTab(t);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', t);
      return next;
    });
  };

  useEffect(() => {
    if (tabParam && tabParam !== tab) setTab(tabParam as TabFornecedores);
  }, [tabParam]);

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-main)] mb-1 sm:mb-2">
          {getModuleLabel('fornecedores')}
        </h1>
        <p className="text-sm sm:text-base text-[var(--color-text-muted)]">
          Cadastro de fornecedores, categorias e análise de gastos
        </p>
      </div>

      <IndicadoresTopo tab={tab} />

      <div className="border-b border-[var(--color-border)]">
        <nav className="flex gap-6 sm:gap-8" aria-label="Abas Fornecedores">
          {(['lista', 'categorias', 'analise'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTabAndUrl(key)}
              className={`pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === key
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
              }`}
            >
              {key === 'lista' ? 'Lista' : key === 'categorias' ? 'Categorias' : 'Análise'}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'lista' && <AbaLista />}
      {tab === 'categorias' && <AbaCategorias />}
      {tab === 'analise' && <AbaAnalise />}
    </div>
  );
}

function AbaLista() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<SupplierCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState<string>('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Supplier | null>(null);
  const [detalhe, setDetalhe] = useState<SupplierDetail | null>(null);

  const loadCategories = useCallback(() => {
    api
      .get<SupplierCategory[]>('/fornecedores/categories')
      .then((r) => setCategories(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCategories([]));
  }, []);

  const loadSuppliers = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {};
    if (search.trim()) params.search = search.trim();
    if (filtroCategoria) params.category_id = filtroCategoria;
    if (filtroCidade.trim()) params.city = filtroCidade.trim();
    if (filtroAtivo === 'true' || filtroAtivo === 'false') params.is_active = filtroAtivo;
    api
      .get<Supplier[]>('/fornecedores', { params })
      .then((r) => setSuppliers(Array.isArray(r.data) ? r.data : []))
      .catch((err) => {
        setError(err.response?.data?.error || 'Erro ao carregar fornecedores');
        setSuppliers([]);
      })
      .finally(() => setLoading(false));
  }, [search, filtroCategoria, filtroCidade, filtroAtivo]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);
  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const exportCSV = () => {
    const headers = ['Nome', 'Telefone', 'WhatsApp', 'Categoria', 'Cidade', 'Total gasto', 'Última compra'];
    const rows = suppliers.map((s) => [
      s.name,
      s.phone ?? '',
      s.whatsapp ?? '',
      s.category?.name ?? '',
      s.city ?? '',
      String(s.totalGasto ?? 0),
      s.ultimaCompra ?? ''
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fornecedores.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado.');
  };

  const abrirDetalhe = (id: string) => {
    api
      .get<SupplierDetail>(`/fornecedores/${id}`)
      .then((r) => setDetalhe(r.data))
      .catch(() => toast.error('Erro ao carregar detalhes'));
  };

  const handleDelete = async (s: Supplier) => {
    if ((s.produtosCount ?? 0) > 0 || (s.transactionsCount ?? 0) > 0) {
      toast.error('Fornecedor vinculado a produtos ou movimentações. Desvincule antes de excluir.');
      return;
    }
    if (!confirm(`Excluir o fornecedor "${s.name}"?`)) return;
    try {
      await api.delete(`/fornecedores/${s.id}`);
      toast.success('Fornecedor excluído.');
      loadSuppliers();
      setDetalhe(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir.');
    }
  };

  const cidadesUnicas = [...new Set(suppliers.map((s) => s.city).filter(Boolean))].sort() as string[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por nome"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadSuppliers()}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm min-w-[180px]"
        />
        <SearchableSelect
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={filtroCategoria}
          onChange={setFiltroCategoria}
          placeholder="Todas as categorias"
          allowClear
          emptyMessage="Nenhuma categoria encontrada"
          className="min-w-[160px]"
        />
        <SearchableSelect
          options={cidadesUnicas.map((c) => ({ value: c, label: c }))}
          value={filtroCidade}
          onChange={setFiltroCidade}
          placeholder="Todas as cidades"
          allowClear
          emptyMessage="Nenhuma cidade encontrada"
          className="min-w-[160px]"
        />
        <select
          value={filtroAtivo}
          onChange={(e) => setFiltroAtivo(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm"
        >
          <option value="">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
        <button type="button" onClick={loadSuppliers} className="px-4 py-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-main)] text-sm font-medium">
          Filtrar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setEditando(null); setModalAberto(true); }}
          className="px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Novo fornecedor
        </button>
        <button
          type="button"
          onClick={exportCSV}
          className="px-4 py-2.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-main)] font-medium flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">download</span>
          Exportar CSV
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--color-error)] bg-red-500/10 p-4 text-[var(--color-error)]">{error}</div>
      )}

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-[var(--color-text-muted)]">Carregando...</div>
        ) : suppliers.length === 0 ? (
          <div className="py-12 text-center text-[var(--color-text-muted)]">Nenhum fornecedor encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-text-main)]">Nome</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-text-main)]">Categoria</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-text-main)]">Cidade</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-text-main)]">Telefone</th>
                  <th className="text-right py-3 px-4 font-medium text-[var(--color-text-main)]">Total gasto</th>
                  <th className="text-right py-3 px-4 font-medium text-[var(--color-text-main)]">Última movimentação</th>
                  <th className="text-center py-3 px-4 font-medium text-[var(--color-text-main)]">Status</th>
                  <th className="table-actions-col text-right py-3 px-4 font-medium text-[var(--color-text-main)] w-[120px]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => {
                  const wlink = whatsappLink(s.whatsapp || s.phone);
                  return (
                    <tr key={s.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)]">
                      <td className="py-3 px-4">
                        <button type="button" onClick={() => abrirDetalhe(s.id)} className="font-medium text-[var(--color-primary)] hover:underline text-left">
                          {s.name}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-muted)]">{s.category?.name ?? '—'}</td>
                      <td className="py-3 px-4 text-[var(--color-text-muted)]">{s.city ?? '—'}</td>
                      <td className="py-3 px-4 text-[var(--color-text-muted)]">{s.phone ?? '—'}</td>
                      <td className="py-3 px-4 text-right font-medium text-[var(--color-text-main)]">{formatCurrency(s.totalGasto ?? 0)}</td>
                      <td className="py-3 px-4 text-right text-[var(--color-text-muted)]">{s.ultimaCompra ? formatDate(s.ultimaCompra) : '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'}`}>
                          {s.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="table-actions-col py-3 px-4 text-right">
                        <TableActionsMenu
                          iconSize="md"
                          items={[
                            { label: 'Ver detalhes', icon: 'visibility', onClick: () => abrirDetalhe(s.id) },
                            { label: 'Editar', icon: 'edit', onClick: () => { setEditando(s); setModalAberto(true); } },
                            { label: 'Excluir', icon: 'delete', onClick: () => handleDelete(s), danger: true }
                          ]}
                        >
                          {wlink ? (
                            <a href={`https://wa.me/${wlink}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded text-[var(--color-success)] hover:bg-green-500/10 inline-flex items-center justify-center min-h-[44px] min-w-[44px]" title="Abrir WhatsApp">
                              <span className="material-symbols-outlined text-lg">chat</span>
                            </a>
                          ) : null}
                        </TableActionsMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAberto && (
        <ModalFornecedor
          categorias={categories}
          fornecedor={editando}
          fechar={() => { setModalAberto(false); setEditando(null); loadSuppliers(); loadCategories(); }}
        />
      )}

      {detalhe && (
        <DrawerDetalhe
          fornecedor={detalhe}
          fechar={() => setDetalhe(null)}
          onEdit={() => { setDetalhe(null); setEditando(suppliers.find((x) => x.id === detalhe.id) ?? null); setModalAberto(true); }}
        />
      )}
    </div>
  );
}

function ModalFornecedor({
  categorias,
  fornecedor,
  fechar
}: {
  categorias: SupplierCategory[];
  fornecedor: Supplier | null;
  fechar: () => void;
}) {
  const { areas: businessAreas, enabled: businessAreasEnabled, selectedAreaId } = useBusinessAreas();
  const [name, setName] = useState(fornecedor?.name ?? '');
  const [phone, setPhone] = useState(fornecedor?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(fornecedor?.whatsapp ?? '');
  const [email, setEmail] = useState(fornecedor?.email ?? '');
  const [cpf_cnpj, setCpfCnpj] = useState(fornecedor?.cpf_cnpj ?? '');
  const [category_id, setCategoryId] = useState(fornecedor?.category_id ?? '');
  const [city, setCity] = useState(fornecedor?.city ?? '');
  const [address, setAddress] = useState(fornecedor?.address ?? '');
  const [notes, setNotes] = useState(fornecedor?.notes ?? '');
  const [is_active, setIsActive] = useState(fornecedor?.is_active ?? true);
  const [business_area_id, setBusinessAreaId] = useState(fornecedor?.business_area_id ?? selectedAreaId ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fornecedor) {
      setBusinessAreaId(fornecedor.business_area_id ?? '');
    } else {
      setBusinessAreaId(selectedAreaId ?? '');
    }
  }, [fornecedor, selectedAreaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nome é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        email: email.trim() || null,
        cpf_cnpj: cpf_cnpj.trim() || null,
        category_id: category_id || null,
        city: city.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        is_active
      };
      if (businessAreasEnabled) {
        payload.business_area_id = business_area_id?.trim() || null;
      }
      if (fornecedor) {
        await api.put(`/fornecedores/${fornecedor.id}`, payload);
        toast.success('Fornecedor atualizado.');
      } else {
        await api.post('/fornecedores', payload);
        toast.success('Fornecedor cadastrado.');
      }
      fechar();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="aurix-modal-overlay fixed inset-0 flex items-center justify-center p-4 bg-black/50" onClick={fechar}>
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-[var(--color-text-main)] mb-4">{fornecedor ? 'Editar fornecedor' : 'Novo fornecedor'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Nome *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Telefone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" maxLength={15} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-[var(--color-text-main)]">WhatsApp</label>
                {!whatsapp?.trim() && phone.trim() && (
                  <button type="button" onClick={() => setWhatsapp(phone)} className="text-xs text-[var(--color-primary)] hover:underline">Usar mesmo do telefone</button>
                )}
              </div>
              <input type="text" value={whatsapp} onChange={(e) => setWhatsapp(maskPhone(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" maxLength={15} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">CPF/CNPJ</label>
              <input type="text" value={cpf_cnpj} onChange={(e) => setCpfCnpj(maskCpfCnpj(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" maxLength={18} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <SearchableSelect
                label="Categoria"
                options={categorias.map((c) => ({ value: c.id, label: c.name }))}
                value={category_id ?? ''}
                onChange={setCategoryId}
                placeholder="Pesquisar categoria..."
                allowClear
                emptyMessage="Nenhuma categoria encontrada"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Cidade</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" />
            </div>
          </div>
          {businessAreasEnabled && businessAreas.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Área de negócio</label>
              <SearchableSelect
                options={[
                  { value: '', label: 'Nenhuma' },
                  ...(businessAreas?.map((a) => ({ value: a.id, label: a.name })) ?? [])
                ]}
                value={business_area_id ?? ''}
                onChange={setBusinessAreaId}
                placeholder="Selecione a área"
                emptyMessage="Nenhuma área"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Endereço</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Observações</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={is_active} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-[var(--color-border)]" />
            <label htmlFor="is_active" className="text-sm text-[var(--color-text-main)]">Ativo</label>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={fechar} className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-main)]">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}

function DrawerDetalhe({ fornecedor, fechar, onEdit }: { fornecedor: SupplierDetail; fechar: () => void; onEdit: () => void }) {
  const wlink = whatsappLink(fornecedor.whatsapp || fornecedor.phone);
  const ultima = fornecedor.ultimaCompra && typeof fornecedor.ultimaCompra === 'object' && 'date' in fornecedor.ultimaCompra
    ? fornecedor.ultimaCompra
    : null;
  const statusLabel = (st: string) => (st === 'confirmed' ? 'Confirmado' : st === 'pending' ? 'Pendente' : 'Cancelado');
  const origemLabel = (st: string) => (st === 'sale' ? 'Venda' : st === 'manual' ? 'Manual' : st === 'adjustment' ? 'Ajuste' : st);

  return (
    <ModalPortal>
      <div className="aurix-modal-overlay fixed inset-0 flex justify-end bg-black/50" onClick={fechar}>
        <div className="w-full max-w-2xl bg-[var(--color-bg-card)] border-l border-[var(--color-border)] shadow-xl overflow-y-auto max-h-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between">
            <h3 className="text-xl font-semibold text-[var(--color-text-main)]">{fornecedor.name}</h3>
            <button type="button" onClick={fechar} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)]">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {fornecedor.alertaSemMovimentacoes && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400 text-sm">
              Este fornecedor ainda não possui movimentações financeiras registradas.
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Dados do fornecedor</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <p><span className="text-[var(--color-text-muted)]">Nome:</span> {fornecedor.name}</p>
              <p><span className="text-[var(--color-text-muted)]">Telefone:</span> {fornecedor.phone ?? '—'}</p>
              <p><span className="text-[var(--color-text-muted)]">WhatsApp:</span> {fornecedor.whatsapp ?? '—'}</p>
              <p><span className="text-[var(--color-text-muted)]">E-mail:</span> {fornecedor.email ?? '—'}</p>
              <p><span className="text-[var(--color-text-muted)]">CPF/CNPJ:</span> {fornecedor.cpf_cnpj ?? '—'}</p>
              <p><span className="text-[var(--color-text-muted)]">Categoria:</span> {fornecedor.category?.name ?? '—'}</p>
              <p><span className="text-[var(--color-text-muted)]">Cidade:</span> {fornecedor.city ?? '—'}</p>
              <p><span className="text-[var(--color-text-muted)]">Status:</span> {fornecedor.is_active ? 'Ativo' : 'Inativo'}</p>
            </div>
            {fornecedor.address && <p className="mt-2 text-sm"><span className="text-[var(--color-text-muted)]">Endereço:</span> {fornecedor.address}</p>}
            {fornecedor.notes && <p className="mt-2 text-sm"><span className="text-[var(--color-text-muted)]">Observações:</span> {fornecedor.notes}</p>}
            {wlink && (
              <a href={`https://wa.me/${wlink}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-green-600 text-white font-medium text-sm">
                <span className="material-symbols-outlined text-lg">chat</span>
                Abrir WhatsApp
              </a>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Resumo financeiro</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Total gasto</p>
                <p className="text-lg font-bold text-[var(--color-text-main)]">{formatCurrency(fornecedor.totalGasto ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Movimentações</p>
                <p className="text-lg font-bold text-[var(--color-text-main)]">{fornecedor.transactionsCount ?? 0}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Última compra</p>
                <p className="text-[var(--color-text-main)]">{ultima ? formatDate(ultima.date) + ' · ' + formatCurrency(ultima.value) : '—'}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Ticket médio</p>
                <p className="text-lg font-bold text-[var(--color-text-main)]">{(fornecedor.ticketMedio != null) ? formatCurrency(fornecedor.ticketMedio) : '—'}</p>
              </div>
            </div>
          </div>

          {(fornecedor.movimentacoes?.length ?? 0) > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">Movimentações financeiras</h4>
              <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                      <th className="text-left py-2 px-3 font-medium text-[var(--color-text-main)]">Data</th>
                      <th className="text-left py-2 px-3 font-medium text-[var(--color-text-main)]">Descrição</th>
                      <th className="text-left py-2 px-3 font-medium text-[var(--color-text-main)]">Categoria</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--color-text-main)]">Valor</th>
                      <th className="text-left py-2 px-3 font-medium text-[var(--color-text-main)]">Status</th>
                      <th className="text-left py-2 px-3 font-medium text-[var(--color-text-main)]">Origem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fornecedor.movimentacoes!.map((t) => (
                      <tr key={t.id} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="py-2 px-3 text-[var(--color-text-muted)]">{formatDate(t.date)}</td>
                        <td className="py-2 px-3 text-[var(--color-text-main)]">{t.description}</td>
                        <td className="py-2 px-3 text-[var(--color-text-muted)]">{t.category}</td>
                        <td className="py-2 px-3 text-right font-medium text-[var(--color-text-main)]">{formatCurrency(t.value)}</td>
                        <td className="py-2 px-3 text-[var(--color-text-muted)]">{statusLabel(t.status)}</td>
                        <td className="py-2 px-3 text-[var(--color-text-muted)]">{origemLabel(t.source_type)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(fornecedor.compras?.length ?? 0) > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">Compras realizadas</h4>
              <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                      <th className="text-left py-2 px-3 font-medium text-[var(--color-text-main)]">Produto</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--color-text-main)]">Quantidade</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--color-text-main)]">Valor total</th>
                      <th className="text-left py-2 px-3 font-medium text-[var(--color-text-main)]">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fornecedor.compras!.map((c) => (
                      <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="py-2 px-3 text-[var(--color-text-main)]">{c.product_name}</td>
                        <td className="py-2 px-3 text-right text-[var(--color-text-muted)]">{c.quantity}</td>
                        <td className="py-2 px-3 text-right font-medium text-[var(--color-text-main)]">{formatCurrency(c.total_cost)}</td>
                        <td className="py-2 px-3 text-[var(--color-text-muted)]">{formatDate(c.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(fornecedor.produtos?.length ?? 0) > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">Produtos vinculados</h4>
              <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                      <th className="text-left py-2 px-3 font-medium text-[var(--color-text-main)]">Produto</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--color-text-main)]">Custo</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--color-text-main)]">Preço venda</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--color-text-main)]">Estoque</th>
                      <th className="text-left py-2 px-3 font-medium text-[var(--color-text-main)]">Última venda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fornecedor.produtos!.map((p) => (
                      <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="py-2 px-3 text-[var(--color-text-main)]">{p.nome}</td>
                        <td className="py-2 px-3 text-right text-[var(--color-text-muted)]">{formatCurrency(p.custo ?? 0)}</td>
                        <td className="py-2 px-3 text-right text-[var(--color-text-muted)]">{formatCurrency(p.preco ?? 0)}</td>
                        <td className="py-2 px-3 text-right text-[var(--color-text-main)]">{p.estoque_atual ?? '—'}</td>
                        <td className="py-2 px-3 text-[var(--color-text-muted)]">{p.ultimaVenda ? formatDate(p.ultimaVenda) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={onEdit} className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-main)] font-medium flex items-center justify-center gap-2">
              <span className="material-symbols-outlined">edit</span>
              Editar
            </button>
            <button type="button" onClick={fechar} className="px-4 py-2.5 rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-main)]">Fechar</button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

function AbaCategorias() {
  const [categories, setCategories] = useState<SupplierCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<SupplierCategory | null>(null);
  const [nome, setNome] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get<SupplierCategory[]>('/fornecedores/categories').then((r) => setCategories(r.data)).catch(() => setCategories([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error('Nome é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      if (editando) {
        await api.put(`/fornecedores/categories/${editando.id}`, { name: nome.trim() });
        toast.success('Categoria atualizada.');
      } else {
        await api.post('/fornecedores/categories', { name: nome.trim() });
        toast.success('Categoria criada.');
      }
      setModalAberto(false);
      setEditando(null);
      setNome('');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: SupplierCategory) => {
    if ((c.suppliersCount ?? 0) > 0) {
      toast.error('Não é possível excluir categoria com fornecedores vinculados.');
      return;
    }
    if (!confirm(`Excluir a categoria "${c.name}"?`)) return;
    try {
      await api.delete(`/fornecedores/categories/${c.id}`);
      toast.success('Categoria excluída.');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => { setEditando(null); setNome(''); setModalAberto(true); }} className="px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium flex items-center gap-2">
          <span className="material-symbols-outlined">add</span>
          Nova categoria
        </button>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-[var(--color-text-muted)]">Carregando...</div>
        ) : categories.length === 0 ? (
          <div className="p-6 text-[var(--color-text-muted)]">Nenhuma categoria. Crie uma para organizar fornecedores.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                <th className="text-left py-3 px-4 font-medium text-[var(--color-text-main)]">Nome</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--color-text-main)]">Quantidade de fornecedores</th>
                <th className="table-actions-col text-right py-3 px-4 font-medium text-[var(--color-text-main)] w-[80px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-elevated)]">
                  <td className="py-3 px-4 font-medium text-[var(--color-text-main)]">{c.name}</td>
                  <td className="py-3 px-4 text-[var(--color-text-muted)]">{c.suppliersCount ?? 0} fornecedor(es)</td>
                  <td className="table-actions-col py-3 px-4 text-right">
                    <TableActionsMenu
                      iconSize="md"
                      items={[
                        { label: 'Editar', icon: 'edit', onClick: () => { setEditando(c); setNome(c.name); setModalAberto(true); } },
                        { label: 'Excluir', icon: 'delete', onClick: () => handleDelete(c), danger: true }
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalAberto && (
        <ModalPortal>
          <div className="aurix-modal-overlay fixed inset-0 flex items-center justify-center p-4 bg-black/50" onClick={() => setModalAberto(false)}>
            <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-[var(--color-text-main)] mb-4">{editando ? 'Editar categoria' : 'Nova categoria'}</h3>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Nome</label>
                  <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-main)]" required />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setModalAberto(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-main)]">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-medium disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

function AbaAnalise() {
  type Periodo = '7' | '30' | '90' | 'custom';
  const [periodo, setPeriodo] = useState<Periodo>('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<{
    topFornecedores: { supplier_name: string; totalGasto: number; quantidadeCompras: number }[];
    totalGeral: number;
    dependenciaPercentual: number | null;
    qtdFornecedoresAtivos?: number;
    ticketMedio?: number;
    totalTransacoes?: number;
    startDate: string;
    endDate: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const getRange = (): { start: string; end: string } => {
    const end = new Date();
    const start = new Date();
    if (periodo === '7') start.setDate(start.getDate() - 6);
    else if (periodo === '30') start.setDate(start.getDate() - 29);
    else if (periodo === '90') start.setDate(start.getDate() - 89);
    else if (periodo === 'custom' && customStart && customEnd) return { start: customStart, end: customEnd };
    else start.setDate(start.getDate() - 29);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    };
  };

  useEffect(() => {
    setLoading(true);
    const { start, end } = getRange();
    api
      .get<typeof data>('/fornecedores/analysis', { params: { startDate: start, endDate: end } })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [periodo, customStart, customEnd]);

  if (loading && !data) return <div className="py-12 text-center text-[var(--color-text-muted)]">Carregando...</div>;
  if (!data) return <div className="py-12 text-center text-[var(--color-text-muted)]">Erro ao carregar análise.</div>;

  const { topFornecedores, totalGeral, dependenciaPercentual, qtdFornecedoresAtivos = 0, ticketMedio = 0 } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-[var(--color-text-muted)]">Período:</span>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as Periodo)}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm"
        >
          <option value="7">7 dias</option>
          <option value="30">30 dias</option>
          <option value="90">90 dias</option>
          <option value="custom">Personalizado</option>
        </select>
        {periodo === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm" />
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] text-sm" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-1">Total gasto (período)</h3>
          <p className="text-2xl font-bold text-[var(--color-text-main)]">{formatCurrency(totalGeral)}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-1">Fornecedores com movimentação</h3>
          <p className="text-2xl font-bold text-[var(--color-text-main)]">{qtdFornecedoresAtivos}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-1">Ticket médio por fornecedor</h3>
          <p className="text-2xl font-bold text-[var(--color-text-main)]">{formatCurrency(ticketMedio)}</p>
        </div>
        {dependenciaPercentual != null && topFornecedores[0] && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
            <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-1">Dependência (top 1)</h3>
            <p className="text-2xl font-bold text-[var(--color-primary)]">{dependenciaPercentual.toFixed(0)}%</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1 truncate" title={topFornecedores[0].supplier_name}>{topFornecedores[0].supplier_name}</p>
          </div>
        )}
      </div>

      {dependenciaPercentual != null && topFornecedores[0] && dependenciaPercentual >= 50 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400 text-sm">
          {dependenciaPercentual.toFixed(0)}% das suas compras com fornecedores vêm de <strong>{topFornecedores[0].supplier_name}</strong>. Avalie diversificar para reduzir dependência.
        </div>
      )}

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--color-text-main)] mb-4">Top fornecedores por gasto</h2>
        {topFornecedores.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">Nenhuma movimentação com fornecedor no período.</p>
        ) : (
          <ol className="space-y-3">
            {topFornecedores.map((f, i) => (
              <li key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                <span className="text-[var(--color-text-muted)] w-6">{i + 1}.</span>
                <span className="flex-1 text-[var(--color-text-main)] font-medium">{f.supplier_name}</span>
                <span className="text-[var(--color-text-muted)] text-sm mr-4">{f.quantidadeCompras} compra(s)</span>
                <span className="font-medium text-[var(--color-text-main)]">{formatCurrency(f.totalGasto)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

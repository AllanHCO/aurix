import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useBusinessAreas } from '../contexts/BusinessAreaContext';
import { formatCurrency, formatDate } from '../utils/format';
import SearchableSelect from './SearchableSelect';

type PeriodPreset = '7' | '30' | '90' | 'custom';

interface PurchaseHistoryItem {
  id: string;
  date: string;
  product_id: string;
  product_name: string;
  supplier_id: string | null;
  supplier_name: string | null;
  quantity: number;
  unit_cost: number;
  total: number;
  area_id: string | null;
  area_name: string | null;
  explicacao: string | null;
}

interface Summary {
  totalComprado: number;
  quantidadeCompras: number;
  ultimoFornecedor: { id: string; name: string } | null;
  produtoMaisComprado: { product_id: string; nome: string; quantidade: number } | null;
  fornecedorMaisUtilizado: { supplier_id: string; name: string; compras: number } | null;
}

interface HistoricoComprasTabProps {
  initialProductId?: string | null;
}

export default function HistoricoComprasTab({ initialProductId = null }: HistoricoComprasTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedAreaId } = useBusinessAreas();
  const [period, setPeriod] = useState<PeriodPreset>(() => (searchParams.get('period') as PeriodPreset) || '30');
  const [customStart, setCustomStart] = useState(searchParams.get('start_date') ?? '');
  const [customEnd, setCustomEnd] = useState(searchParams.get('end_date') ?? '');
  const [productId, setProductId] = useState(searchParams.get('product_id') || initialProductId || '');
  const [supplierId, setSupplierId] = useState(searchParams.get('supplier_id') || '');
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [items, setItems] = useState<PurchaseHistoryItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<{ id: string; nome: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api.get<{ id: string; nome: string }[]>('/produtos').then((r) => setProducts(r.data || [])).catch(() => setProducts([]));
    api.get<{ id: string; name: string }[]>('/fornecedores').then((r) => setSuppliers(r.data || [])).catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    const params: Record<string, string> = {
      period: period === 'custom' ? 'custom' : period,
      ...(period === 'custom' && customStart && customEnd ? { start_date: customStart, end_date: customEnd } : {})
    };
    if (selectedAreaId) params.business_area_id = selectedAreaId;
    if (productId) params.product_id = productId;
    if (supplierId) params.supplier_id = supplierId;
    if (search.trim()) params.search = search.trim();

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!next.get('aba')) next.set('aba', 'historico-compras');
      Object.entries(params).forEach(([k, v]) => next.set(k, v));
      return next;
    });
  }, [period, customStart, customEnd, selectedAreaId, productId, supplierId, search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string> = { period: period === 'custom' ? 'custom' : period };
    if (period === 'custom' && customStart && customEnd) {
      params.start_date = customStart;
      params.end_date = customEnd;
    }
    if (selectedAreaId) params.business_area_id = selectedAreaId;
    if (productId) params.product_id = productId;
    if (supplierId) params.supplier_id = supplierId;
    if (search.trim()) params.search = search.trim();

    api
      .get<{ items: PurchaseHistoryItem[]; summary: Summary }>('/produtos/historico-compras', { params })
      .then((r) => {
        if (!cancelled) {
          setItems(r.data?.items ?? []);
          setSummary(r.data?.summary ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [period, customStart, customEnd, selectedAreaId, productId, supplierId, search]);

  const showAreaColumn = !selectedAreaId;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filtros */}
      <div className="flex flex-col gap-4 p-4 rounded-xl border border-border bg-bg-elevated">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Período</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodPreset)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-text-main"
            >
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          {period === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Data inicial</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-text-main"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Data final</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-text-main"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Produto</label>
            <SearchableSelect
              options={products.map((p) => ({ value: p.id, label: p.nome }))}
              value={productId}
              onChange={setProductId}
              placeholder="Todos"
              allowClear
              emptyMessage="Nenhum produto"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Fornecedor</label>
            <SearchableSelect
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              value={supplierId}
              onChange={setSupplierId}
              placeholder="Todos"
              allowClear
              emptyMessage="Nenhum fornecedor"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Busca por nome do produto</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome do produto..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-text-main placeholder:text-text-muted"
            />
          </div>
        </div>
      </div>

      {/* Cards resumo */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border bg-bg-elevated">
            <p className="text-sm text-text-muted">Total comprado no período</p>
            <p className="text-xl font-bold text-text-main mt-1">{formatCurrency(summary.totalComprado)}</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-bg-elevated">
            <p className="text-sm text-text-muted">Quantidade de compras</p>
            <p className="text-xl font-bold text-text-main mt-1">{summary.quantidadeCompras}</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-bg-elevated">
            <p className="text-sm text-text-muted">Último fornecedor usado</p>
            <p className="text-lg font-semibold text-text-main mt-1 truncate" title={summary.ultimoFornecedor?.name ?? ''}>
              {summary.ultimoFornecedor?.name ?? '—'}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-bg-elevated">
            <p className="text-sm text-text-muted">Produto mais comprado</p>
            <p className="text-lg font-semibold text-text-main mt-1 truncate" title={summary.produtoMaisComprado ? `${summary.produtoMaisComprado.nome} — ${summary.produtoMaisComprado.quantidade} un.` : ''}>
              {summary.produtoMaisComprado ? `${summary.produtoMaisComprado.nome} — ${summary.produtoMaisComprado.quantidade} un.` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Destaques adicionais */}
      {summary?.fornecedorMaisUtilizado && (
        <div className="p-3 rounded-lg border border-border bg-bg-elevated text-sm text-text-muted">
          <span className="font-medium text-text-main">Fornecedor mais utilizado no período:</span>{' '}
          {summary.fornecedorMaisUtilizado.name} — {summary.fornecedorMaisUtilizado.compras} compras
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-text-muted">Nenhuma compra encontrada no período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-main">
                  <th className="text-left py-3 px-4 font-medium text-text-main">Data</th>
                  <th className="text-left py-3 px-4 font-medium text-text-main">Produto</th>
                  <th className="text-left py-3 px-4 font-medium text-text-main">Fornecedor</th>
                  <th className="text-right py-3 px-4 font-medium text-text-main">Quantidade</th>
                  <th className="text-right py-3 px-4 font-medium text-text-main">Custo unit.</th>
                  <th className="text-right py-3 px-4 font-medium text-text-main">Total</th>
                  {showAreaColumn && <th className="text-left py-3 px-4 font-medium text-text-main">Área</th>}
                  <th className="text-left py-3 px-4 font-medium text-text-main">Explicação</th>
                </tr>
              </thead>
              <tbody>
                {items.map((h) => (
                  <tr key={h.id} className="border-b border-border last:border-0 hover:bg-bg-main/50">
                    <td className="py-3 px-4 text-text-muted">{formatDate(h.date)}</td>
                    <td className="py-3 px-4 text-text-main font-medium">{h.product_name}</td>
                    <td className="py-3 px-4 text-text-muted">{h.supplier_name ?? '—'}</td>
                    <td className="py-3 px-4 text-right text-text-muted">{h.quantity}</td>
                    <td className="py-3 px-4 text-right text-text-muted">{formatCurrency(h.unit_cost)}</td>
                    <td className="py-3 px-4 text-right font-medium text-text-main">{formatCurrency(h.total)}</td>
                    {showAreaColumn && <td className="py-3 px-4 text-text-muted">{h.area_name ?? '—'}</td>}
                    <td className="py-3 px-4 text-text-muted max-w-[200px] truncate" title={h.explicacao ?? undefined}>{h.explicacao ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

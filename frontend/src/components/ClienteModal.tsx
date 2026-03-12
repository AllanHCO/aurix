import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { usePersonalizacao } from '../contexts/PersonalizacaoContext';
import { useBusinessAreas } from '../contexts/BusinessAreaContext';
import ClienteExtraItemModal, { type ClientExtraItem, type PendingExtraItemPayload } from './ClienteExtraItemModal';
import ModalPortal from './ModalPortal';
import SearchableSelect from './SearchableSelect';

const clienteSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  cpf: z.string().optional(),
  telefone: z.string().optional(),
  observacoes: z.string().optional(),
  time_futebol: z.string().optional(),
  business_area_id: z.string().optional()
});

type ClienteForm = z.infer<typeof clienteSchema>;

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

interface ClienteModalProps {
  cliente?: {
    id: string;
    nome: string;
    cpf?: string | null;
    telefone: string | null;
    observacoes: string | null;
    time_futebol?: string | null;
    business_area_id?: string | null;
  } | null;
  onClose: () => void;
}

export default function ClienteModal({ cliente, onClose }: ClienteModalProps) {
  const { getModuleConfig } = usePersonalizacao();
  const { areas: businessAreas, enabled: businessAreasEnabled, selectedAreaId } = useBusinessAreas();
  const clientesConfig = getModuleConfig('clientes');
  const extraDataEnabled = clientesConfig.ativar_dados_adicionais ?? false;

  const [extraItems, setExtraItems] = useState<ClientExtraItem[]>([]);
  const [extraItemsLoading, setExtraItemsLoading] = useState(false);
  const [pendingExtraItems, setPendingExtraItems] = useState<(PendingExtraItemPayload & { tempId: string })[]>([]);
  const [extraItemModalOpen, setExtraItemModalOpen] = useState(false);
  const [extraItemEditing, setExtraItemEditing] = useState<ClientExtraItem | (PendingExtraItemPayload & { tempId: string }) | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema)
  });

  const loadExtraItems = useCallback(async () => {
    if (!cliente?.id) return;
    setExtraItemsLoading(true);
    try {
      const res = await api.get<ClientExtraItem[]>(`/clientes/${cliente.id}/extra-items`);
      setExtraItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setExtraItems([]);
    } finally {
      setExtraItemsLoading(false);
    }
  }, [cliente?.id]);

  useEffect(() => {
    if (cliente?.id) loadExtraItems();
    else {
      setExtraItems([]);
      setPendingExtraItems([]);
    }
  }, [cliente?.id, loadExtraItems]);

  useEffect(() => {
    if (cliente) {
      reset({
        nome: cliente.nome,
        cpf: cliente.cpf || '',
        telefone: cliente.telefone || '',
        observacoes: cliente.observacoes || '',
        time_futebol: cliente.time_futebol || '',
        business_area_id: cliente.business_area_id ?? ''
      });
    } else {
      reset({
        nome: '',
        cpf: '',
        telefone: '',
        observacoes: '',
        time_futebol: '',
        business_area_id: selectedAreaId ?? ''
      });
    }
  }, [cliente, reset, selectedAreaId]);

  const handleDeleteExtraItem = async (item: ClientExtraItem) => {
    if (!cliente?.id || !window.confirm('Excluir este item?')) return;
    try {
      await api.delete(`/clientes/${cliente.id}/extra-items/${item.id}`);
      toast.success('Item removido.');
      loadExtraItems();
    } catch {
      toast.error('Erro ao excluir.');
    }
  };

  const handleDeletePendingItem = (item: PendingExtraItemPayload & { tempId: string }) => {
    if (!window.confirm('Excluir este item?')) return;
    setPendingExtraItems((prev) => prev.filter((x) => x.tempId !== item.tempId));
  };

  const handleSavedPendingItem = (payload: PendingExtraItemPayload) => {
    if (payload.tempId) {
      setPendingExtraItems((prev) =>
        prev.map((x) => (x.tempId === payload.tempId ? { ...payload, tempId: x.tempId } : x))
      );
    } else {
      setPendingExtraItems((prev) => [...prev, { ...payload, tempId: `pending-${Date.now()}` }]);
    }
  };

  const onSubmit = async (data: ClienteForm) => {
    try {
      const cpfDigits = data.cpf?.replace(/\D/g, '') ?? '';
      const payload: Record<string, unknown> = {
        nome: data.nome.trim(),
        cpf: cpfDigits.length === 11 ? formatCpf(data.cpf!) : undefined,
        telefone: data.telefone?.trim() || undefined,
        observacoes: data.observacoes?.trim() || undefined,
        time_futebol: data.time_futebol?.trim() || undefined
      };
      if (businessAreasEnabled) {
        payload.business_area_id = data.business_area_id?.trim() || null;
      }
      if (cliente) {
        await api.put(`/clientes/${cliente.id}`, payload);
        toast.success('Cliente atualizado com sucesso!');
        onClose();
      } else {
        const res = await api.post<{ id: string }>('/clientes', payload);
        const newClientId = res.data.id;
        for (const pending of pendingExtraItems) {
          await api.post(`/clientes/${newClientId}/extra-items`, {
            type: pending.type,
            title: pending.title,
            data_json: pending.data_json,
            show_on_quote: pending.show_on_quote,
            show_on_sale: pending.show_on_sale,
            internal_only: pending.internal_only
          });
        }
        toast.success('Cliente criado com sucesso!');
        onClose();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao salvar cliente');
    }
  };

  return (
    <ModalPortal>
      <div className="aurix-modal-overlay fixed inset-0 flex items-center justify-center p-4 overflow-y-auto" style={{ backgroundColor: 'var(--color-overlay)' }}>
        <div className="bg-bg-elevated border border-border-soft rounded-2xl shadow-xl max-w-2xl w-full my-auto max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-text-main">
            {cliente ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-elevated min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
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
              className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-base min-h-[44px] touch-manipulation"
            />
            {errors.nome && (
              <p className="text-error text-sm mt-1">{errors.nome.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              CPF
            </label>
            <input
              type="text"
              {...register('cpf')}
              maxLength={14}
              placeholder="000.000.000-00"
              onChange={(e) => {
                const formatted = formatCpf(e.target.value);
                e.target.value = formatted;
                setValue('cpf', formatted, { shouldValidate: true });
              }}
              className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-base min-h-[44px] touch-manipulation"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Telefone
            </label>
            <input
              type="text"
              {...register('telefone')}
              className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-base min-h-[44px] touch-manipulation"
              placeholder="(11) 99999-9999"
            />
            <p className="text-text-muted text-xs mt-1">
              Para reativar pelo WhatsApp, cadastre o número com DDD.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Observações
            </label>
            <textarea
              {...register('observacoes')}
              rows={4}
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="Anotações sobre o cliente..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Time de futebol
            </label>
            <input
              type="text"
              {...register('time_futebol')}
              className="w-full px-4 py-3 sm:py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-base min-h-[44px] touch-manipulation"
              placeholder="Ex: Corinthians"
            />
          </div>

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

          {extraDataEnabled && (
            <section id="dados-adicionais" className="rounded-xl border border-border bg-bg-main p-4 space-y-3">
              <h3 className="text-sm font-semibold text-text-main">Dados adicionais do cliente</h3>
              <p className="text-xs text-text-muted">
                Cadastre veículos, equipamentos ou outras informações vinculadas a este cliente.
              </p>
              <button
                id="botao-adicionar-dado"
                type="button"
                onClick={() => { setExtraItemEditing(null); setExtraItemModalOpen(true); }}
                className="inline-flex items-center gap-2 rounded-lg border border-primary text-primary px-3 py-2 text-sm font-medium hover:bg-primary/10"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Adicionar item
              </button>
              {cliente?.id ? (
                extraItemsLoading ? (
                  <p className="text-sm text-text-muted">Carregando...</p>
                ) : extraItems.length === 0 ? (
                  <p className="text-sm text-text-muted">Nenhum item cadastrado.</p>
                ) : (
                  <ul className="space-y-2">
                    {extraItems.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border bg-bg-card p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-text-main truncate">{it.title}</p>
                          <p className="text-xs text-text-muted capitalize">{it.type}</p>
                          {it.type === 'veiculo' && it.data_json?.placa && (
                            <p className="text-xs text-text-muted">Placa: {String(it.data_json.placa)}</p>
                          )}
                          {it.type === 'veiculo' && (it.data_json?.km != null) && (
                            <p className="text-xs text-text-muted">KM: {String(it.data_json.km)}</p>
                          )}
                          {it.type === 'equipamento' && it.data_json?.problema && (
                            <p className="text-xs text-text-muted">Problema: {String(it.data_json.problema)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => { setExtraItemEditing(it); setExtraItemModalOpen(true); }}
                            className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10"
                            aria-label="Editar"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExtraItem(it)}
                            className="p-2 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10"
                            aria-label="Excluir"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : pendingExtraItems.length === 0 ? (
                <p className="text-sm text-text-muted">Nenhum item adicionado.</p>
              ) : (
                <ul className="space-y-2">
                  {pendingExtraItems.map((it) => (
                    <li
                      key={it.tempId}
                      className="flex items-start justify-between gap-2 rounded-lg border border-border bg-bg-card p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-text-main truncate">{it.title}</p>
                        <p className="text-xs text-text-muted capitalize">{it.type}</p>
                        {it.type === 'veiculo' && it.data_json?.placa && (
                          <p className="text-xs text-text-muted">Placa: {String(it.data_json.placa)}</p>
                        )}
                        {it.type === 'veiculo' && (it.data_json?.km != null) && (
                          <p className="text-xs text-text-muted">KM: {String(it.data_json.km)}</p>
                        )}
                        {it.type === 'equipamento' && it.data_json?.problema && (
                          <p className="text-xs text-text-muted">Problema: {String(it.data_json.problema)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => { setExtraItemEditing(it); setExtraItemModalOpen(true); }}
                          className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10"
                          aria-label="Editar"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePendingItem(it)}
                          className="p-2 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10"
                          aria-label="Excluir"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-border rounded-lg text-text-main hover:bg-bg-elevated min-h-[44px] touch-manipulation"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-primary hover:bg-primary-hover text-text-on-primary font-bold px-4 py-3 rounded-lg min-h-[44px] touch-manipulation"
            >
              {cliente ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>

        {extraItemModalOpen && (
          <ClienteExtraItemModal
            clientId={cliente?.id ?? undefined}
            item={extraItemEditing}
            onClose={() => { setExtraItemModalOpen(false); setExtraItemEditing(null); }}
            onSaved={
              cliente?.id
                ? (loadExtraItems as () => void)
                : (payload: PendingExtraItemPayload) => {
                    handleSavedPendingItem(payload);
                  }
            }
          />
        )}
      </div>
    </div>
    </ModalPortal>
  );
}

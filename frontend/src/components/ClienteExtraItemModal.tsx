import { useEffect, useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import ToggleSwitch from './ToggleSwitch';
import ModalPortal from './ModalPortal';

export type ExtraItemType = 'veiculo' | 'equipamento' | 'outro';

export interface ClientExtraItem {
  id: string;
  client_id: string;
  type: ExtraItemType;
  title: string;
  data_json: Record<string, unknown>;
  show_on_quote: boolean;
  show_on_sale: boolean;
  internal_only: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Item em memória ao criar cliente novo (ainda sem client_id) */
export interface PendingExtraItemPayload {
  tempId?: string;
  type: ExtraItemType;
  title: string;
  data_json: Record<string, unknown>;
  show_on_quote: boolean;
  show_on_sale: boolean;
  internal_only: boolean;
}

const TIPO_LABELS: Record<ExtraItemType, string> = {
  veiculo: 'Veículo',
  equipamento: 'Equipamento',
  outro: 'Outro'
};

interface ClienteExtraItemModalProps {
  /** Quando undefined, modo "pendente": não chama API, chama onSaved(payload) */
  clientId?: string | null;
  item?: ClientExtraItem | (PendingExtraItemPayload & { tempId: string }) | null;
  onClose: () => void;
  /** Com clientId: refetch. Sem clientId: onSaved(payload) para o parent adicionar/atualizar na lista pendente */
  onSaved: (() => void) | ((payload: PendingExtraItemPayload) => void);
}

export default function ClienteExtraItemModal({ clientId, item, onClose, onSaved }: ClienteExtraItemModalProps) {
  const isPendingMode = clientId == null || clientId === '';
  const isEdit = Boolean(item && ('id' in item ? item.id : item.tempId));
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<ExtraItemType>(item?.type ?? 'veiculo');
  const [title, setTitle] = useState(item?.title ?? '');
  const [veiculo, setVeiculo] = useState({
    marca_modelo: (item?.type === 'veiculo' && item?.data_json ? String(item.data_json.marca_modelo ?? '') : ''),
    placa: (item?.type === 'veiculo' && item?.data_json ? String(item.data_json.placa ?? '') : ''),
    km: (item?.type === 'veiculo' && item?.data_json ? String((item.data_json.km as number) ?? '') : ''),
    ano: (item?.type === 'veiculo' && item?.data_json ? String((item.data_json.ano as number) ?? '') : ''),
    observacao: (item?.type === 'veiculo' && item?.data_json ? String(item.data_json.observacao ?? '') : '')
  });
  const [equipamento, setEquipamento] = useState({
    tipo_equipamento: (item?.type === 'equipamento' && item?.data_json ? String(item.data_json.tipo_equipamento ?? '') : ''),
    marca_modelo: (item?.type === 'equipamento' && item?.data_json ? String(item.data_json.marca_modelo ?? '') : ''),
    numero_serie_imei: (item?.type === 'equipamento' && item?.data_json ? String(item.data_json.numero_serie_imei ?? '') : ''),
    problema: (item?.type === 'equipamento' && item?.data_json ? String(item.data_json.problema ?? '') : ''),
    observacao: (item?.type === 'equipamento' && item?.data_json ? String(item.data_json.observacao ?? '') : '')
  });
  const [outro, setOutro] = useState({
    titulo: (item?.type === 'outro' && item?.data_json ? String(item.data_json.titulo ?? '') : ''),
    descricao: (item?.type === 'outro' && item?.data_json ? String(item.data_json.descricao ?? '') : '')
  });
  const [showOnQuote, setShowOnQuote] = useState(item?.show_on_quote ?? true);
  const [showOnSale, setShowOnSale] = useState(item?.show_on_sale ?? true);
  const [internalOnly, setInternalOnly] = useState(item?.internal_only ?? false);

  useEffect(() => {
    if (item) {
      setType(item.type);
      setTitle(item.title);
      setShowOnQuote(item.show_on_quote ?? true);
      setShowOnSale(item.show_on_sale ?? true);
      setInternalOnly(item.internal_only ?? false);
      if (item.type === 'veiculo' && item.data_json) {
        setVeiculo({
          marca_modelo: String(item.data_json.marca_modelo ?? ''),
          placa: String(item.data_json.placa ?? ''),
          km: String((item.data_json.km as number) ?? ''),
          ano: String((item.data_json.ano as number) ?? ''),
          observacao: String(item.data_json.observacao ?? '')
        });
      }
      if (item.type === 'equipamento' && item.data_json) {
        setEquipamento({
          tipo_equipamento: String(item.data_json.tipo_equipamento ?? ''),
          marca_modelo: String(item.data_json.marca_modelo ?? ''),
          numero_serie_imei: String(item.data_json.numero_serie_imei ?? ''),
          problema: String(item.data_json.problema ?? ''),
          observacao: String(item.data_json.observacao ?? '')
        });
      }
      if (item.type === 'outro' && item.data_json) {
        setOutro({
          titulo: String(item.data_json.titulo ?? ''),
          descricao: String(item.data_json.descricao ?? '')
        });
      }
    }
  }, [item]);

  const getDataJson = (): Record<string, unknown> => {
    if (type === 'veiculo') {
      return {
        marca_modelo: veiculo.marca_modelo || undefined,
        placa: veiculo.placa || undefined,
        km: veiculo.km ? Number(veiculo.km) : undefined,
        ano: veiculo.ano ? Number(veiculo.ano) : undefined,
        observacao: veiculo.observacao || undefined
      };
    }
    if (type === 'equipamento') {
      return {
        tipo_equipamento: equipamento.tipo_equipamento || undefined,
        marca_modelo: equipamento.marca_modelo || undefined,
        numero_serie_imei: equipamento.numero_serie_imei || undefined,
        problema: equipamento.problema || undefined,
        observacao: equipamento.observacao || undefined
      };
    }
    return {
      titulo: outro.titulo || undefined,
      descricao: outro.descricao || undefined
    };
  };

  const getComputedTitle = (): string => {
    if (type === 'veiculo') return [veiculo.marca_modelo, veiculo.placa].filter(Boolean).join(' — ') || 'Veículo';
    if (type === 'equipamento') return equipamento.marca_modelo || equipamento.tipo_equipamento || 'Equipamento';
    return outro.titulo || 'Item';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data_json = getDataJson();
    const titleToSend = title.trim() || getComputedTitle();
    if (!titleToSend) {
      toast.error('Informe um título ou preencha os campos do item.');
      return;
    }
    const payload = {
      type,
      title: titleToSend,
      data_json,
      show_on_quote: showOnQuote,
      show_on_sale: showOnSale,
      internal_only: internalOnly
    };

    if (isPendingMode) {
      const pendingPayload: PendingExtraItemPayload = {
        ...payload,
        tempId: item && 'tempId' in item ? item.tempId : undefined
      };
      (onSaved as (p: PendingExtraItemPayload) => void)(pendingPayload);
      toast.success(isEdit ? 'Item atualizado.' : 'Item adicionado.');
      onClose();
      return;
    }

    setSaving(true);
    try {
      if (isEdit && item && 'id' in item) {
        await api.put(`/clientes/${clientId}/extra-items/${item.id}`, payload);
        toast.success('Item atualizado.');
      } else {
        await api.post(`/clientes/${clientId}/extra-items`, payload);
        toast.success('Item adicionado.');
      }
      (onSaved as () => void)();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="aurix-modal-overlay fixed inset-0 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-overlay)' }} onClick={onClose}>
        <div
          className="bg-bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-bold text-text-main">
            {isEdit ? 'Editar item' : 'Adicionar item'}
          </h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-text-muted hover:text-text-main">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Tipo do item</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ExtraItemType)}
              className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
            >
              <option value="veiculo">{TIPO_LABELS.veiculo}</option>
              <option value="equipamento">{TIPO_LABELS.equipamento}</option>
              <option value="outro">{TIPO_LABELS.outro}</option>
            </select>
          </div>

          {type === 'veiculo' && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Marca / Modelo</label>
                <input
                  type="text"
                  value={veiculo.marca_modelo}
                  onChange={(e) => setVeiculo((p) => ({ ...p, marca_modelo: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
                  placeholder="Ex: Gol 2018"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Placa</label>
                <input
                  type="text"
                  value={veiculo.placa}
                  onChange={(e) => setVeiculo((p) => ({ ...p, placa: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
                  placeholder="ABC-1234"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">KM atual</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={veiculo.km}
                    onChange={(e) => setVeiculo((p) => ({ ...p, km: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Ano</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={veiculo.ano}
                    onChange={(e) => setVeiculo((p) => ({ ...p, ano: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Observação</label>
                <textarea
                  value={veiculo.observacao}
                  onChange={(e) => setVeiculo((p) => ({ ...p, observacao: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
                />
              </div>
            </>
          )}

          {type === 'equipamento' && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Tipo do equipamento</label>
                <input
                  type="text"
                  value={equipamento.tipo_equipamento}
                  onChange={(e) => setEquipamento((p) => ({ ...p, tipo_equipamento: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
                  placeholder="Ex: Celular"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Marca / Modelo</label>
                <input
                  type="text"
                  value={equipamento.marca_modelo}
                  onChange={(e) => setEquipamento((p) => ({ ...p, marca_modelo: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
                  placeholder="Ex: iPhone 11"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Número de série / IMEI</label>
                <input
                  type="text"
                  value={equipamento.numero_serie_imei}
                  onChange={(e) => setEquipamento((p) => ({ ...p, numero_serie_imei: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Problema relatado</label>
                <input
                  type="text"
                  value={equipamento.problema}
                  onChange={(e) => setEquipamento((p) => ({ ...p, problema: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
                  placeholder="Ex: tela quebrada"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Observação</label>
                <textarea
                  value={equipamento.observacao}
                  onChange={(e) => setEquipamento((p) => ({ ...p, observacao: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
                />
              </div>
            </>
          )}

          {type === 'outro' && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Título</label>
                <input
                  type="text"
                  value={outro.titulo}
                  onChange={(e) => setOutro((p) => ({ ...p, titulo: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Descrição</label>
                <textarea
                  value={outro.descricao}
                  onChange={(e) => setOutro((p) => ({ ...p, descricao: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
                />
              </div>
            </>
          )}

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium text-text-main">Opções de exibição</p>
            <ToggleSwitch checked={showOnQuote} onChange={setShowOnQuote} label="Mostrar no orçamento" />
            <ToggleSwitch checked={showOnSale} onChange={setShowOnSale} label="Mostrar na venda" />
            <ToggleSwitch checked={internalOnly} onChange={setInternalOnly} label="Apenas interno" />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-text-main hover:bg-bg-main"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary text-[var(--color-text-on-primary)] font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : isEdit ? 'Atualizar' : 'Adicionar'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </ModalPortal>
  );
}

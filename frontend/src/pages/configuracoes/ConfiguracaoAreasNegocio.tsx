import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import ModalPortal from '../../components/ModalPortal';
import TableActionsMenu from '../../components/TableActionsMenu';
import { useBusinessAreas } from '../../contexts/BusinessAreaContext';

export interface BusinessArea {
  id: string;
  name: string;
  color: string | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

const CORES_PREDEFINIDAS = [
  '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1'
];

export default function ConfiguracaoAreasNegocio() {
  const { refetch: refetchAreasContext } = useBusinessAreas();
  const [areas, setAreas] = useState<BusinessArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState<'create' | 'edit' | null>(null);
  const [editingArea, setEditingArea] = useState<BusinessArea | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const url = showInactive ? '/configuracoes/business-areas?all=true' : '/configuracoes/business-areas';
      const res = await api.get<BusinessArea[]>(url);
      setAreas(res.data);
    } catch {
      toast.error('Erro ao carregar áreas de negócio');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingArea(null);
    setName('');
    setColor('');
    setModalOpen('create');
  };

  const openEdit = (area: BusinessArea) => {
    setEditingArea(area);
    setName(area.name);
    setColor(area.color ?? '');
    setModalOpen('edit');
  };

  const closeModal = () => {
    setModalOpen(null);
    setEditingArea(null);
    setName('');
    setColor('');
    load();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTrim = name.trim();
    if (!nomeTrim) {
      toast.error('Nome da área é obrigatório');
      return;
    }
    const payload = {
      name: nomeTrim,
      color: color.trim() && /^#[0-9A-Fa-f]{6}$/.test(color.trim()) ? color.trim() : null,
      is_active: true
    };
    try {
      setSaving(true);
      if (editingArea) {
        await api.put(`/configuracoes/business-areas/${editingArea.id}`, payload);
        toast.success('Área atualizada');
      } else {
        await api.post('/configuracoes/business-areas', payload);
        toast.success('Área criada');
      }
      closeModal();
      refetchAreasContext();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (area: BusinessArea) => {
    try {
      await api.put(`/configuracoes/business-areas/${area.id}`, { is_active: !area.is_active });
      toast.success(area.is_active ? 'Área desativada' : 'Área ativada');
      load();
      refetchAreasContext();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao atualizar');
    }
  };

  const handleDelete = async (area: BusinessArea) => {
    if (!confirm(`Desativar a área "${area.name}"? Os registros vinculados permanecerão, mas a área não aparecerá nas opções.`)) return;
    try {
      await api.delete(`/configuracoes/business-areas/${area.id}`);
      toast.success('Área desativada');
      load();
      refetchAreasContext();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao desativar');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link to="/configuracoes" className="hover:text-text-main">Configurações</Link>
        <span>/</span>
        <span className="text-text-main">Áreas de negócio</span>
      </div>
      <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">account_tree</span>
        Áreas de negócio
      </h1>
      <p className="text-text-muted">
        Use áreas para separar frentes do mesmo negócio (ex.: Mecânica, Funilaria). Você pode ver o resultado de cada área separadamente ou o total consolidado.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-border"
          />
          Mostrar áreas desativadas
        </label>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2.5 rounded-lg bg-primary text-text-on-primary font-medium flex items-center gap-2"
        >
          <span className="material-symbols-outlined">add</span>
          Nova área
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-text-muted">Carregando...</div>
      ) : areas.length === 0 ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-text-muted mb-4 block">account_tree</span>
          <h3 className="text-lg font-semibold text-text-main mb-2">Nenhuma área cadastrada</h3>
          <p className="text-text-muted mb-6">
            Crie áreas para ver resultados separados (ex.: Mecânica, Funilaria) e o total consolidado.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2.5 rounded-lg bg-primary text-text-on-primary font-medium"
          >
            Criar primeira área
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated">
                <th className="text-left py-3 px-4 font-medium text-text-muted">Nome</th>
                <th className="text-left py-3 px-4 font-medium text-text-muted">Cor</th>
                <th className="text-center py-3 px-4 font-medium text-text-muted">Status</th>
                <th className="table-actions-col text-right py-3 px-4 font-medium text-text-muted w-[100px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => (
                <tr key={area.id} className="border-b border-border last:border-0 hover:bg-bg-elevated/50">
                  <td className="py-3 px-4 font-medium text-text-main">{area.name}</td>
                  <td className="py-3 px-4">
                    {area.color ? (
                      <span
                        className="inline-block w-6 h-6 rounded-full border border-border shrink-0"
                        style={{ backgroundColor: area.color }}
                        title={area.color}
                      />
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        area.is_active ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-bg-elevated text-text-muted'
                      }`}
                    >
                      {area.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="table-actions-col py-3 px-4 text-right">
                    <TableActionsMenu
                      iconSize="md"
                      items={[
                        { label: 'Editar', icon: 'edit', onClick: () => openEdit(area) },
                        {
                          label: area.is_active ? 'Desativar' : 'Ativar',
                          icon: area.is_active ? 'toggle_off' : 'toggle_on',
                          onClick: () => handleToggleActive(area)
                        },
                        { label: 'Desativar área', icon: 'delete', onClick: () => handleDelete(area), danger: true }
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(modalOpen === 'create' || modalOpen === 'edit') && (
        <ModalPortal>
          <div
            className="aurix-modal-overlay fixed inset-0 flex items-center justify-center p-4"
            style={{ backgroundColor: 'var(--color-overlay)' }}
            onClick={closeModal}
          >
            <div
              className="bg-bg-card rounded-xl border border-border shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-text-main mb-4">
                {editingArea ? 'Editar área' : 'Nova área de negócio'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Nome da área *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Mecânica, Funilaria"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg-main text-text-main"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">Cor (opcional)</label>
                  <p className="text-xs text-text-muted mb-2">Para badges e gráficos. Formato: #RRGGBB</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    {CORES_PREDEFINIDAS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          color === c ? 'border-primary scale-110' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="#3B82F6"
                      className="w-24 px-2 py-1.5 rounded border border-border bg-bg-main text-text-main text-sm font-mono"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={closeModal} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-text-main">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-text-on-primary font-medium disabled:opacity-50">
                    {saving ? 'Salvando...' : editingArea ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

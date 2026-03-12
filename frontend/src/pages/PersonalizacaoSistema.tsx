import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { usePersonalizacao } from '../contexts/PersonalizacaoContext';
import ToggleSwitch from '../components/ToggleSwitch';
import ModalPortal from '../components/ModalPortal';

type ModoPreset = 'padrao' | 'barbearia' | 'mecanica' | 'assistencia_tecnica' | 'estetica' | 'personalizado';

interface ModuloBase {
  active: boolean;
  name: string;
}

interface PersonalizacaoPayload {
  modo: ModoPreset;
  modulos: {
    clientes: ModuloBase & Record<string, unknown>;
    produtos: ModuloBase & Record<string, unknown>;
    vendas: ModuloBase & Record<string, unknown>;
    agendamentos: ModuloBase & Record<string, unknown>;
    relatorios: ModuloBase & Record<string, unknown>;
    marketing: ModuloBase & Record<string, unknown>;
    financeiro: ModuloBase & Record<string, unknown>;
    sistema: ModuloBase & { usar_areas_negocio?: boolean };
  };
}

const MODULE_KEYS = ['clientes', 'produtos', 'vendas', 'agendamentos', 'relatorios', 'marketing', 'financeiro', 'sistema'] as const;
type ModuleKey = (typeof MODULE_KEYS)[number];

const MODULE_META: Record<ModuleKey, { icon: string; labelPadrao: string }> = {
  clientes: { icon: 'group', labelPadrao: 'Clientes' },
  produtos: { icon: 'inventory_2', labelPadrao: 'Produtos' },
  vendas: { icon: 'payments', labelPadrao: 'Vendas' },
  agendamentos: { icon: 'calendar_month', labelPadrao: 'Agendamentos' },
  relatorios: { icon: 'bar_chart', labelPadrao: 'Relatórios' },
  marketing: { icon: 'campaign', labelPadrao: 'Marketing' },
  financeiro: { icon: 'account_balance_wallet', labelPadrao: 'Financeiro' },
  sistema: { icon: 'settings', labelPadrao: 'Sistema' }
};

const PRESET_OPTIONS: ModoPreset[] = ['padrao', 'barbearia', 'mecanica', 'assistencia_tecnica', 'estetica', 'personalizado'];

const PRESET_LABELS: Record<ModoPreset, string> = {
  padrao: 'Padrão',
  barbearia: 'Barbearia',
  mecanica: 'Mecânica',
  assistencia_tecnica: 'Assistência técnica',
  estetica: 'Estética',
  personalizado: 'Personalizado'
};

export default function PersonalizacaoSistema() {
  const { refetch } = usePersonalizacao();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<PersonalizacaoPayload | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<PersonalizacaoPayload>('/configuracoes/personalizacao');
      setData(res.data);
    } catch {
      toast.error('Erro ao carregar personalização');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = useCallback(async (modo: ModoPreset) => {
    try {
      const res = await api.get<PersonalizacaoPayload>(`/configuracoes/personalizacao/preset?modo=${modo}`);
      setData(res.data);
      toast.success(`Preset "${PRESET_LABELS[modo]}" aplicado. Salve para confirmar.`);
    } catch {
      toast.error('Erro ao aplicar preset');
    }
  }, []);

  const save = useCallback(async () => {
    if (!data) return;
    try {
      setSaving(true);
      await api.put('/configuracoes/personalizacao', data);
      toast.success('Personalização salva com sucesso.');
      setPreviewOpen(false);
      load();
      await refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }, [data, load, refetch]);

  const resetar = useCallback(async () => {
    if (!window.confirm('Deseja restaurar as configurações padrão? Esta ação não pode ser desfeita.')) return;
    try {
      setResetting(true);
      const res = await api.post<{ data: PersonalizacaoPayload }>('/configuracoes/personalizacao/resetar');
      setData(res.data.data);
      setPreviewOpen(false);
      toast.success('Configurações padrão restauradas.');
      await refetch();
    } catch {
      toast.error('Erro ao restaurar padrão');
    } finally {
      setResetting(false);
    }
  }, [refetch]);

  const updateModulo = useCallback(<K extends ModuleKey>(key: K, patch: Partial<PersonalizacaoPayload['modulos'][K]>) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        modulos: {
          ...prev.modulos,
          [key]: { ...prev.modulos[key], ...patch }
        }
      };
    });
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center py-12">
        <span className="text-text-muted">Carregando personalização...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <p className="text-text-muted mb-4">Não foi possível carregar as configurações.</p>
        <button type="button" onClick={() => load()} className="rounded-lg bg-primary text-[var(--color-text-on-primary)] px-4 py-2 text-sm font-medium">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <header>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Link to="/configuracoes" className="hover:text-text-main">Configurações</Link>
          <span>/</span>
          <span className="text-text-main">Personalização</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-main mt-2">Personalização</h1>
        <p className="text-text-muted mt-1">Preset de nicho e nomes dos módulos. Altere o comportamento do sistema sem criar outra central.</p>
      </header>

      {/* Preset de nicho */}
      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6">
        <h2 className="text-lg font-semibold text-text-main mb-3">Preset de nicho</h2>
        <p className="text-sm text-text-muted mb-4">Escolha um perfil para aplicar nomes e opções sugeridas. Depois você pode ajustar e salvar.</p>
        <select
          value={data.modo}
          onChange={(e) => applyPreset(e.target.value as ModoPreset)}
          className="w-full rounded-lg border border-border bg-bg-main px-3 py-2.5 text-text-main"
        >
          {PRESET_OPTIONS.map((m) => (
            <option key={m} value={m}>{PRESET_LABELS[m]}</option>
          ))}
        </select>
      </section>

      {/* Recursos avançados - Áreas de negócio */}
      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-main">Áreas de negócio</h2>
        <p className="text-sm text-text-muted">
          Ative para separar resultados por áreas (ex.: Mecânica, Funilaria) e usar o seletor global de área no topo do sistema.
        </p>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-text-main">Usar áreas de negócio</span>
            <span className="text-xs text-text-muted">
              Quando desligado, o sistema funciona como empresa única, sem campos ou filtros de área.
            </span>
          </div>
          <ToggleSwitch
            inline={false}
            checked={data.modulos.sistema.usar_areas_negocio === true}
            onChange={(v) => updateModulo('sistema', { usar_areas_negocio: v })}
          />
        </div>
      </section>

      {/* Renomear e ativar/desativar módulos */}
      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6">
        <h2 className="text-lg font-semibold text-text-main mb-3">Módulos</h2>
        <p className="text-sm text-text-muted mb-4">Nome exibido no menu e nas telas. Desative para ocultar o módulo do sistema.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 pr-2 text-sm font-medium text-text-muted">Módulo</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-text-muted">Nome exibido</th>
                <th className="text-left py-3 pl-2 text-sm font-medium text-text-muted w-24">Ativo</th>
              </tr>
            </thead>
            <tbody>
              {MODULE_KEYS.map((key) => {
                const mod = data.modulos[key];
                const meta = MODULE_META[key];
                return (
                  <tr key={key} className="border-b border-border last:border-0">
                    <td className="py-3 pr-2">
                      <span className="flex items-center gap-2 text-text-main">
                        <span className="material-symbols-outlined text-primary text-lg">{meta.icon}</span>
                        {meta.labelPadrao}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="text"
                        value={mod.name}
                        onChange={(e) => updateModulo(key, { name: e.target.value })}
                        className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-sm text-text-main"
                        placeholder={meta.labelPadrao}
                      />
                    </td>
                    <td className="py-3 pl-2">
                      <ToggleSwitch
                        inline={false}
                        checked={mod.active}
                        onChange={(active) => updateModulo(key, { active })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ações */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-main text-text-main px-4 py-2 text-sm font-medium hover:bg-bg-card"
        >
          <span className="material-symbols-outlined text-lg">visibility</span>
          Visualizar mudanças
        </button>
        <button
          type="button"
          onClick={resetar}
          disabled={resetting}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-main text-text-main px-4 py-2 text-sm font-medium hover:bg-bg-card disabled:opacity-50"
        >
          {resetting ? 'Restaurando...' : 'Restaurar padrão do sistema'}
          <span className="material-symbols-outlined text-lg">restart_alt</span>
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-[var(--color-text-on-primary)] px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 ml-auto"
        >
          {saving ? 'Salvando...' : 'Salvar'}
          <span className="material-symbols-outlined text-lg">save</span>
        </button>
      </div>

      {previewOpen && (
        <PreviewModal data={data} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}

function PreviewModal({ data, onClose }: { data: PersonalizacaoPayload; onClose: () => void }) {
  const MENU_ORDER: ModuleKey[] = ['clientes', 'produtos', 'vendas', 'agendamentos', 'relatorios'];
  const ocultos = MODULE_KEYS.filter((k) => !data.modulos[k].active);

  return (
    <ModalPortal>
      <div className="aurix-modal-overlay fixed inset-0 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-overlay)' }} onClick={onClose}>
        <div
          className="rounded-xl border border-border bg-bg-card shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-6"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-main">Visualizar mudanças</h2>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text-main p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="text-sm text-text-muted mb-4">Modo: <strong>{PRESET_LABELS[data.modo]}</strong></p>

        <h3 className="text-sm font-semibold text-text-main mt-4 mb-2">Preview do menu lateral</h3>
        <ul className="space-y-1.5 text-sm border border-border rounded-lg p-3 bg-bg-main">
          <li className="flex items-center gap-2 text-text-main">
            <span className="material-symbols-outlined text-lg text-primary">dashboard</span>
            Dashboard
          </li>
          {MENU_ORDER.map((key) => {
            const mod = data.modulos[key];
            const meta = MODULE_META[key];
            return mod.active ? (
              <li key={key} className="flex items-center gap-2 text-text-main">
                <span className="material-symbols-outlined text-lg text-primary">{meta.icon}</span>
                {mod.name}
              </li>
            ) : (
              <li key={key} className="flex items-center gap-2 text-text-muted line-through">
                <span className="material-symbols-outlined text-lg">{meta.icon}</span>
                {mod.name} (oculto)
              </li>
            );
          })}
          <li className="flex items-center gap-2 text-text-muted pt-1 border-t border-border mt-1">
            <span className="material-symbols-outlined text-lg">settings</span>
            Configurações
          </li>
        </ul>

        {ocultos.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-text-main mt-4 mb-2">Módulos ocultos</h3>
            <p className="text-xs text-text-muted">Não aparecerão no menu.</p>
            <ul className="list-disc list-inside text-sm text-text-muted mt-1">
              {ocultos.map((k) => (
                <li key={k}>{data.modulos[k].name || MODULE_META[k].labelPadrao}</li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-border bg-bg-main text-text-main px-4 py-2 text-sm font-medium">
            Fechar
          </button>
        </div>
        </div>
      </div>
    </ModalPortal>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import { usePersonalizacao } from '../../contexts/PersonalizacaoContext';
import ToggleSwitch from '../../components/ToggleSwitch';

interface ConfigResponse {
  retencao: { dias_atencao: number; dias_inativo: number };
}

interface ModuloClientes {
  active: boolean;
  name: string;
  ativar_dados_adicionais?: boolean;
  mostrar_dados_adicionais_orcamento?: boolean;
  mostrar_dados_adicionais_venda?: boolean;
}

interface PersonalizacaoPayload {
  modo: string;
  modulos: { clientes: ModuloClientes; [k: string]: unknown };
}

export default function ConfiguracaoClientes() {
  const { refetch } = usePersonalizacao();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [diasAtencao, setDiasAtencao] = useState(30);
  const [diasInativo, setDiasInativo] = useState(45);
  const [ativarDadosAdicionais, setAtivarDadosAdicionais] = useState(false);
  const [mostrarDadosAdicionaisOrcamento, setMostrarDadosAdicionaisOrcamento] = useState(false);
  const [mostrarDadosAdicionaisVenda, setMostrarDadosAdicionaisVenda] = useState(false);
  const [personalizacaoFull, setPersonalizacaoFull] = useState<PersonalizacaoPayload | null>(null);

  const load = useCallback(async () => {
    try {
      const [configRes, persRes] = await Promise.all([
        api.get<ConfigResponse>('/configuracoes'),
        api.get<PersonalizacaoPayload>('/configuracoes/personalizacao')
      ]);
      setDiasAtencao(configRes.data.retencao.dias_atencao);
      setDiasInativo(configRes.data.retencao.dias_inativo);
      setPersonalizacaoFull(persRes.data);
      const c = persRes.data.modulos.clientes;
      setAtivarDadosAdicionais(c.ativar_dados_adicionais ?? false);
      setMostrarDadosAdicionaisOrcamento(c.mostrar_dados_adicionais_orcamento ?? false);
      setMostrarDadosAdicionaisVenda(c.mostrar_dados_adicionais_venda ?? false);
    } catch {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (diasAtencao >= diasInativo) {
      toast.error('Dias para Atenção deve ser menor que Dias para Inativo.');
      return;
    }
    if (diasAtencao < 1 || diasAtencao > 365 || diasInativo < 1 || diasInativo > 365) {
      toast.error('Dias devem estar entre 1 e 365.');
      return;
    }
    try {
      setSaving(true);
      await api.put('/configuracoes', {
        retencao: { dias_atencao: diasAtencao, dias_inativo: diasInativo }
      });
      if (personalizacaoFull) {
        const updated = {
          ...personalizacaoFull,
          modulos: {
            ...personalizacaoFull.modulos,
            clientes: {
              ...personalizacaoFull.modulos.clientes,
              ativar_dados_adicionais: ativarDadosAdicionais,
              mostrar_dados_adicionais_orcamento: mostrarDadosAdicionaisOrcamento,
              mostrar_dados_adicionais_venda: mostrarDadosAdicionaisVenda
            }
          }
        };
        await api.put('/configuracoes/personalizacao', updated);
      }
      toast.success('Configurações salvas.');
      load();
      await refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-text-muted">Carregando...</div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link to="/configuracoes" className="hover:text-text-main">Configurações</Link>
        <span>/</span>
        <span className="text-text-main">Clientes</span>
      </div>
      <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">group</span>
        Clientes
      </h1>
      <p className="text-text-muted">Regras de retenção: quando o cliente entra em Atenção e Inativo.</p>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Dias para Atenção</label>
            <input
              type="number"
              min={1}
              max={365}
              value={diasAtencao}
              onChange={(e) => setDiasAtencao(Number(e.target.value) || 30)}
              className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Dias para Inativo</label>
            <input
              type="number"
              min={1}
              max={365}
              value={diasInativo}
              onChange={(e) => setDiasInativo(Number(e.target.value) || 45)}
              className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main"
            />
          </div>
        </div>
        <p className="text-xs text-text-muted">Atenção deve ser menor que Inativo.</p>
      </section>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-main">Dados adicionais do cliente</h2>
        <p className="text-sm text-text-muted">Veículos, equipamentos e outros campos extras. Defina onde esses dados aparecem.</p>
        <ToggleSwitch
          checked={ativarDadosAdicionais}
          onChange={setAtivarDadosAdicionais}
          label="Ativar dados adicionais do cliente"
        />
        {ativarDadosAdicionais && (
          <>
            <div className="pl-4 border-l-2 border-border">
              <ToggleSwitch
                checked={mostrarDadosAdicionaisOrcamento}
                onChange={setMostrarDadosAdicionaisOrcamento}
                label="Mostrar dados adicionais no orçamento"
              />
            </div>
            <div className="pl-4 border-l-2 border-border">
              <ToggleSwitch
                checked={mostrarDadosAdicionaisVenda}
                onChange={setMostrarDadosAdicionaisVenda}
                label="Mostrar dados adicionais na venda"
              />
            </div>
          </>
        )}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary text-[var(--color-text-on-primary)] px-6 py-2.5 font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? 'Salvando...' : 'Salvar'}
          <span className="material-symbols-outlined text-lg">save</span>
        </button>
      </div>
    </div>
  );
}

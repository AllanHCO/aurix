import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import ToggleSwitch from '../../components/ToggleSwitch';

interface PersonalizacaoModulos {
  financeiro: { name: string; ativar_controle_despesas: boolean; mostrar_lucro_dashboard: boolean; mostrar_grafico_financeiro: boolean };
  [key: string]: unknown;
}

export default function ConfiguracaoFinanceiro() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('Financeiro');
  const [ativarControleDespesas, setAtivarControleDespesas] = useState(false);
  const [mostrarLucroDashboard, setMostrarLucroDashboard] = useState(false);
  const [mostrarGraficoFinanceiro, setMostrarGraficoFinanceiro] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ modulos: PersonalizacaoModulos }>('/configuracoes/personalizacao');
      const f = res.data.modulos.financeiro;
      setName(f.name);
      setAtivarControleDespesas(f.ativar_controle_despesas);
      setMostrarLucroDashboard(f.mostrar_lucro_dashboard);
      setMostrarGraficoFinanceiro(f.mostrar_grafico_financeiro);
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
    try {
      setSaving(true);
      const res = await api.get<{ modulos: PersonalizacaoModulos }>('/configuracoes/personalizacao');
      const next = { ...res.data, modulos: { ...res.data.modulos, financeiro: { ...res.data.modulos.financeiro, name, ativar_controle_despesas: ativarControleDespesas, mostrar_lucro_dashboard: mostrarLucroDashboard, mostrar_grafico_financeiro: mostrarGraficoFinanceiro } } };
      await api.put('/configuracoes/personalizacao', next);
      toast.success('Configurações salvas.');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="max-w-2xl mx-auto py-12 text-text-muted">Carregando...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link to="/configuracoes" className="hover:text-text-main">Configurações</Link>
        <span>/</span>
        <span className="text-text-main">Financeiro</span>
      </div>
      <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
        Financeiro
      </h1>
      <p className="text-text-muted">Controle de despesas e exibição de lucro (preparado para expansão).</p>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Nome do módulo</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Financeiro / Fluxo de caixa" className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted" />
        </div>
        <ToggleSwitch checked={ativarControleDespesas} onChange={setAtivarControleDespesas} label="Ativar controle de despesas" />
        <ToggleSwitch checked={mostrarLucroDashboard} onChange={setMostrarLucroDashboard} label="Mostrar lucro no dashboard" />
        <ToggleSwitch checked={mostrarGraficoFinanceiro} onChange={setMostrarGraficoFinanceiro} label="Mostrar gráfico financeiro" />
        <p className="text-xs text-text-muted">Categorias de despesas e regras de entradas/saídas: em breve.</p>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-primary text-[var(--color-text-on-primary)] px-6 py-2.5 font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
          {saving ? 'Salvando...' : 'Salvar'}
          <span className="material-symbols-outlined text-lg">save</span>
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import ToggleSwitch from '../../components/ToggleSwitch';

interface PersonalizacaoModulos {
  relatorios: { name: string; permitir_exportacao_csv: boolean; mostrar_comparacao_periodos: boolean };
  [key: string]: unknown;
}

export default function ConfiguracaoRelatorios() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('Relatórios');
  const [permitirExportacaoCsv, setPermitirExportacaoCsv] = useState(true);
  const [mostrarComparacaoPeriodos, setMostrarComparacaoPeriodos] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ modulos: PersonalizacaoModulos }>('/configuracoes/personalizacao');
      const r = res.data.modulos.relatorios;
      setName(r.name);
      setPermitirExportacaoCsv(r.permitir_exportacao_csv);
      setMostrarComparacaoPeriodos(r.mostrar_comparacao_periodos);
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
      const res = await api.get<{ modo: string; modulos: PersonalizacaoModulos }>('/configuracoes/personalizacao');
      const { modo, modulos } = res.data;
      await api.put('/configuracoes/personalizacao', {
        modo,
        modulos: {
          ...modulos,
          relatorios: {
            ...modulos.relatorios,
            name,
            permitir_exportacao_csv: permitirExportacaoCsv,
            mostrar_comparacao_periodos: mostrarComparacaoPeriodos
          }
        }
      });
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
        <span className="text-text-main">Relatórios</span>
      </div>
      <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">bar_chart</span>
        Relatórios
      </h1>
      <p className="text-text-muted">Exportação e comparação de períodos.</p>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Nome do módulo</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Relatórios / Estatísticas / Análises" className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted" />
        </div>
        <ToggleSwitch checked={permitirExportacaoCsv} onChange={setPermitirExportacaoCsv} label="Permitir exportação CSV" />
        <ToggleSwitch checked={mostrarComparacaoPeriodos} onChange={setMostrarComparacaoPeriodos} label="Mostrar comparação entre períodos" />
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

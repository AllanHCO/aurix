import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import ToggleSwitch from '../../components/ToggleSwitch';

interface PersonalizacaoPayload {
  modo: string;
  modulos: {
    vendas: {
      active: boolean;
      name: string;
      permitir_orcamentos: boolean;
      mostrar_botao_orcamento: boolean;
      permitir_conversao_orcamento_venda: boolean;
      permitir_ordem_servico?: boolean;
      mostrar_dados_adicionais_pdf_os?: boolean;
    };
  };
}

export default function ConfiguracaoVendas() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('Vendas');
  const [permitirOrcamentos, setPermitirOrcamentos] = useState(false);
  const [mostrarBotaoOrcamento, setMostrarBotaoOrcamento] = useState(false);
  const [permitirConversaoOrcamentoVenda, setPermitirConversaoOrcamentoVenda] = useState(false);
  const [permitirOrdemServico, setPermitirOrdemServico] = useState(false);
  const [mostrarDadosAdicionaisPdfOs, setMostrarDadosAdicionaisPdfOs] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<PersonalizacaoPayload>('/configuracoes/personalizacao');
      const v = res.data.modulos.vendas;
      setName(v.name);
      setPermitirOrcamentos(v.permitir_orcamentos);
      setMostrarBotaoOrcamento(v.mostrar_botao_orcamento);
      setPermitirConversaoOrcamentoVenda(v.permitir_conversao_orcamento_venda);
      setPermitirOrdemServico(v.permitir_ordem_servico ?? false);
      setMostrarDadosAdicionaisPdfOs(v.mostrar_dados_adicionais_pdf_os ?? true);
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
      const res = await api.get<PersonalizacaoPayload>('/configuracoes/personalizacao');
      const next = { ...res.data, modulos: { ...res.data.modulos, vendas: { ...res.data.modulos.vendas, name, permitir_orcamentos: permitirOrcamentos, mostrar_botao_orcamento: mostrarBotaoOrcamento, permitir_conversao_orcamento_venda: permitirConversaoOrcamentoVenda, permitir_ordem_servico: permitirOrdemServico, mostrar_dados_adicionais_pdf_os: mostrarDadosAdicionaisPdfOs } } };
      await api.put('/configuracoes/personalizacao', next);
      toast.success('Configurações salvas.');
      load();
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
        <span className="text-text-main">Vendas</span>
      </div>
      <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">payments</span>
        Vendas
      </h1>
      <p className="text-text-muted">Nome do módulo e regras de orçamento e faturamento.</p>

      <section className="rounded-xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Nome do módulo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vendas / Atendimentos / Ordens de serviço"
            className="w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-text-main placeholder:text-text-muted"
          />
        </div>
        <ToggleSwitch checked={permitirOrcamentos} onChange={setPermitirOrcamentos} label="Permitir orçamentos" />
        <ToggleSwitch checked={mostrarBotaoOrcamento} onChange={setMostrarBotaoOrcamento} label="Mostrar botão de orçamento" />
        <ToggleSwitch checked={permitirConversaoOrcamentoVenda} onChange={setPermitirConversaoOrcamentoVenda} label="Permitir conversão de orçamento em venda" />
        <ToggleSwitch checked={permitirOrdemServico} onChange={setPermitirOrdemServico} label="Permitir ordem de serviço" />
        <ToggleSwitch checked={mostrarDadosAdicionaisPdfOs} onChange={setMostrarDadosAdicionaisPdfOs} label="Exibir dados adicionais do cliente no PDF da ordem de serviço" />
        <p className="text-xs text-text-muted">Ligado: veículo/equipamento (modelo, KM, placa) aparecem no PDF da OS. Desligado: o PDF mostra apenas nome, CPF e telefone.</p>
        <p className="text-xs text-text-muted">Status, código único e anti-duplicação são regras internas do sistema.</p>
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

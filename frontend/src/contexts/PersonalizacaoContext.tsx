import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../services/api';

export type ModuleKey = 'clientes' | 'produtos' | 'vendas' | 'agendamentos' | 'relatorios' | 'marketing' | 'financeiro' | 'fornecedores' | 'sistema';

export interface ModuloBase {
  active: boolean;
  name: string;
}

export interface PersonalizacaoPayload {
  modo: string;
  modulos: {
    clientes: ModuloBase & {
      ativar_dados_adicionais: boolean;
      mostrar_dados_adicionais_orcamento: boolean;
      mostrar_dados_adicionais_venda: boolean;
    };
    produtos: ModuloBase & { controlar_estoque: boolean };
    vendas: ModuloBase & {
      permitir_orcamentos: boolean;
      mostrar_botao_orcamento: boolean;
      permitir_conversao_orcamento_venda: boolean;
      permitir_ordem_servico: boolean;
      mostrar_dados_adicionais_pdf_os: boolean;
    };
    agendamentos: ModuloBase & {
      ativar_link_publico: boolean;
      permitir_confirmacao_automatica: boolean;
      enviar_lembrete_agendamento: boolean;
    };
    relatorios: ModuloBase & {
      permitir_exportacao_csv: boolean;
      mostrar_comparacao_periodos: boolean;
    };
    marketing: ModuloBase & {
      mostrar_clientes_inativos: boolean;
      mostrar_receita_em_risco: boolean;
      mostrar_recuperacao_clientes: boolean;
    };
    financeiro: ModuloBase & {
      ativar_controle_despesas: boolean;
      mostrar_lucro_dashboard: boolean;
      mostrar_grafico_financeiro: boolean;
    };
    fornecedores: ModuloBase;
    sistema: ModuloBase & {
      /** Quando true, habilita o modo de múltiplas áreas de negócio (áreas de negócio). */
      usar_areas_negocio?: boolean;
    };
  };
}

const DEFAULT_LABELS: Record<ModuleKey, string> = {
  clientes: 'Clientes',
  produtos: 'Produtos',
  vendas: 'Vendas',
  agendamentos: 'Agendamentos',
  relatorios: 'Relatórios',
  marketing: 'Marketing',
  financeiro: 'Financeiro',
  fornecedores: 'Fornecedores',
  sistema: 'Sistema'
};

interface PersonalizacaoContextType {
  config: PersonalizacaoPayload | null;
  loading: boolean;
  refetch: () => Promise<void>;
  getModuleLabel: (key: ModuleKey) => string;
  isModuleEnabled: (key: ModuleKey) => boolean;
  getModuleConfig: <K extends ModuleKey>(key: K) => PersonalizacaoPayload['modulos'][K];
}

const PersonalizacaoContext = createContext<PersonalizacaoContextType | undefined>(undefined);

export function PersonalizacaoProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PersonalizacaoPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await api.get<PersonalizacaoPayload>('/configuracoes/personalizacao');
      setConfig(res.data);
    } catch {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const getModuleLabel = useCallback(
    (key: ModuleKey): string => {
      const mod = config?.modulos?.[key];
      return mod?.name?.trim() || DEFAULT_LABELS[key];
    },
    [config]
  );

  const isModuleEnabled = useCallback(
    (key: ModuleKey): boolean => {
      const mod = config?.modulos?.[key];
      return mod?.active !== false;
    },
    [config]
  );

  const getModuleConfig = useCallback(
    <K extends ModuleKey>(key: K): PersonalizacaoPayload['modulos'][K] => {
      const mod = config?.modulos?.[key];
      const defaults = {
        clientes: { active: true, name: DEFAULT_LABELS.clientes, ativar_dados_adicionais: false, mostrar_dados_adicionais_orcamento: false, mostrar_dados_adicionais_venda: false },
        produtos: { active: true, name: DEFAULT_LABELS.produtos, controlar_estoque: true },
        vendas: { active: true, name: DEFAULT_LABELS.vendas, permitir_orcamentos: false, mostrar_botao_orcamento: false, permitir_conversao_orcamento_venda: false, permitir_ordem_servico: false, mostrar_dados_adicionais_pdf_os: true },
        agendamentos: { active: true, name: DEFAULT_LABELS.agendamentos, ativar_link_publico: true, permitir_confirmacao_automatica: false, enviar_lembrete_agendamento: true },
        relatorios: { active: true, name: DEFAULT_LABELS.relatorios, permitir_exportacao_csv: true, mostrar_comparacao_periodos: true },
        marketing: { active: true, name: DEFAULT_LABELS.marketing, mostrar_clientes_inativos: true, mostrar_receita_em_risco: true, mostrar_recuperacao_clientes: true },
        financeiro: { active: true, name: DEFAULT_LABELS.financeiro, ativar_controle_despesas: false, mostrar_lucro_dashboard: false, mostrar_grafico_financeiro: false },
        fornecedores: { active: true, name: DEFAULT_LABELS.fornecedores },
        sistema: { active: true, name: DEFAULT_LABELS.sistema, usar_areas_negocio: false }
      };
      return (mod ? { ...defaults[key], ...mod } : defaults[key]) as PersonalizacaoPayload['modulos'][K];
    },
    [config]
  );

  const value: PersonalizacaoContextType = {
    config,
    loading,
    refetch,
    getModuleLabel,
    isModuleEnabled,
    getModuleConfig
  };

  return (
    <PersonalizacaoContext.Provider value={value}>
      {children}
    </PersonalizacaoContext.Provider>
  );
}

export function usePersonalizacao() {
  const ctx = useContext(PersonalizacaoContext);
  if (ctx === undefined) throw new Error('usePersonalizacao must be used within PersonalizacaoProvider');
  return ctx;
}

/** Mapeia path do menu para chave do módulo (para sidebar e rotas) */
export const PATH_TO_MODULE: Record<string, ModuleKey | null> = {
  '/clientes': 'clientes',
  '/produtos': 'produtos',
  '/vendas': 'vendas',
  '/financeiro': 'financeiro',
  '/fornecedores': 'fornecedores',
  '/agendamentos': 'agendamentos',
  '/relatorios': 'relatorios'
};

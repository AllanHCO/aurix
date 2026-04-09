/**
 * Personalização do sistema: nomes dos módulos, ativo/inativo, toggles por módulo.
 * Não altera estrutura do banco nem fluxos internos; apenas dados para o front exibir/ocultar e renomear.
 */

export type ModoPreset = 'padrao' | 'barbearia' | 'mecanica' | 'assistencia_tecnica' | 'estetica' | 'personalizado';

export interface ModuloClientes {
  active: boolean;
  name: string;
  ativar_dados_adicionais: boolean;
  mostrar_dados_adicionais_orcamento: boolean;
  mostrar_dados_adicionais_venda: boolean;
  /** Ficha complementar / anamnese (observações, preferências, imagens) separada do cadastro base */
  ativar_ficha_complementar_cliente: boolean;
}

export interface ModuloProdutos {
  active: boolean;
  name: string;
  controlar_estoque: boolean;
}

export interface ModuloVendas {
  active: boolean;
  name: string;
  permitir_orcamentos: boolean;
  mostrar_botao_orcamento: boolean;
  permitir_conversao_orcamento_venda: boolean;
  permitir_ordem_servico: boolean;
  mostrar_dados_adicionais_pdf_os: boolean;
  /** Pré-preenchimento ao criar nova ordem de serviço (PDF). Vazio = só no pedido. */
  os_texto_garantia_padrao?: string | null;
  os_mensagem_agradecimento_padrao?: string | null;
}

export interface ModuloAgendamentos {
  active: boolean;
  name: string;
  ativar_link_publico: boolean;
  permitir_confirmacao_automatica: boolean;
  enviar_lembrete_agendamento: boolean;
}

export interface ModuloRelatorios {
  active: boolean;
  name: string;
  permitir_exportacao_csv: boolean;
  mostrar_comparacao_periodos: boolean;
}

export interface ModuloMarketing {
  active: boolean;
  name: string;
  mostrar_clientes_inativos: boolean;
  mostrar_receita_em_risco: boolean;
  mostrar_recuperacao_clientes: boolean;
}

export interface ModuloFinanceiro {
  active: boolean;
  name: string;
  ativar_controle_despesas: boolean;
  mostrar_lucro_dashboard: boolean;
  mostrar_grafico_financeiro: boolean;
}

export interface ModuloSistema {
  active: boolean;
  name: string;
  /** Flag opcional: quando true, habilita o modo multiárea (áreas de negócio) no sistema. */
  usar_areas_negocio?: boolean;
}

export interface PersonalizacaoPayload {
  modo: ModoPreset;
  modulos: {
    clientes: ModuloClientes;
    produtos: ModuloProdutos;
    vendas: ModuloVendas;
    agendamentos: ModuloAgendamentos;
    relatorios: ModuloRelatorios;
    marketing: ModuloMarketing;
    financeiro: ModuloFinanceiro;
    sistema: ModuloSistema;
  };
}

const DEFAULT_MODULOS: PersonalizacaoPayload['modulos'] = {
  clientes: {
    active: true,
    name: 'Clientes',
    ativar_dados_adicionais: false,
    mostrar_dados_adicionais_orcamento: false,
    mostrar_dados_adicionais_venda: false,
    ativar_ficha_complementar_cliente: false
  },
  produtos: {
    active: true,
    name: 'Produtos',
    controlar_estoque: true
  },
  vendas: {
    active: true,
    name: 'Vendas',
    permitir_orcamentos: false,
    mostrar_botao_orcamento: false,
    permitir_conversao_orcamento_venda: false,
    permitir_ordem_servico: false,
    mostrar_dados_adicionais_pdf_os: true,
    os_texto_garantia_padrao: null,
    os_mensagem_agradecimento_padrao: null
  },
  agendamentos: {
    active: true,
    name: 'Agendamentos',
    ativar_link_publico: true,
    permitir_confirmacao_automatica: false,
    enviar_lembrete_agendamento: true
  },
  relatorios: {
    active: true,
    name: 'Relatórios',
    permitir_exportacao_csv: true,
    mostrar_comparacao_periodos: true
  },
  marketing: {
    active: true,
    name: 'Marketing',
    mostrar_clientes_inativos: true,
    mostrar_receita_em_risco: true,
    mostrar_recuperacao_clientes: true
  },
  financeiro: {
    active: true,
    name: 'Financeiro',
    ativar_controle_despesas: false,
    mostrar_lucro_dashboard: false,
    mostrar_grafico_financeiro: false
  },
  sistema: {
    active: true,
    name: 'Sistema',
    usar_areas_negocio: false
  }
};

export function getDefaultPersonalizacao(): PersonalizacaoPayload {
  return {
    modo: 'padrao',
    modulos: JSON.parse(JSON.stringify(DEFAULT_MODULOS))
  };
}

const PRESET_BARBEARIA: Partial<PersonalizacaoPayload> = {
  modo: 'barbearia',
  modulos: {
    ...getDefaultPersonalizacao().modulos,
    produtos: { ...DEFAULT_MODULOS.produtos, name: 'Serviços' },
    vendas: { ...DEFAULT_MODULOS.vendas, name: 'Atendimentos' },
    agendamentos: { ...DEFAULT_MODULOS.agendamentos, name: 'Agenda' },
    clientes: { ...DEFAULT_MODULOS.clientes, ativar_ficha_complementar_cliente: true }
  }
};

const PRESET_MECANICA: Partial<PersonalizacaoPayload> = {
  modo: 'mecanica',
  modulos: {
    ...getDefaultPersonalizacao().modulos,
    produtos: { ...DEFAULT_MODULOS.produtos, name: 'Peças e serviços' },
    vendas: { ...DEFAULT_MODULOS.vendas, name: 'Ordens de serviço', permitir_orcamentos: true, mostrar_botao_orcamento: true, permitir_conversao_orcamento_venda: true, permitir_ordem_servico: true },
    clientes: { ...DEFAULT_MODULOS.clientes, ativar_dados_adicionais: true, mostrar_dados_adicionais_orcamento: true, mostrar_dados_adicionais_venda: true }
  }
};

const PRESET_ASSISTENCIA_TECNICA: Partial<PersonalizacaoPayload> = {
  modo: 'assistencia_tecnica',
  modulos: {
    ...getDefaultPersonalizacao().modulos,
    produtos: { ...DEFAULT_MODULOS.produtos, name: 'Equipamentos' },
    vendas: { ...DEFAULT_MODULOS.vendas, name: 'Orçamentos', permitir_orcamentos: true, mostrar_botao_orcamento: true, permitir_conversao_orcamento_venda: true, permitir_ordem_servico: true },
    clientes: { ...DEFAULT_MODULOS.clientes, ativar_dados_adicionais: true, mostrar_dados_adicionais_orcamento: true, mostrar_dados_adicionais_venda: true }
  }
};

const PRESET_ESTETICA: Partial<PersonalizacaoPayload> = {
  modo: 'estetica',
  modulos: {
    ...getDefaultPersonalizacao().modulos,
    produtos: { ...DEFAULT_MODULOS.produtos, name: 'Serviços e produtos' },
    vendas: { ...DEFAULT_MODULOS.vendas, name: 'Atendimentos' },
    agendamentos: { ...DEFAULT_MODULOS.agendamentos, name: 'Agenda de serviços' },
    clientes: { ...DEFAULT_MODULOS.clientes, ativar_ficha_complementar_cliente: true }
  }
};

export function getPreset(modo: ModoPreset): PersonalizacaoPayload {
  const base = getDefaultPersonalizacao();
  if (modo === 'padrao' || modo === 'personalizado') return base;
  if (modo === 'barbearia') {
    return { modo: 'barbearia', modulos: { ...base.modulos, ...PRESET_BARBEARIA.modulos! } };
  }
  if (modo === 'mecanica') {
    return { modo: 'mecanica', modulos: { ...base.modulos, ...PRESET_MECANICA.modulos! } };
  }
  if (modo === 'assistencia_tecnica') {
    return { modo: 'assistencia_tecnica', modulos: { ...base.modulos, ...PRESET_ASSISTENCIA_TECNICA.modulos! } };
  }
  if (modo === 'estetica') {
    return { modo: 'estetica', modulos: { ...base.modulos, ...PRESET_ESTETICA.modulos! } };
  }
  return base;
}

export function mergeWithPreset(current: PersonalizacaoPayload | null, preset: ModoPreset): PersonalizacaoPayload {
  const presetConfig = getPreset(preset);
  if (!current) return presetConfig;
  return {
    modo: preset,
    modulos: { ...current.modulos, ...presetConfig.modulos }
  };
}

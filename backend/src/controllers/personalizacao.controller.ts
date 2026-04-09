import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import {
  getDefaultPersonalizacao,
  getPreset,
  type PersonalizacaoPayload,
  type ModoPreset
} from '../services/personalizacao.service';
import { mergeDocumentBranding } from '../services/document-branding.service';
import { getNichoDef, listNichosForApi } from '../services/nicho-negocio.service';

function metaFromStoredJson(raw: Record<string, unknown> | null | undefined) {
  return {
    onboarding_nicho_concluido: raw?.onboarding_nicho_concluido !== false,
    nicho_negocio_id: typeof raw?.nicho_negocio_id === 'string' ? raw.nicho_negocio_id : undefined,
    nicho_negocio_label: typeof raw?.nicho_negocio_label === 'string' ? raw.nicho_negocio_label : undefined
  };
}

function preservedPersonalizacaoMeta(existingJson: Record<string, unknown> | null) {
  return {
    onboarding_nicho_concluido: existingJson?.onboarding_nicho_concluido,
    nicho_negocio_id: existingJson?.nicho_negocio_id,
    nicho_negocio_label: existingJson?.nicho_negocio_label
  };
}

const modos: ModoPreset[] = ['padrao', 'barbearia', 'mecanica', 'assistencia_tecnica', 'estetica', 'personalizado'];

const moduloClientesSchema = z.object({
  active: z.boolean(),
  name: z.string().min(1).max(80),
  ativar_dados_adicionais: z.boolean(),
  mostrar_dados_adicionais_orcamento: z.boolean(),
  mostrar_dados_adicionais_venda: z.boolean(),
  ativar_ficha_complementar_cliente: z.boolean()
});

const moduloProdutosSchema = z.object({
  active: z.boolean(),
  name: z.string().min(1).max(80),
  controlar_estoque: z.boolean()
});

const moduloVendasSchema = z.object({
  active: z.boolean(),
  name: z.string().min(1).max(80),
  permitir_orcamentos: z.boolean(),
  mostrar_botao_orcamento: z.boolean(),
  permitir_conversao_orcamento_venda: z.boolean(),
  permitir_ordem_servico: z.boolean().optional(),
  mostrar_dados_adicionais_pdf_os: z.boolean().optional(),
  os_texto_garantia_padrao: z.union([z.string().max(2000), z.null()]).optional(),
  os_mensagem_agradecimento_padrao: z.union([z.string().max(2000), z.null()]).optional()
});

const moduloAgendamentosSchema = z.object({
  active: z.boolean(),
  name: z.string().min(1).max(80),
  ativar_link_publico: z.boolean(),
  permitir_confirmacao_automatica: z.boolean(),
  enviar_lembrete_agendamento: z.boolean()
});

const moduloRelatoriosSchema = z.object({
  active: z.boolean(),
  name: z.string().min(1).max(80),
  permitir_exportacao_csv: z.boolean(),
  mostrar_comparacao_periodos: z.boolean()
});

const moduloMarketingSchema = z.object({
  active: z.boolean(),
  name: z.string().min(1).max(80),
  mostrar_clientes_inativos: z.boolean(),
  mostrar_receita_em_risco: z.boolean(),
  mostrar_recuperacao_clientes: z.boolean()
});

const moduloFinanceiroSchema = z.object({
  active: z.boolean(),
  name: z.string().min(1).max(80),
  ativar_controle_despesas: z.boolean(),
  mostrar_lucro_dashboard: z.boolean(),
  mostrar_grafico_financeiro: z.boolean()
});

const moduloSistemaSchema = z.object({
  active: z.boolean(),
  name: z.string().min(1).max(80),
  usar_areas_negocio: z.boolean().optional()
});

/** Sem .strict(): o GET devolve também meta (onboarding_nicho_concluido, nicho_negocio_*, etc.) e o front reenvia o JSON inteiro no PUT — chaves desconhecidas são ignoradas (strip) e o meta continua vindo do banco em preservedMeta. */
const putSchema = z.object({
  modo: z.enum(modos as [string, ...string[]]),
  modulos: z.object({
    clientes: moduloClientesSchema,
    produtos: moduloProdutosSchema,
    vendas: moduloVendasSchema,
    agendamentos: moduloAgendamentosSchema,
    relatorios: moduloRelatoriosSchema,
    marketing: moduloMarketingSchema,
    financeiro: moduloFinanceiroSchema,
    sistema: moduloSistemaSchema
  })
});

async function getOrCreateSettings(userId: string) {
  let s = await prisma.companySettings.findUnique({ where: { usuario_id: userId } });
  if (!s) {
    s = await prisma.companySettings.create({
      data: { usuario_id: userId, dias_atencao: 30, dias_inativo: 45 }
    });
  }
  return s;
}

const MODULO_KEYS = [
  'clientes',
  'produtos',
  'vendas',
  'agendamentos',
  'relatorios',
  'marketing',
  'financeiro',
  'sistema'
] as const;

/**
 * Cada tela de configuração envia só o que edita; sem merge, um PUT sem os novos campos
 * (ex.: textos padrão OS em vendas) apagava o que já estava salvo no JSON.
 */
function mergeModulosParaPersistir(
  existingMods: unknown,
  bodyMods: z.infer<typeof putSchema>['modulos']
): z.infer<typeof putSchema>['modulos'] {
  const defaults = getDefaultPersonalizacao().modulos;
  const ex = existingMods && typeof existingMods === 'object' && existingMods !== null ? (existingMods as Record<string, object>) : {};
  const out = {} as z.infer<typeof putSchema>['modulos'];
  for (const key of MODULO_KEYS) {
    const d = defaults[key];
    const prev = ex[key] && typeof ex[key] === 'object' ? ex[key] : {};
    const incoming = bodyMods[key];
    (out as Record<string, object>)[key] = { ...d, ...prev, ...incoming };
  }
  return out;
}

/** GET /configuracoes/personalizacao */
export const getPersonalizacao = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const settings = await getOrCreateSettings(userId);
  const rawObj = settings.personalizacao_json as Record<string, unknown> | null | undefined;
  const raw = rawObj as PersonalizacaoPayload | null | undefined;
  const defaultConfig = getDefaultPersonalizacao();
  const meta = metaFromStoredJson(rawObj);
  if (!raw || typeof raw !== 'object' || !raw.modulos) {
    return res.json({ ...defaultConfig, ...meta });
  }
  const rawMods = raw.modulos && typeof raw.modulos === 'object' ? raw.modulos : {};
  const rv = rawMods && typeof rawMods === 'object' && rawMods !== null && 'vendas' in rawMods && rawMods.vendas && typeof rawMods.vendas === 'object' ? rawMods.vendas : {};
  const merged: PersonalizacaoPayload = {
    modo: modos.includes((raw.modo as ModoPreset)) ? (raw.modo as ModoPreset) : 'padrao',
    modulos: {
      ...defaultConfig.modulos,
      ...rawMods,
      clientes: {
        ...defaultConfig.modulos.clientes,
        ...(typeof rawMods === 'object' && rawMods !== null && 'clientes' in rawMods && rawMods.clientes && typeof rawMods.clientes === 'object'
          ? rawMods.clientes
          : {})
      },
      /** Merge profundo: JSON antigo sem chaves novas (ex.: textos padrão OS) não sobrescreve o default */
      vendas: {
        ...defaultConfig.modulos.vendas,
        ...rv
      }
    }
  };
  return res.json({ ...merged, ...meta });
};

/** PUT /configuracoes/personalizacao */
export const putPersonalizacao = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const body = putSchema.parse(req.body);
  const settings = await getOrCreateSettings(userId);
  const existingJson = (settings.personalizacao_json as Record<string, unknown> | null) || {};
  const preservedBranding = mergeDocumentBranding(existingJson.document_branding);
  const preservedMeta = preservedPersonalizacaoMeta(existingJson);
  const modulosMerged = mergeModulosParaPersistir(existingJson.modulos, body.modulos);
  await prisma.companySettings.update({
    where: { usuario_id: userId },
    data: {
      personalizacao_json: {
        ...body,
        modulos: modulosMerged,
        ...preservedMeta,
        document_branding: preservedBranding
      } as object
    }
  });
  return res.json({ success: true, message: 'Personalização salva com sucesso.' });
};

/** POST /configuracoes/personalizacao/resetar — restaura padrão */
export const postPersonalizacaoResetar = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const defaultConfig = getDefaultPersonalizacao();
  const settings = await getOrCreateSettings(userId);
  const existingJson = (settings.personalizacao_json as Record<string, unknown> | null) || {};
  const preservedBranding = mergeDocumentBranding(existingJson.document_branding);
  const preservedMeta = preservedPersonalizacaoMeta(existingJson);
  await prisma.companySettings.update({
    where: { usuario_id: userId },
    data: {
      personalizacao_json: {
        ...defaultConfig,
        ...preservedMeta,
        document_branding: preservedBranding
      } as object
    }
  });
  return res.json({ success: true, data: { ...defaultConfig, document_branding: preservedBranding }, message: 'Configurações padrão restauradas.' });
};

/** GET /configuracoes/personalizacao/preset?modo=barbearia — retorna config do preset (para preview) */
export const getPersonalizacaoPreset = async (req: AuthRequest, res: Response) => {
  const modo = (req.query.modo as string) || 'padrao';
  if (!modos.includes(modo as ModoPreset)) {
    return res.status(400).json({ error: 'Modo inválido.' });
  }
  const config = getPreset(modo as ModoPreset);
  return res.json(config);
};

/** GET /configuracoes/nichos-negocio — opções para o primeiro acesso (labels amigáveis) */
export const getNichosNegocio = async (_req: AuthRequest, res: Response) => {
  return res.json({ nichos: listNichosForApi() });
};

const onboardingNichoSchema = z.object({
  nichoId: z.string().min(1, 'Selecione um tipo de negócio')
});

/** POST /configuracoes/personalizacao/onboarding-nicho — primeiro acesso: aplica preset e libera o sistema */
export const postOnboardingNicho = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { nichoId } = onboardingNichoSchema.parse(req.body);
  const def = getNichoDef(nichoId);
  if (!def) {
    return res.status(400).json({ error: 'Tipo de negócio inválido.' });
  }
  const settings = await getOrCreateSettings(userId);
  const existingJson = (settings.personalizacao_json as Record<string, unknown> | null) || {};
  if (existingJson.onboarding_nicho_concluido === true) {
    return res.json({
      success: true,
      message: 'Personalização já estava configurada.',
      alreadyDone: true,
      data: metaFromStoredJson(existingJson)
    });
  }
  const preservedBranding = mergeDocumentBranding(existingJson.document_branding);
  const presetConfig = getPreset(def.modo);
  await prisma.companySettings.update({
    where: { usuario_id: userId },
    data: {
      personalizacao_json: {
        ...presetConfig,
        onboarding_nicho_concluido: true,
        nicho_negocio_id: def.id,
        nicho_negocio_label: def.label,
        document_branding: preservedBranding
      } as object
    }
  });
  return res.json({
    success: true,
    message: 'Personalização aplicada.',
    data: {
      ...presetConfig,
      onboarding_nicho_concluido: true,
      nicho_negocio_id: def.id,
      nicho_negocio_label: def.label
    }
  });
};

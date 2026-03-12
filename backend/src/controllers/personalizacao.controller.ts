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

const modos: ModoPreset[] = ['padrao', 'barbearia', 'mecanica', 'assistencia_tecnica', 'estetica', 'personalizado'];

const moduloClientesSchema = z.object({
  active: z.boolean(),
  name: z.string().min(1).max(80),
  ativar_dados_adicionais: z.boolean(),
  mostrar_dados_adicionais_orcamento: z.boolean(),
  mostrar_dados_adicionais_venda: z.boolean()
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
  mostrar_dados_adicionais_pdf_os: z.boolean().optional()
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
}).strict();

async function getOrCreateSettings(userId: string) {
  let s = await prisma.companySettings.findUnique({ where: { usuario_id: userId } });
  if (!s) {
    s = await prisma.companySettings.create({
      data: { usuario_id: userId, dias_atencao: 30, dias_inativo: 45 }
    });
  }
  return s;
}

/** GET /configuracoes/personalizacao */
export const getPersonalizacao = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const settings = await getOrCreateSettings(userId);
  const raw = settings.personalizacao_json as PersonalizacaoPayload | null | undefined;
  const defaultConfig = getDefaultPersonalizacao();
  if (!raw || typeof raw !== 'object' || !raw.modulos) {
    return res.json(defaultConfig);
  }
  const merged: PersonalizacaoPayload = {
    modo: modos.includes((raw.modo as ModoPreset)) ? (raw.modo as ModoPreset) : 'padrao',
    modulos: {
      ...defaultConfig.modulos,
      ...(raw.modulos && typeof raw.modulos === 'object' ? raw.modulos : {})
    }
  };
  return res.json(merged);
};

/** PUT /configuracoes/personalizacao */
export const putPersonalizacao = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const body = putSchema.parse(req.body);
  await getOrCreateSettings(userId);
  await prisma.companySettings.update({
    where: { usuario_id: userId },
    data: { personalizacao_json: body as object }
  });
  return res.json({ success: true, message: 'Personalização salva com sucesso.' });
};

/** POST /configuracoes/personalizacao/resetar — restaura padrão */
export const postPersonalizacaoResetar = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const defaultConfig = getDefaultPersonalizacao();
  await getOrCreateSettings(userId);
  await prisma.companySettings.update({
    where: { usuario_id: userId },
    data: { personalizacao_json: defaultConfig as object }
  });
  return res.json({ success: true, data: defaultConfig, message: 'Configurações padrão restauradas.' });
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

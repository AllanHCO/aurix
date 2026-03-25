/**
 * Nichos de negócio exibidos no primeiro acesso.
 * Cada opção mapeia para um ModoPreset de personalização (camada de apresentação).
 */
import type { ModoPreset } from './personalizacao.service';

export interface NichoNegocioDef {
  id: string;
  label: string;
  /** Preset interno aplicado ao salvar */
  modo: ModoPreset;
}

/** Lista ordenada — fonte única para API e validação do POST de onboarding */
export const NICHOS_NEGOCIO: readonly NichoNegocioDef[] = [
  { id: 'barbearia', label: 'Barbearia', modo: 'barbearia' },
  { id: 'salao_beleza', label: 'Salão de beleza', modo: 'barbearia' },
  { id: 'manicure', label: 'Manicure / Pedicure', modo: 'barbearia' },
  { id: 'clinica_estetica', label: 'Clínica de estética', modo: 'estetica' },
  { id: 'mecanica', label: 'Mecânica', modo: 'mecanica' },
  { id: 'funilaria', label: 'Funilaria', modo: 'mecanica' },
  { id: 'assistencia_tecnica', label: 'Assistência técnica', modo: 'assistencia_tecnica' },
  { id: 'loja_comercio', label: 'Loja / comércio', modo: 'padrao' },
  { id: 'servicos_gerais', label: 'Serviços gerais', modo: 'padrao' },
  { id: 'outro', label: 'Outro tipo de negócio', modo: 'padrao' }
] as const;

const BY_ID = new Map(NICHOS_NEGOCIO.map((n) => [n.id, n]));

export function getNichoDef(nichoId: string): NichoNegocioDef | undefined {
  return BY_ID.get(nichoId);
}

export function listNichosForApi(): Array<{ id: string; label: string }> {
  return NICHOS_NEGOCIO.map(({ id, label }) => ({ id, label }));
}

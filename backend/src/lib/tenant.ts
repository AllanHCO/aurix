/**
 * Multi-tenant (organization) helpers.
 * Neste sistema, tenant = usuário autenticado (1 usuário = 1 empresa/conta).
 * Todo dado de negócio deve ser filtrado/criado por usuario_id (organization).
 */

import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const LOG_CROSS_ORG = process.env.NODE_ENV !== 'production' || process.env.LOG_TENANT_ACCESS === 'true';

/**
 * Retorna o ID da organização (tenant) do usuário autenticado.
 * Em nosso modelo: organizationId === userId (uma conta = um usuário).
 */
export function getCurrentOrganizationId(req: AuthRequest): string {
  const id = req.userId;
  if (!id) {
    if (LOG_CROSS_ORG) {
      console.warn('[tenant] getCurrentOrganizationId chamado sem req.userId');
    }
    throw new Error('Usuário não autenticado');
  }
  return id;
}

/**
 * Garante que o registro pertence à organização do usuário.
 * Se não pertencer, lança erro e opcionalmente loga tentativa de acesso cross-tenant.
 * getOwnerId: (record) => record.usuario_id ou id do dono por relação.
 */
export function assertRecordOwnership<T>(
  record: T | null,
  organizationId: string,
  getOwnerId: (r: T) => string | null | undefined,
  recordLabel: string = 'Registro'
): asserts record is T {
  if (!record) {
    throw new AppError(`${recordLabel} não encontrado`, 404);
  }
  const ownerId = getOwnerId(record);
  if (ownerId != null && ownerId !== organizationId) {
    if (LOG_CROSS_ORG) {
      console.warn(
        `[tenant] Tentativa de acesso a ${recordLabel} de outra organização. org atual=${organizationId}, dono=${ownerId}`
      );
    }
    throw new AppError(`${recordLabel} não encontrado`, 404);
  }
  if (ownerId == null && organizationId) {
    if (LOG_CROSS_ORG) {
      console.warn(`[tenant] ${recordLabel} sem usuario_id (registro legado?).`);
    }
  }
}

/**
 * Objeto de filtro Prisma: where.usuario_id = organizationId.
 * Use em findMany, findFirst, count, etc.
 */
export function organizationFilter(organizationId: string): { usuario_id: string } {
  return { usuario_id: organizationId };
}

/**
 * Para tabelas que têm usuario_id opcional (ex.: durante migração).
 * Filtra por usuario_id = organizationId OU usuario_id IS NULL (legado).
 * Não use para criação; em criação sempre defina usuario_id.
 */
export function organizationFilterWithLegacyNull(organizationId: string): { OR: [{ usuario_id: string }, { usuario_id: null }] } {
  return {
    OR: [{ usuario_id: organizationId }, { usuario_id: null }]
  };
}

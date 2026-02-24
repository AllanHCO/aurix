import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from './auth';

const hoje = () => new Date(new Date().toISOString().slice(0, 10));

/** Bloqueia acesso se plano TRIAL expirado ou PAID inativo. Usar após authenticate. */
export function checkPlanBlock(req: AuthRequest, res: Response, next: NextFunction) {
  void run(req, res, next);
}
async function run(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.userId;
  if (!userId) return next();

  try {
    const s = await prisma.companySettings.findUnique({
      where: { usuario_id: userId }
    });
    if (!s) return next();

    if (s.plano === 'TRIAL' && s.trial_ends_at) {
      const fim = new Date(s.trial_ends_at);
      fim.setHours(0, 0, 0, 0);
      if (fim < hoje()) {
        return res.status(403).json({
          code: 'PLAN_BLOCKED',
          error: 'Sua assinatura está pendente. Entre em contato para regularizar.',
          blocked_reason: s.blocked_reason ?? 'Período de trial encerrado.'
        });
      }
    }

    if (s.plano === 'PAID' && !s.is_active) {
      return res.status(403).json({
        code: 'PLAN_BLOCKED',
        error: 'Sua assinatura está pendente. Entre em contato para regularizar.',
        blocked_reason: s.blocked_reason ?? 'Assinatura inativa.'
      });
    }

    next();
  } catch (e) {
    // Se a tabela company_settings não existir ou o banco falhar, não bloqueia o app
    console.warn('[checkPlanBlock] Erro ao verificar plano (ignorado):', (e as Error)?.message);
    next();
  }
}

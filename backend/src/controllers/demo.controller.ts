import { Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { getDemoStatus, gerarDadosDemo, resetarDadosDemo } from '../services/demoData.service';

/** Modo demo: só em development/staging. Em produção NUNCA permite (evita poluir dados reais). */
function allowDemo(): boolean {
  if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') return false;
  return true;
}

/** GET /configuracoes/demo/status */
export async function getDemoStatusHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('Não autorizado', 401);
  if (!allowDemo()) throw new AppError('Modo demo não disponível em produção.', 403);
  const status = await getDemoStatus(userId);
  res.json(status);
}

/** POST /configuracoes/demo/gerar */
export async function postDemoGerar(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('Não autorizado', 401);
  if (!allowDemo()) throw new AppError('Modo demo não disponível em produção.', 403);
  const result = await gerarDadosDemo(userId);
  res.json({ ok: true, ...result });
}

/** POST /configuracoes/demo/resetar */
export async function postDemoResetar(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new AppError('Não autorizado', 401);
  if (!allowDemo()) throw new AppError('Modo demo não disponível em produção.', 403);
  const result = await resetarDadosDemo(userId);
  res.json({ ok: true, deleted: result.deleted });
}

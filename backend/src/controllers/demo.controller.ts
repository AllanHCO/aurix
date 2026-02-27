import { Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { getDemoStatus, gerarDadosDemo, resetarDadosDemo } from '../services/demoData.service';

/** Modo demo só em desenvolvimento. Em produção nunca permite (evita alterar dados de clientes reais). */
function allowDemo(): boolean {
  return process.env.NODE_ENV !== 'production';
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

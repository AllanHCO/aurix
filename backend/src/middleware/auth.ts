import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AppError('Token não fornecido', 401);
    }

    // Usar o mesmo segredo do login (controller), inclusive fallback
    const secret = process.env.JWT_SECRET?.trim() || '';
    const jwtSecret = secret || 'default-secret-change-in-production';
    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth] 401:', error instanceof Error ? error.message : String(error));
    }
    throw new AppError('Token inválido ou expirado', 401);
  }
};

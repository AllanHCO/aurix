import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode
    });
  }

  // Erro de validação do Zod
  if (err.name === 'ZodError' && (err as any).errors) {
    const zodError = err as any;
    const firstError = zodError.errors[0];
    return res.status(400).json({
      error: firstError?.message || 'Dados inválidos',
      statusCode: 400,
      details: zodError.errors
    });
  }

  const msg = err.message || '';
  console.error('[500]', msg);
  if (process.env.NODE_ENV !== 'production') {
    console.error('Stack:', err.stack);
    if ((err as any).meta) console.error('Prisma meta:', (err as any).meta);
  }

  // Dica para erros de conexão com banco (comum no Render + Supabase)
  const isDbError =
    err.name === 'PrismaClientInitializationError' ||
    /can't reach database|can not reach|connection|ECONNREFUSED|ETIMEDOUT/i.test(msg);
  const hint = isDbError
    ? 'DATABASE_URL no Render: adicione ?sslmode=require no final da URL (ex.: .../postgres?sslmode=require). Teste: GET /health/db'
    : undefined;

  const isDev = process.env.NODE_ENV !== 'production';
  return res.status(500).json({
    error: isDev && msg ? msg : 'Internal server error',
    statusCode: 500,
    ...(isDev && msg && { message: msg }),
    ...(hint && { hint })
  });
};

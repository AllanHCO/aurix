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

  console.error('Unexpected error:', err);
  console.error('Error stack:', err.stack);

  // Dica para erros de conexão com banco (comum no Render + Supabase)
  const msg = err.message || '';
  const isDbError =
    err.name === 'PrismaClientInitializationError' ||
    /can't reach database|can not reach|connection|ECONNREFUSED|ETIMEDOUT/i.test(msg);
  const hint = isDbError
    ? 'DATABASE_URL no Render: adicione ?sslmode=require no final da URL (ex.: .../postgres?sslmode=require). Teste: GET /health/db'
    : undefined;

  return res.status(500).json({
    error: 'Internal server error',
    statusCode: 500,
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    hint
  });
};

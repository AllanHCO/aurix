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
  const prismaCode = (err as { code?: string }).code;
  console.error('[500]', msg);
  if (process.env.NODE_ENV !== 'production') {
    console.error('Stack:', err.stack);
    if ((err as any).meta) console.error('Prisma meta:', (err as any).meta);
  }

  // Tabelas da migration ainda não aplicadas (ex.: ficha do cliente)
  const isMissingDbTable =
    prismaCode === 'P2021' || /does not exist in the current database/i.test(msg);
  if (isMissingDbTable) {
    const isDev = process.env.NODE_ENV !== 'production';
    return res.status(503).json({
      error:
        'Banco de dados desatualizado: faltam tabelas. No diretório backend, com DATABASE_URL válida, execute: npx prisma migrate deploy',
      statusCode: 503,
      code: 'MIGRATION_REQUIRED',
      ...(isDev && msg && { details: msg })
    });
  }

  // Dica para erros de conexão com banco (comum no Render + Supabase)
  const isDbError =
    err.name === 'PrismaClientInitializationError' ||
    /can't reach database|can not reach|ECONNREFUSED|ETIMEDOUT|server has closed the connection/i.test(
      msg,
    );
  const isUnreachable = /can't reach database server/i.test(msg);
  const isAuth = /authentication failed|password authentication failed|credentials are not valid/i.test(
    msg,
  );
  const hint = isDbError
    ? isUnreachable
      ? 'Conexão direta db.*.supabase.co costuma ser só IPv6. No Supabase: Database → Connection string → modo Transaction pooling (host pooler, porta 6543, usuário postgres.<project_ref>). Cole em DATABASE_URL no Render; o backend acrescenta sslmode e pgbouncer. Teste: GET /health/db'
      : isAuth
        ? 'Verifique usuário e senha na DATABASE_URL (mesma URI do Supabase que funciona em dev). No Render: Environment → DATABASE_URL (sem aspas a mais).'
        : 'No Render: copie a mesma DATABASE_URL de dev (Supabase Transaction pooling, porta 6543). O servidor não deve carregar .env.production com override — variáveis vêm do painel. Teste: GET /health/db'
    : undefined;

  const isDev = process.env.NODE_ENV !== 'production';
  return res.status(500).json({
    error: isDev && msg ? msg : 'Internal server error',
    statusCode: 500,
    ...(isDev && msg && { message: msg }),
    ...(hint && { hint })
  });
};

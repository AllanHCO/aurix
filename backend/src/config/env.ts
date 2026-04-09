import path from 'path';

/**
 * Configuração e validação de ambiente.
 * REGRA: localhost e staging NUNCA podem usar banco, auth ou storage de produção.
 */

export type AppEnv = 'development' | 'staging' | 'production';

function resolveAppEnv(): AppEnv {
  const appEnv = process.env.APP_ENV?.toLowerCase().trim();
  if (appEnv === 'development' || appEnv === 'staging' || appEnv === 'production') {
    return appEnv as AppEnv;
  }
  const nodeEnv = process.env.NODE_ENV?.toLowerCase().trim();
  if (nodeEnv === 'production') return 'production';
  if (nodeEnv === 'staging') return 'staging';
  return 'development';
}

export const APP_ENV: AppEnv = resolveAppEnv();

export const isDevelopment = APP_ENV === 'development';
export const isStaging = APP_ENV === 'staging';
export const isProduction = APP_ENV === 'production';
export const isNonProduction = APP_ENV === 'development' || APP_ENV === 'staging';

/** DATABASE_URL contém indicador de banco local (dev/staging)? */
function isLocalOrStagingDatabaseUrl(url: string | undefined): boolean {
  if (!url || !url.trim()) return false;
  const u = url.toLowerCase();
  return (
    u.includes('localhost') ||
    u.includes('127.0.0.1') ||
    u.includes('.local') ||
    u.includes('aurix_dev') ||
    u.includes('aurix_staging') ||
    u.includes('staging') ||
    u.includes('_dev')
  );
}

/** DATABASE_URL parece ser de produção (host externo sem marcador de dev/staging)? */
function looksLikeProductionDatabaseUrl(url: string | undefined): boolean {
  if (!url || !url.trim()) return false;
  const u = url.toLowerCase();
  if (isLocalOrStagingDatabaseUrl(url)) return false;
  return (
    u.includes('render.com') ||
    u.includes('fly.dev') ||
    u.includes('fly.io') ||
    u.includes('supabase.co') ||
    u.includes('neon.tech') ||
    u.includes('amazonaws.com') ||
    u.includes('postgresql://') // qualquer Postgres remoto sem "dev/staging" no path
  );
}

/** Bloqueia execução se ambiente não-produção estiver usando credenciais/URL de produção. */
export function validateEnvAndBlockIfUnsafe(): void {
  const dbUrl = process.env.DATABASE_URL?.trim();
  const jwtSecret = process.env.JWT_SECRET?.trim();
  const frontendUrl = process.env.FRONTEND_URL?.trim();
  const allowRemoteDevDatabase =
    process.env.ALLOW_REMOTE_DEV_DATABASE?.trim() === '1' ||
    process.env.ALLOW_REMOTE_DEV_DATABASE?.trim()?.toLowerCase() === 'true';

  const errors: string[] = [];

  if (isNonProduction) {
    if (looksLikeProductionDatabaseUrl(dbUrl) && !allowRemoteDevDatabase) {
      errors.push(
        `DATABASE_URL parece ser de PRODUÇÃO (${dbUrl?.slice(0, 50)}...). ` +
          `Ambiente local/staging deve usar banco local ou projeto de desenvolvimento (ex.: postgresql://...@localhost:5432/aurix_dev).`
      );
    }
    if (frontendUrl && !frontendUrl.includes('localhost') && !frontendUrl.includes('127.0.0.1') && (frontendUrl.includes('vercel.app') || frontendUrl.includes('netlify.app') || frontendUrl.includes('render.com'))) {
      errors.push(
        `FRONTEND_URL (${frontendUrl}) parece ser de produção. Em desenvolvimento use http://localhost:5173`
      );
    }
  }

  if (isProduction) {
    if (isLocalOrStagingDatabaseUrl(dbUrl)) {
      errors.push(
        `Produção não pode usar banco de desenvolvimento. DATABASE_URL contém localhost ou marcador dev/staging.`
      );
    }
    if (!jwtSecret || jwtSecret.length < 32) {
      errors.push('Em produção JWT_SECRET é obrigatório e deve ter pelo menos 32 caracteres.');
    }
    if (!frontendUrl || frontendUrl.trim() === '') {
      errors.push('Em produção FRONTEND_URL é obrigatório (ex.: https://seu-app.vercel.app).');
    }
  }

  if (errors.length > 0) {
    const msg = [
      '',
      '═══════════════════════════════════════════════════════════════',
      '  ERRO CRÍTICO DE AMBIENTE',
      '  Localhost/staging NUNCA pode usar banco, auth ou storage de produção.',
      '═══════════════════════════════════════════════════════════════',
      '',
      ...errors.map((e) => `  • ${e}`),
      '',
      '  Use .env.development ou .env.local com banco próprio (ex.: aurix_dev).',
      '  Nunca use DATABASE_URL de produção em máquina local.',
      '═══════════════════════════════════════════════════════════════',
      ''
    ].join('\n');
    console.error(msg);
    process.exit(1);
  }

  if (isNonProduction && looksLikeProductionDatabaseUrl(dbUrl) && allowRemoteDevDatabase) {
    console.warn(
      '[AMBIENTE] ALLOW_REMOTE_DEV_DATABASE ativo: usando DATABASE_URL remoto em ambiente de desenvolvimento.'
    );
  }
}

/** Diretório base de uploads por ambiente. Produção usa "uploads" (compatibilidade); dev/staging usam pasta própria. */
export function getUploadsBaseDir(): string {
  return APP_ENV === 'production' ? 'uploads' : `uploads_${APP_ENV}`;
}

/**
 * Caminho raiz de uploads no disco.
 * - Se UPLOADS_DIR estiver definido, usa esse caminho (ideal para volume persistente em produção).
 * - Sem variável, mantém comportamento legado em process.cwd().
 */
export function getUploadsRootDir(): string {
  const custom = process.env.UPLOADS_DIR?.trim();
  if (custom) {
    return path.isAbsolute(custom) ? custom : path.join(process.cwd(), custom);
  }
  return path.join(process.cwd(), getUploadsBaseDir());
}

/** Retorna descrição segura do ambiente para logs (sem expor URLs completas). */
export function getEnvSummary(): { APP_ENV: AppEnv; DATABASE: string; STORAGE: string; PORT: string } {
  const dbUrl = process.env.DATABASE_URL?.trim() || '';
  let dbHint = 'não definido';
  if (dbUrl) {
    if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) dbHint = 'local';
    else if (dbUrl.includes('staging') || dbUrl.includes('_dev')) dbHint = 'staging/dev';
    else dbHint = 'remoto (produção?)';
  }
  const storageDir = getUploadsRootDir();
  return {
    APP_ENV,
    DATABASE: dbHint,
    STORAGE: storageDir,
    PORT: String(process.env.PORT || 3001)
  };
}

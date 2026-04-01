/**
 * Carrega variáveis de ambiente: base depois sobreposição por ambiente.
 * REGRA CRÍTICA: .env.production NUNCA é carregado em máquina local (só quando NODE_ENV=production).
 * Ordem (a última sobrescreve): .env → .env.<ambiente> → .env.local
 *
 * Em NODE_ENV=production (Render/Fly): NÃO carregamos arquivos .env do disco por padrão — o painel
 * injeta DATABASE_URL etc.; dotenv com override apagaria esses valores se existisse .env.production.
 */
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

/** Fly/Render/Vercel: secrets às vezes vêm com aspas no valor; quebra o parser do Postgres. */
function stripOuterQuotes(value: string | undefined): string {
  if (!value) return '';
  let s = value.trim();
  if (s.length >= 2) {
    const a = s[0];
    const b = s[s.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      s = s.slice(1, -1);
    }
  }
  return s.trim();
}

function appendQueryParam(url: string, key: string, value: string): string {
  if (new RegExp(`[?&]${key}=`).test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + `${key}=${value}`;
}

function loadEnv(): void {
  const cwd = process.cwd();
  const base = path.join(cwd, '.env');
  const local = path.join(cwd, '.env.local');

  const isProd = (process.env.NODE_ENV || '').toLowerCase().trim() === 'production';

  if (!isProd) {
    // 1) Base primeiro (aqui NODE_ENV e APP_ENV podem ser definidos)
    if (fs.existsSync(base)) dotenv.config({ path: base });
    let nodeEnv = process.env.NODE_ENV?.toLowerCase().trim() || 'development';

    // 2) Por ambiente: .env.production SÓ quando NODE_ENV=production (máquina local com prod)
    if (nodeEnv === 'production') {
      const prodFile = path.join(cwd, '.env.production');
      if (fs.existsSync(prodFile)) dotenv.config({ path: prodFile, override: true });
    } else {
      const safeEnv = nodeEnv === 'staging' ? 'staging' : 'development';
      const safeEnvFile = path.join(cwd, `.env.${safeEnv}`);
      if (fs.existsSync(safeEnvFile)) dotenv.config({ path: safeEnvFile, override: true });
    }

    // 3) Local sobrescreve (nunca commitar; maior prioridade)
    if (fs.existsSync(local)) dotenv.config({ path: local, override: true });
  } else if (!process.env.DATABASE_URL?.trim()) {
    // Produção sem DATABASE_URL (ex.: teste local com NODE_ENV=production): fallback para arquivo
    const prodFile = path.join(cwd, '.env.production');
    if (fs.existsSync(prodFile)) dotenv.config({ path: prodFile });
  }

  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = stripOuterQuotes(process.env.DATABASE_URL);
  }
  if (process.env.JWT_SECRET) {
    process.env.JWT_SECRET = stripOuterQuotes(process.env.JWT_SECRET);
  }
  if (process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL = stripOuterQuotes(process.env.FRONTEND_URL);
  }

  // Render/Supabase e outros Postgres remotos exigem SSL. Deve rodar AQUI (antes de qualquer
  // import de PrismaClient); o corpo de server.ts executa depois dos imports e era tarde demais.
  // Conexão direta db.*.supabase.co costuma resolver só em IPv6; redes sem IPv6 estável falham
  // com "Can't reach database server" — use Transaction pooling (pooler IPv4, porta 6543) no painel.
  let dbUrl = process.env.DATABASE_URL?.trim() || '';
  const isRemoteDb = /supabase\.(co|com)|render\.com|fly\.(io|dev)|neon\.tech|amazonaws\.com/i.test(
    dbUrl,
  );
  if (dbUrl && isRemoteDb) {
    dbUrl = appendQueryParam(dbUrl, 'sslmode', 'require');
  }
  // Prisma + Supabase Transaction pooler (6543 / PgBouncer): limites recomendados
  if (dbUrl && /pooler\.supabase\.com/i.test(dbUrl) && /:6543(\/|$)/.test(dbUrl)) {
    dbUrl = appendQueryParam(dbUrl, 'pgbouncer', 'true');
    dbUrl = appendQueryParam(dbUrl, 'connection_limit', '1');
    dbUrl = appendQueryParam(dbUrl, 'connect_timeout', '30');
  }
  if (dbUrl && dbUrl !== process.env.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = dbUrl;
  }
  if (process.env.NODE_ENV !== 'production' && /@db\.[^.]+\.supabase\.co:5432\//i.test(dbUrl)) {
    console.warn(
      '[env] DATABASE_URL usa host direto db.*.supabase.co (muitas redes só IPv6). Se der "Can\'t reach database server", use no Supabase: Settings → Database → Connection string → Transaction pooling (porta 6543, usuário postgres.<ref>).'
    );
  }

  const nodeEnv = process.env.NODE_ENV?.toLowerCase().trim() || 'development';
  if (!process.env.DATABASE_URL && nodeEnv !== 'test') {
    console.warn('[env] DATABASE_URL não definida. Use .env ou .env.development');
  } else if (nodeEnv === 'production' && process.env.DATABASE_URL) {
    const host = process.env.DATABASE_URL.replace(/^[^@]+@/, '').split(/[/?]/)[0] || '?';
    console.log(`[env] produção: banco=${host.split(':')[0]} (sem senha no log)`);
  }
}

loadEnv();

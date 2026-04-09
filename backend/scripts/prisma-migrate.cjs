/**
 * Mesma ordem de env que o servidor (loadEnv): .env → .env.<ambiente> → .env.local
 * Assim `npm run migrate:deploy` usa a mesma DATABASE_URL que `npm run dev`.
 *
 * Uso preferido (trata P3005 + env):
 *   npm run db:up
 * Também:
 *   npm run migrate:deploy
 *   npm run migrate:dev
 *   node scripts/prisma-migrate.cjs migrate status
 *
 * Evite `npx prisma migrate deploy` direto: ele só lê .env (não .env.local / .env.development).
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

const cwd = path.join(__dirname, '..');

function stripQuotes(v) {
  if (!v) return '';
  let s = String(v).trim();
  if (s.length >= 2 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

function loadEnvLikeApp() {
  const base = path.join(cwd, '.env');
  const local = path.join(cwd, '.env.local');

  if (fs.existsSync(base)) dotenv.config({ path: base });

  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase().trim();
  if (nodeEnv === 'production') {
    const prodFile = path.join(cwd, '.env.production');
    if (fs.existsSync(prodFile)) dotenv.config({ path: prodFile, override: true });
  } else {
    const safeEnv = nodeEnv === 'staging' ? 'staging' : 'development';
    const envFile = path.join(cwd, `.env.${safeEnv}`);
    if (fs.existsSync(envFile)) dotenv.config({ path: envFile, override: true });
  }

  if (fs.existsSync(local)) dotenv.config({ path: local, override: true });

  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = stripQuotes(process.env.DATABASE_URL);
  }
}

loadEnvLikeApp();

function migrateUrlFrom(dbUrl) {
  if (!dbUrl) return dbUrl;
  try {
    const u = new URL(dbUrl);
    const isPooler6543 = /pooler\.supabase\.com$/i.test(u.hostname) && u.port === '6543';
    if (isPooler6543) {
      const m = String(u.username || '').match(/^postgres\.(.+)$/i);
      if (m) {
        const ref = m[1];
        const pass = u.password ? decodeURIComponent(u.password) : '';
        return `postgresql://postgres:${encodeURIComponent(pass)}@db.${ref}.supabase.co:5432${u.pathname || '/postgres'}?sslmode=require`;
      }
    }
  } catch {
    // ignore
  }
  return dbUrl;
}

const appUrl = process.env.DATABASE_URL || '';
const extra = process.argv.slice(2).join(' ').trim();
/** Só migrations precisam da URL direta no Supabase; studio/generate usam a URL original. */
const needsMigrateUrl = !extra || /\bmigrate\b/.test(extra) || /^db\s/i.test(extra);
const forMigrate = migrateUrlFrom(appUrl);
const urlForPrisma = needsMigrateUrl ? forMigrate : appUrl;

if (!urlForPrisma || !/^postgres(ql)?:\/\//i.test(urlForPrisma)) {
  console.error(`
[aurix] DATABASE_URL não encontrada ou inválida após carregar os arquivos de ambiente.

Ordem carregada: .env → .env.development ou .env.staging → .env.local

1) Copie backend/.env.development.example para backend/.env.local (ou edite backend/.env)
2) Defina DATABASE_URL com usuário e senha reais do PostgreSQL, exemplo:
   postgresql://postgres:SUA_SENHA@localhost:5432/aurix_dev?schema=public
3) Rode: npm run migrate:deploy

Não use "npx prisma migrate deploy" sozinho — ele ignora .env.local.
`);
  process.exit(1);
}

const cmd = extra ? `npx prisma ${extra}` : 'npx prisma migrate deploy';

if (needsMigrateUrl && forMigrate !== appUrl) {
  console.log('[prisma-migrate] Supabase pooler detectado: migrations via conexão direta (db.*.supabase.co:5432).');
}

const env = { ...process.env, DATABASE_URL: urlForPrisma };

try {
  execSync(cmd, { stdio: 'inherit', cwd, env });
} catch (e) {
  const code = typeof e.status === 'number' ? e.status : 1;
  console.error(
    '\n[aurix] Dica: erro P1000 = usuário/senha incorretos na DATABASE_URL. Ajuste .env ou .env.local e use sempre: npm run migrate:deploy\n'
  );
  process.exit(code);
}

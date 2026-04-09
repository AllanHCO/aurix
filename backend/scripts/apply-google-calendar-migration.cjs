/**
 * Aplica migration Google Calendar em qualquer Postgres (dev ou produção).
 *
 * Produção (recomendado): defina a URL do banco que o Fly usa:
 *   PowerShell:
 *     $env:DATABASE_URL_PRODUCTION="postgresql://..."
 *     node scripts/apply-google-calendar-migration.cjs
 *
 *   Pegue a URI em: Fly.io → aurix-prod → Secrets → DATABASE_URL (ícone de revelar / editar),
 *   ou no painel do Supabase do projeto de PRODUÇÃO (Transaction pooling 6543 ou direta 5432).
 *
 * Sem DATABASE_URL_PRODUCTION: usa .env + .env.local (mesmo comportamento antigo).
 *
 * Usa SQL idempotente (pode rodar mais de uma vez).
 */
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

const cwd = path.join(__dirname, '..');
dotenv.config({ path: path.join(cwd, '.env') });
dotenv.config({ path: path.join(cwd, '.env.local'), override: true });

function stripQuotes(v) {
  if (!v) return '';
  let s = String(v).trim();
  if (s.length >= 2 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

function toDirectUrl(dbUrl) {
  try {
    const u = new URL(dbUrl);
    // Transaction (6543) ou sessão (5432) no pooler — migrate/db execute ficam mais estáveis na conexão direta db.*.supabase.co
    if (/pooler\.supabase\.com$/i.test(u.hostname) && (u.port === '6543' || u.port === '5432')) {
      const m = String(u.username || '').match(/^postgres\.(.+)$/i);
      if (m) {
        const pass = u.password ? decodeURIComponent(u.password) : '';
        return `postgresql://postgres:${encodeURIComponent(pass)}@db.${m[1]}.supabase.co:5432${u.pathname || '/postgres'}?sslmode=require`;
      }
    }
  } catch {
    return dbUrl;
  }
  return dbUrl;
}

let dbUrl = stripQuotes(process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL);
if (!dbUrl) {
  console.error('Defina DATABASE_URL_PRODUCTION (produção) ou DATABASE_URL no .env.local.');
  process.exit(1);
}

dbUrl = toDirectUrl(dbUrl);

const sqlFile = path.join(cwd, 'scripts/sql/google_calendar_integration_idempotent.sql');
console.log('[apply-google-calendar-migration] Aplicando SQL em:', dbUrl.replace(/:[^:@/]+@/, ':****@'));

try {
  execSync(`npx prisma db execute --file "${sqlFile}" --schema prisma/schema.prisma`, {
    stdio: 'inherit',
    cwd,
    env: { ...process.env, DATABASE_URL: dbUrl }
  });
  console.log('[apply-google-calendar-migration] OK.');
} catch (e) {
  console.error('[apply-google-calendar-migration] Falhou. Verifique a URI e se o IP está liberado no Supabase.');
  process.exit(1);
}

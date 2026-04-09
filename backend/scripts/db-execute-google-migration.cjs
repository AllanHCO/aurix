/**
 * Aplica só o SQL da migration Google Calendar (útil quando migrate deploy dá P3005 — banco já existia sem histórico Prisma).
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

let dbUrl = stripQuotes(process.env.DATABASE_URL);
try {
  const u = new URL(dbUrl);
  if (/pooler\.supabase\.com$/i.test(u.hostname) && u.port === '6543') {
    const m = String(u.username || '').match(/^postgres\.(.+)$/i);
    if (m) {
      const pass = u.password ? decodeURIComponent(u.password) : '';
      dbUrl = `postgresql://postgres:${encodeURIComponent(pass)}@db.${m[1]}.supabase.co:5432${u.pathname || '/postgres'}?sslmode=require`;
    }
  }
} catch {
  process.exit(1);
}

const file = path.join(cwd, 'prisma/migrations/20260327120000_google_calendar_integration/migration.sql');
execSync(`npx prisma db execute --file "${file}" --schema prisma/schema.prisma`, {
  stdio: 'inherit',
  cwd,
  env: { ...process.env, DATABASE_URL: dbUrl }
});

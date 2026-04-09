/**
 * Comando único para atualizar o banco: tenta `migrate deploy`; se o Prisma responder com P3005
 * (banco com schema mas sem histórico de migrations — comum no Supabase), roda o baseline da ficha
 * e aplica o que falta.
 *
 * Uso (sempre na pasta backend):
 *   npm run db:up
 *
 * Não use `npx prisma migrate deploy` direto — use os scripts npm deste projeto.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const backend = path.join(__dirname, '..');
const runner = path.join(__dirname, 'prisma-migrate.cjs');
const baseline = path.join(__dirname, 'prisma-baseline-then-deploy.cjs');

const P3005_RE = /P3005|The database schema is not empty|database schema is not empty/i;

function runDeployCapture() {
  return spawnSync(process.execPath, [runner], {
    cwd: backend,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 12 * 1024 * 1024,
    stdio: ['inherit', 'pipe', 'pipe']
  });
}

const first = runDeployCapture();
const combined = `${first.stdout || ''}${first.stderr || ''}`;
if (first.stdout) process.stdout.write(first.stdout);
if (first.stderr) process.stderr.write(first.stderr);

const code = first.status === null ? 1 : first.status;

if (code === 0) {
  process.exit(0);
}

if (P3005_RE.test(combined)) {
  console.error(
    '\n[aurix] P3005: banco com schema mas sem histórico Prisma (comum no Supabase). Rodando baseline + deploy…\n' +
      '[aurix] Pressupõe que migrations antigas já estão refletidas no banco.\n'
  );
  const second = spawnSync(process.execPath, [baseline], {
    cwd: backend,
    env: process.env,
    stdio: 'inherit'
  });
  const c2 = second.status === null ? 1 : second.status;
  process.exit(c2);
}

if (!combined.trim()) {
  console.error(`[aurix] migrate deploy falhou (código ${code}).`);
}
process.exit(code);

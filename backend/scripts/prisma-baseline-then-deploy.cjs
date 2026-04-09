/**
 * Corrige Prisma P3005 em banco que JÁ TEM o schema (ex.: Supabase), mas sem histórico em _prisma_migrations.
 *
 * Marca como "já aplicadas" todas as migrations com nome de pasta **anterior** à migration-alvo (ordem lexicográfica),
 * depois roda `migrate deploy` para aplicar só a alvo e as posteriores.
 *
 * Uso típico (ficha do cliente é a pendente):
 *   npm run migrate:baseline:ficha
 *
 * Ou com pasta-alvo explícita (nome exato da pasta em prisma/migrations):
 *   node scripts/prisma-baseline-then-deploy.cjs 20260408120000_cliente_ficha_complementar
 *
 * ⚠️ Só use se o banco JÁ reflete tudo que essas migrations antigas fariam. Se faltar tabela de uma migration
 *    intermediária, o resolve vai mentir para o Prisma — ajuste o banco antes ou peça ajuda.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const backend = path.join(__dirname, '..');
const migDir = path.join(backend, 'prisma', 'migrations');
const runner = path.join(__dirname, 'prisma-migrate.cjs');

const target = (process.argv[2] || '20260408120000_cliente_ficha_complementar').trim();

if (!fs.existsSync(path.join(migDir, target, 'migration.sql'))) {
  console.error(
    `[baseline] Migration-alvo não encontrada: ${target}\n` +
      `Pastas em prisma/migrations/ (use o nome exato da pasta).`
  );
  process.exit(1);
}

const dirs = fs
  .readdirSync(migDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => fs.existsSync(path.join(migDir, name, 'migration.sql')))
  .sort();

const toResolve = dirs.filter((d) => d < target);

console.log(
  `[baseline] Alvo: ${target}\n` +
    `[baseline] Vou marcar ${toResolve.length} migration(s) como já aplicadas (resolve --applied), sem rodar o SQL delas.\n` +
    `[baseline] Em seguida: migrate deploy (aplica a migration-alvo e posteriores, se houver).\n`
);

for (const name of toResolve) {
  console.log(`\n[baseline] prisma migrate resolve --applied "${name}"`);
  try {
    execSync(`node "${runner}" migrate resolve --applied "${name}"`, {
      stdio: 'inherit',
      cwd: backend,
      env: process.env,
      shell: true
    });
  } catch {
    console.warn(
      `[baseline] Falha ou já registrada — verifique. Se a migration já constava em _prisma_migrations, pode ignorar.\n`
    );
  }
}

console.log('\n[baseline] prisma migrate deploy\n');
try {
  execSync(`node "${runner}"`, { stdio: 'inherit', cwd: backend, env: process.env, shell: true });
} catch (e) {
  process.exit(typeof e.status === 'number' ? e.status : 1);
}

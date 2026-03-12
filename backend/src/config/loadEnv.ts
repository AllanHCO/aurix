/**
 * Carrega variáveis de ambiente: base depois sobreposição por ambiente.
 * REGRA CRÍTICA: .env.production NUNCA é carregado em máquina local (só quando NODE_ENV=production).
 * Ordem (a última sobrescreve): .env → .env.<ambiente> → .env.local
 */
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

function loadEnv(): void {
  const cwd = process.cwd();
  const base = path.join(cwd, '.env');
  const local = path.join(cwd, '.env.local');

  // 1) Base primeiro (aqui NODE_ENV e APP_ENV podem ser definidos)
  if (fs.existsSync(base)) dotenv.config({ path: base });
  let nodeEnv = process.env.NODE_ENV?.toLowerCase().trim() || 'development';

  // 2) Por ambiente: .env.production SÓ é carregado quando NODE_ENV=production (host de produção)
  //    Em qualquer outro caso carregamos .env.development ou .env.staging — NUNCA .env.production
  if (nodeEnv === 'production') {
    const prodFile = path.join(cwd, '.env.production');
    if (fs.existsSync(prodFile)) dotenv.config({ path: prodFile });
  } else {
    const safeEnv = nodeEnv === 'staging' ? 'staging' : 'development';
    const safeEnvFile = path.join(cwd, `.env.${safeEnv}`);
    if (fs.existsSync(safeEnvFile)) dotenv.config({ path: safeEnvFile });
  }

  // 3) Local sobrescreve (nunca commitar; maior prioridade)
  if (fs.existsSync(local)) dotenv.config({ path: local });

  nodeEnv = process.env.NODE_ENV?.toLowerCase().trim() || 'development';
  if (!process.env.DATABASE_URL && nodeEnv !== 'test') {
    console.warn('[env] DATABASE_URL não definida. Use .env ou .env.development');
  }
}

loadEnv();

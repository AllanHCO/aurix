# Separação de ambientes — Aurix

## Regra principal

**Localhost e homologação NUNCA podem usar banco, auth ou storage de produção.**

Se o backend estiver rodando em desenvolvimento (`APP_ENV=development` ou `NODE_ENV=development`) e detectar `DATABASE_URL` ou `FRONTEND_URL` de produção, **o servidor não inicia** e exibe erro crítico.

---

## Ambientes

| Ambiente     | Uso                          | Banco        | Auth / Storage      |
|-------------|------------------------------|-------------|---------------------|
| Development | Desenvolvimento, testes, seed| Local ou dev| Próprio             |
| Staging     | Homologação, QA              | Staging     | Próprio             |
| Production  | Clientes reais               | Produção    | Produção            |

---

## Variáveis obrigatórias

### Todas

- `NODE_ENV`: `development` | `staging` | `production`
- `APP_ENV`: `development` | `staging` | `production` (recomendado; senão deriva de `NODE_ENV`)
- `DATABASE_URL`: URL do PostgreSQL
- `JWT_SECRET`: mínimo 32 caracteres em produção
- `PORT`: ex.: `3001`
- `FRONTEND_URL`: em produção, URL do front (ex.: `https://app.seudominio.com`)

### Produção

- `JWT_SECRET`: obrigatório, ≥ 32 caracteres
- `FRONTEND_URL`: obrigatório
- `DATABASE_URL`: **não** pode conter `localhost`, `aurix_dev`, `aurix_staging`, `staging`, `_dev`

### Development / Staging

- `DATABASE_URL`: **não** pode apontar para banco de produção (ex.: Supabase/Render de prod)
- `FRONTEND_URL`: em dev, use `http://localhost:5173`

---

## Arquivos de ambiente (backend)

Ordem de carregamento (a última sobrescreve):

1. `.env` — base
2. `.env.<NODE_ENV>` — ex.: `.env.development`, `.env.production`
3. `.env.local` — overrides locais (nunca commitar)

Exemplos na pasta `backend/`:

- `.env.example` — modelo genérico
- `.env.development.example` — desenvolvimento
- `.env.staging.example` — homologação
- `.env.production.example` — produção
- `.env.local.example` — overrides locais

Cada ambiente deve usar **apenas** as próprias variáveis (banco, URL do front, etc.).

---

## Banco de dados

- **Produção:** banco exclusivo de produção.
- **Local:** PostgreSQL local ou projeto Supabase **de desenvolvimento** (não o de produção).
- **Homologação:** banco separado de staging.

Nunca usar o mesmo banco entre local e produção, ou entre staging e produção.

---

## Seed e dados de demonstração

- **Seed** (`prisma db seed`): só em development/staging. Em produção o seed **não roda** (bloqueio no código).
- **Demo/seed-demo** (POST `/dev/seed-demo`): só em development/staging. Em produção retorna 403.

Não existe flag para habilitar seed/demo em produção.

---

## Storage (uploads)

- **Produção:** diretório `uploads/`
- **Development:** `uploads_development/`
- **Staging:** `uploads_staging/`

Anexos de um ambiente não são lidos/escritos em outro.

---

## Verificação no startup (backend)

Na inicialização o backend:

1. Carrega env (`loadEnv`: `.env` → `.env.<NODE_ENV>` → `.env.local`).
2. Chama `validateEnvAndBlockIfUnsafe()`:
   - Em dev/staging: se `DATABASE_URL` ou `FRONTEND_URL` parecer de produção → **process.exit(1)**.
   - Em produção: se `DATABASE_URL` parecer de dev/staging, ou faltar `JWT_SECRET`/`FRONTEND_URL` → **process.exit(1)**.
3. Loga no console: `AMBIENTE`, `DATABASE`, `PORT`.

Endpoint de conferência (sem credenciais):

- `GET /health/env` ou `GET /api/health/env` → `{ APP_ENV, DATABASE, PORT }`

---

## Frontend

- **Badge:** em development/staging o front exibe um badge “Ambiente: Desenvolvimento” ou “Ambiente: Homologação” (canto inferior esquerdo).
- **Alerta crítico:** se a aplicação estiver em **localhost** e o backend responder `APP_ENV=production`, o front exibe um aviso em tela cheia para evitar uso acidental de produção a partir do local.

---

## Checklist rápido

- [ ] Local usa `APP_ENV=development` e `DATABASE_URL` para banco local ou dev.
- [ ] Produção usa `APP_ENV=production`, `DATABASE_URL` de produção, `JWT_SECRET` ≥ 32 chars, `FRONTEND_URL` definido.
- [ ] Nunca commitar `.env.local` ou `.env.production` com valores reais.
- [ ] Seed/demo só em dev/staging; em produção não rodam.
- [ ] Uploads separados por ambiente (pastas diferentes).

---

## Resumo

- Localhost **nunca** usa produção.
- Staging **nunca** usa produção.
- Produção **nunca** recebe seed/demo.
- Cada ambiente tem banco (e storage) próprios.
- Inconsistência de ambiente faz o backend **encerrar** na inicialização.

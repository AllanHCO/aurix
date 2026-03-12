# Separação de ambientes — Aurix

Para isolamento **por conta/empresa** (multi-tenant), veja **[MULTI_TENANT.md](MULTI_TENANT.md)**.

## Regra principal

**Localhost e homologação NUNCA podem usar banco, auth ou storage de produção.**

Se o ambiente for desenvolvimento ou staging e as variáveis apontarem para produção, o backend **bloqueia a execução** e exibe erro crítico.

---

## Ambientes

| Ambiente     | Uso                          | Banco        | Auth/Storage      |
|-------------|------------------------------|-------------|-------------------|
| development | Desenvolvimento local, seed, testes | Local ou Supabase DEV | Próprios |
| staging     | Homologação, QA              | Banco staging | Próprios        |
| production  | Clientes reais               | Banco produção | Próprios        |

---

## Variáveis de ambiente

### Obrigatórias (backend)

- **APP_ENV** — `development` | `staging` | `production`. Define o ambiente atual.
- **NODE_ENV** — Usado pelo Node e para carregar `.env.<NODE_ENV>`. Em produção deve ser `production`.
- **DATABASE_URL** — URL do PostgreSQL. Em dev/staging use banco local ou projeto dev (ex.: `aurix_dev`).
- **JWT_SECRET** — Chave para tokens. Em produção: mínimo 32 caracteres, exclusiva.
- **FRONTEND_URL** — Origens permitidas (CORS). Em dev: `http://localhost:5173`.

### Opcionais

- **PORT** — Porta do backend (padrão 3001).
- **JWT_EXPIRES_IN** — Validade do token (padrão 7d).

---

## Arquivos de ambiente (backend)

Ordem de carregamento (a última sobrescreve):

1. **.env** — Base (pode definir NODE_ENV).
2. **.env.\<NODE_ENV\>** — Por ambiente, **com exceção**:
   - Se `NODE_ENV !== 'production'`, **nunca** é carregado `.env.production` (apenas `.env.development` ou `.env.staging`).
   - Assim, rodar `npm run dev` localmente nunca carrega credenciais de produção.
3. **.env.local** — Overrides locais (nunca commitar).

### Exemplos de arquivos

- **.env.development** — Desenvolvimento local (banco `aurix_dev`, JWT de dev).
- **.env.staging** — Homologação (banco staging).
- **.env.production** — Só é carregado quando `NODE_ENV=production` (ex.: no Render/Fly).

**Regra:** Cada ambiente deve usar apenas suas próprias variáveis. Nunca coloque `DATABASE_URL` de produção em `.env.development` ou `.env.local`.

---

## Banco de dados

- **Produção:** banco exclusivo (ex.: Supabase projeto prod, Render Postgres prod).
- **Local:** PostgreSQL local ou projeto Supabase **separado** de desenvolvimento (ex.: `aurix_dev`).
- **Staging:** banco separado (ex.: `aurix_staging`).

O backend **bloqueia** se:

- `APP_ENV` for development ou staging e `DATABASE_URL` parecer de produção (ex.: Supabase/Render sem sufixo `_dev`/staging).
- `APP_ENV` for production e `DATABASE_URL` contiver localhost ou marcadores dev/staging.

---

## Storage (uploads)

O diretório de uploads é separado por ambiente:

- **production:** `uploads/`
- **development:** `uploads_development/`
- **staging:** `uploads_staging/`

Anexos de vendas e outros arquivos ficam isolados por ambiente.

---

## Seed e dados de demonstração

- **Seed** (`npm run prisma:seed` ou `tsx src/prisma/seed.ts`):
  - Só roda em development/staging.
  - Em produção: sai com erro e não altera o banco.
  - Verificação extra: se `DATABASE_URL` parecer de produção, o seed também bloqueia.

- **Demo** (POST `/dev/seed-demo`):
  - Desabilitado em produção (retorna 403).

**Regra:** Seed e demo **nunca** rodam em produção.

---

## Validação na inicialização (backend)

Ao subir o servidor:

1. **loadEnv** — Carrega env; em máquina local **nunca** carrega `.env.production`.
2. **validateEnvAndBlockIfUnsafe** — Verifica consistência (ambiente vs DATABASE_URL, JWT, FRONTEND_URL). Se algo estiver errado, **encerra o processo** com mensagem clara.
3. **Log de ambiente** — No startup são logados `APP_ENV`, `DATABASE`, `STORAGE`, `PORT` (sem expor URLs completas).

---

## Identificação visual (frontend)

- **Desenvolvimento:** badge fixo no canto inferior esquerdo: “Ambiente: Desenvolvimento”.
- **Homologação:** “Ambiente: Homologação”.
- **Produção:** nenhum badge (ou discreto).

**Proteção crítica:** Se o frontend estiver em **localhost** e o backend reportar **produção** (via `/api/health/env`), o frontend exibe **tela de bloqueio** em vermelho, avisando que localhost não pode usar backend de produção.

---

## Checklist de segurança

- [ ] Localhost usa apenas banco local ou projeto Supabase **dev**.
- [ ] `.env.production` (ou secrets de produção) nunca é commitado com valores reais.
- [ ] Em produção, `JWT_SECRET` tem no mínimo 32 caracteres e é exclusivo.
- [ ] Seed/demo nunca é executado em produção.
- [ ] Cada ambiente tem seu próprio `DATABASE_URL`, JWT e pasta de uploads.
- [ ] Em caso de inconsistência (ex.: dev com DATABASE_URL de prod), o backend **não sobe** e exibe erro.

---

## Migração / limpeza após vazamento

Se dados de teste tiverem entrado em produção:

1. **Auditoria:** identificar usuários/registros criados a partir de testes (ex.: emails `@aurix.com`, dados de seed).
2. **Limpeza:** remover ou isolar esses registros (ex.: marcar como inativo, mover para tabela de “lixo”).
3. **Confirmar:** garantir que produção volta a ter apenas dados reais.
4. **Prevenir:** garantir que todos os ambientes usem envs separados e que a validação de ambiente está ativa (loadEnv + validateEnvAndBlockIfUnsafe).

---

## CORS e URLs

- **Desenvolvimento:** `FRONTEND_URL=http://localhost:5173`; backend aceita essa origem.
- **Staging:** `FRONTEND_URL` com a URL do front de homologação.
- **Produção:** `FRONTEND_URL` com a URL do app em produção.

Não use em localhost uma `FRONTEND_URL` ou backend que apontem para produção.

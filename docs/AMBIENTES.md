# Separação de ambientes – Aurix

## Regra principal

**Localhost e homologação NUNCA podem usar banco, auth ou storage de produção.**

Se o backend estiver rodando com `APP_ENV=development` ou `APP_ENV=staging` e a `DATABASE_URL` apontar para um banco de produção (ex.: Render, Supabase de prod), **o servidor não inicia** e exibe erro crítico.

---

## Três ambientes

| Ambiente      | Uso                         | Banco        | Auth/JWT     | Storage (uploads)   |
|--------------|-----------------------------|-------------|--------------|----------------------|
| **development** | Desenvolvimento, testes, seed | Local ou dev | Secret de dev | `uploads_development/` |
| **staging**     | Homologação, QA              | Banco staging | Secret staging | `uploads_staging/`   |
| **production**  | Clientes reais               | Banco prod   | Secret prod   | `uploads/`           |

---

## Variáveis de ambiente

### Backend (obrigatórias por ambiente)

- **APP_ENV** – `development` | `staging` | `production`. Define o ambiente atual.
- **NODE_ENV** – Usado pelo Node (ex.: `development`, `production`).
- **DATABASE_URL** – URL do PostgreSQL. Em dev/staging deve ser banco local ou de dev/staging.
- **JWT_SECRET** – Chave para tokens. Em produção: obrigatório e com pelo menos 32 caracteres.
- **JWT_EXPIRES_IN** – Ex.: `7d`.
- **PORT** – Ex.: `3001`.
- **FRONTEND_URL** – URL do frontend (CORS). Em dev: `http://localhost:5173`.

### Frontend

- **VITE_API_URL** – URL do backend. Em dev normalmente não é definido (usa proxy `/api`).
- **VITE_APP_ENV** – Opcional. Se não definido, em dev é `development`, em build é `production`.

---

## Arquivos de ambiente (backend)

Ordem de carregamento (o último sobrescreve):

1. `.env`
2. `.env.<NODE_ENV>` (ex.: `.env.development`)
3. `.env.local`

**Recomendação:**

- **Desenvolvimento:** copiar `.env.development.example` para `.env.local` e usar banco **local** (ex.: `postgresql://...@localhost:5432/aurix_dev`).
- **Produção:** configurar variáveis no painel do Render/Fly; **nunca** commitar `.env.production` com valores reais.

---

## Validação de segurança (backend)

Na inicialização o backend:

1. Resolve `APP_ENV` (a partir de `APP_ENV` ou `NODE_ENV`).
2. Se **não for produção** e `DATABASE_URL` parecer de produção (ex.: render.com, fly.dev, supabase.co sem marcador dev/staging), **encerra com erro**.
3. Se **for produção** e `DATABASE_URL` parecer de dev (localhost, `aurix_dev`, etc.), **encerra com erro**.
4. Em produção exige `JWT_SECRET` com pelo menos 32 caracteres.

Isso evita rodar local com banco de produção ou produção com banco de dev.

---

## Seed e dados de demonstração

- **Seed (`npx prisma db seed`):** não roda em produção. Em produção o script sai sem criar dados.
- **Demo (gerar/resetar dados demo):** disponível apenas em desenvolvimento e homologação. Em produção a API retorna 403.

Não existe mais bypass (ex.: `ALLOW_EXAMPLE_SEED`, `ALLOW_DEMO_IN_PRODUCTION`).

---

## Storage (uploads)

- **Produção:** arquivos em `uploads/` (compatível com deploys atuais).
- **Desenvolvimento:** `uploads_development/`.
- **Staging:** `uploads_staging/`.

Assim, anexos de dev/staging não compartilham pasta com produção.

---

## Identificação visual (frontend)

Quando `VITE_APP_ENV` (ou modo) não é produção, é exibido um badge na lateral:

- **Ambiente: Desenvolvimento** (azul)
- **Ambiente: Homologação** (amarelo)

Em produção o badge não aparece (ou pode ser discreto).

---

## Logs no startup (backend)

Exemplo de saída:

```
🚀 Server running on http://0.0.0.0:3001
📚 Swagger (APIs): http://localhost:3001/api-docs
[AMBIENTE] APP_ENV=development | DATABASE=local | PORT=3001
[AMBIENTE] ⚠️  Não-produção: use apenas banco/auth/storage de desenvolvimento.
```

Isso ajuda a confirmar que o ambiente e o banco estão corretos antes de usar o sistema.

---

## Checklist antes de subir produção

- [ ] `APP_ENV=production` e `NODE_ENV=production`.
- [ ] `DATABASE_URL` aponta para o banco **exclusivo** de produção.
- [ ] `JWT_SECRET` forte (≥ 32 caracteres) e único.
- [ ] `FRONTEND_URL` é a URL real do frontend em produção.
- [ ] Nunca rodar `prisma db seed` nem “gerar demo” em produção.
- [ ] Backend e frontend não usam `.env` ou URLs de desenvolvimento em produção.

---

## Migração / limpeza do problema atual

Se dados de teste/local já tiverem ido para produção:

1. **Auditoria:** identificar usuários/registros criados em horários de teste ou com emails/names de exemplo.
2. **Limpeza:** remover ou isolar esses registros (ex.: marcar como inativo, mover para tabela de “lixo” ou apagar conforme política).
3. **Novos acessos:** trocar `JWT_SECRET` em produção após a limpeza, para invalidar tokens antigos.
4. **Garantir:** em desenvolvimento usar apenas `.env.local` com banco local (ex.: `aurix_dev`) e nunca apontar para a `DATABASE_URL` de produção.

Com a validação atual, rodar o backend em dev com `DATABASE_URL` de produção passa a ser bloqueado na inicialização.

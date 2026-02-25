# 🇧🇷 Migrar Aurix para Brasil (São Paulo)

Este guia leva **backend** e **banco** para São Paulo para reduzir latência para usuários no Brasil.

- **Banco:** Supabase → região **South America (São Paulo)**  
- **Backend:** Render (Oregon) → **Fly.io** região **São Paulo (gru)**  
- **Frontend:** continua na Vercel (você só atualiza a URL da API)

---

## Visão geral

| Etapa | O quê | Onde |
|-------|--------|------|
| 1 | Novo projeto Supabase em São Paulo | Supabase Dashboard |
| 2 | Migrações + seed no novo banco | Sua máquina |
| 3 | Backend no Fly.io (região gru) | Fly.io |
| 4 | Atualizar frontend (Vercel) com nova URL da API | Vercel + Fly.io |
| 5 | (Opcional) Desligar backend no Render | Render |

---

## Parte 1 — Supabase em São Paulo

### 1.1 Criar novo projeto no Supabase

1. Acesse https://supabase.com/dashboard e faça login.
2. **New project**.
3. Preencha:
   - **Name:** `aurix-br` (ou o nome que quiser).
   - **Database Password:** crie uma senha forte e **guarde**.
   - **Region:** escolha **South America (São Paulo)**.
4. Clique em **Create new project** e espere o projeto subir.

### 1.2 Pegar a connection string

1. No projeto, vá em **Project Settings** (ícone de engrenagem) → **Database**.
2. Em **Connection string**, escolha **URI**.
3. Copie a URL. Ela será algo como:
   ```text
   postgresql://postgres.[PROJECT-REF]:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```
4. Para o Prisma/Node, use a versão **com pooling (porta 6543)** e adicione `?sslmode=require` no final:
   ```text
   postgresql://postgres.[PROJECT-REF]:[SUA_SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require
   ```
5. Substitua `[SUA_SENHA]` pela senha do banco que você definiu no passo 1.1.

Guarde essa URL como **nova** `DATABASE_URL` (você vai usar no backend e localmente).

### 1.3 Rodar migrações e seed no novo banco

Na **pasta do projeto** (raiz ou `backend`), usando a nova URL:

**Opção A — Só trocar no .env e rodar (recomendado)**

1. Abra `backend/.env`.
2. **Substitua** a linha `DATABASE_URL` pela nova URL do Supabase São Paulo (com `?sslmode=require`).
3. No terminal, na pasta **backend**:

```powershell
cd c:\Users\allan\apps\Aurix\backend
npx prisma migrate deploy
npx prisma db seed
```

Se der certo, o banco em SP está com o schema e dados iniciais.

**Opção B — Sem alterar o .env (só para este comando)**

```powershell
cd c:\Users\allan\apps\Aurix\backend
$env:DATABASE_URL="postgresql://postgres.XXX:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
npx prisma migrate deploy
npx prisma db seed
```

Depois, volte o `backend/.env` para a nova URL permanentemente (para rodar o backend local e para o Fly.io).

---

## Parte 2 — Backend no Fly.io (São Paulo)

O backend do Aurix já tem **Dockerfile** e **fly.toml** na pasta `backend`. O Fly.io tem região **São Paulo (gru)**.

### 2.1 Instalar o Fly CLI e fazer login

1. Instale o Fly CLI: https://fly.io/docs/hands-on/install-flyctl/  
   No Windows (PowerShell):

```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

2. Faça login:

```powershell
fly auth login
```

Abra o link no navegador e autorize.

### 2.2 Criar o app na região São Paulo (gru)

No terminal, na pasta **backend**:

```powershell
cd c:\Users\allan\apps\Aurix\backend
fly launch --region gru --name aurix-backend --no-deploy
```

- **--region gru** = São Paulo, Brasil.  
- **--name aurix-backend** = nome do app (pode trocar se já existir outro com esse nome).  
- **--no-deploy** = só cria o app, não sobe ainda (para você configurar variáveis antes).

Se o Fly perguntar "Copy configuration from existing fly.toml?", use o que já está no projeto (Yes).

### 2.3 Variáveis de ambiente no Fly.io

1. No dashboard: https://fly.io/dashboard → escolha o app **aurix-backend** (ou o nome que você deu).  
2. **Secrets** (ou no CLI, veja abaixo).

Configure estas variáveis (valores em segredo):

| Nome | Valor |
|------|--------|
| `DATABASE_URL` | A **nova** URL do Supabase São Paulo (com `?sslmode=require`) |
| `JWT_SECRET` | Mesma string longa que você usa hoje (ou gere uma nova) |
| `JWT_EXPIRES_IN` | `7d` |
| `FRONTEND_URL` | URL do seu frontend na Vercel (ex.: `https://aurix-xxx.vercel.app`) |

**Pelo CLI (substitua os valores):**

```powershell
cd c:\Users\allan\apps\Aurix\backend
fly secrets set DATABASE_URL="postgresql://postgres.XXX:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
fly secrets set JWT_SECRET="sua_string_longa_aqui"
fly secrets set JWT_EXPIRES_IN="7d"
fly secrets set FRONTEND_URL="https://sua-url.vercel.app"
```

(Não precisa setar `PORT`; o Fly já define.)

### 2.4 Fazer o deploy

Ainda na pasta **backend**:

```powershell
fly deploy
```

Aguarde o build e o deploy. No final o Fly mostra a URL do app, por exemplo:

```text
https://aurix-backend.fly.dev
```

Anote essa URL — é a **nova URL da API**.

### 2.5 Testar o backend

- Health: `https://aurix-backend.fly.dev/health`  
  Deve retornar algo como: `{"status":"ok","timestamp":"..."}`  
- Banco: `https://aurix-backend.fly.dev/health/db`  
  Deve retornar: `{"database":"ok",...}`  

Se `/health/db` der erro, confira a `DATABASE_URL` (Supabase SP, com `?sslmode=require`).

---

## Parte 3 — Atualizar o frontend (Vercel)

O frontend precisa apontar para a **nova** URL do backend (Fly.io).

1. Acesse https://vercel.com → seu projeto do Aurix.
2. **Settings** → **Environment Variables**.
3. Edite a variável **VITE_API_URL**:
   - Valor novo: `https://aurix-backend.fly.dev/api`  
   (troque pelo seu app name se tiver usado outro, ex.: `https://SEU-APP.fly.dev/api`).
4. Salve e faça um **redeploy** (Deployments → ... no último deploy → Redeploy).

Depois, teste no navegador: login e um fluxo rápido. Tudo deve ir para o backend no Fly.io e para o banco no Supabase SP.

---

## Parte 4 — CORS no backend (Fly.io)

O backend já usa a variável `FRONTEND_URL` para CORS. Você definiu no passo 2.3 a URL exata do frontend na Vercel (sem barra no final). Se o frontend estiver em outra URL (ex.: outro domínio), adicione no mesmo `FRONTEND_URL` separando por vírgula, ou atualize o valor e rode:

```powershell
fly secrets set FRONTEND_URL="https://sua-url.vercel.app"
```

E faça um novo deploy se precisar: `fly deploy`.

---

## Resumo das URLs (Brasil)

| O quê | URL |
|-------|-----|
| **Frontend** | https://sua-url.vercel.app (Vercel) |
| **Backend (API)** | https://aurix-backend.fly.dev (Fly.io – São Paulo) |
| **Banco** | Supabase – South America (São Paulo) |

---

## Opcional: parar o backend no Render

Se tudo estiver ok com o Fly.io e você não quiser mais o backend no Render:

1. Render Dashboard → serviço **aurix-backend**.
2. **Settings** → **Delete Web Service** (ou pause, se preferir).

Não esqueça: o frontend na Vercel já deve estar usando `VITE_API_URL` apontando para o Fly.io.

---

## Problemas comuns

**Fly: "no default region" ou erro de região**  
- Use sempre: `fly launch --region gru` (e depois `fly deploy` de dentro de `backend`).

**Fly: build falha no Prisma**  
- Confira que está rodando `fly deploy` **de dentro da pasta backend** (onde está o `Dockerfile` e o `prisma`).

**/health/db retorna 503**  
- `DATABASE_URL` deve ser a do **novo** projeto Supabase (São Paulo), com `?sslmode=require`.
- No Supabase, em **Database** → **Connection string**, use a opção **URI** com porta **6543** (pooler).

**Frontend não loga / CORS**  
- Confira `FRONTEND_URL` nos secrets do Fly (URL exata do frontend, sem barra no final).
- Confira `VITE_API_URL` na Vercel: `https://aurix-backend.fly.dev/api`.

---

Quando terminar a Parte 1, 2 ou 3, se algo não bater (erro na tela, no deploy ou no banco), diga em qual parte parou e qual mensagem apareceu que eu te ajudo no próximo passo.

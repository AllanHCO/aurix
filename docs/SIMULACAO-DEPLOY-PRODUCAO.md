# Simulação da postagem em produção

Use este guia para **simular** e **executar** a postagem do Aurix em produção. Você pode fazer tudo da sua máquina seguindo os passos abaixo.

---

## Fase 1 — Simulação local (antes de subir)

Rode estes comandos na pasta do projeto para garantir que o projeto está pronto para produção. Se algo falhar, corrija antes de fazer o deploy real.

### 1.1 Backend

Abra um terminal na **raiz do projeto** (`c:\Users\allan\apps\Aurix`) e execute:

```powershell
cd backend
npm install
npx prisma generate
npm run build
```

**O que verificar:**
- [ ] `npm run build` termina sem erro (pasta `dist` é criada).
- [ ] Existe o arquivo `backend/.env` com `DATABASE_URL` e `JWT_SECRET` (não vai para o GitHub).

### 1.2 Frontend

No mesmo projeto, em outro terminal (ou depois do backend):

```powershell
cd frontend
npm install
npm run build
```

**O que verificar:**
- [ ] `npm run build` termina sem erro (pasta `frontend/dist` é criada).
- [ ] Para testar com API local: crie `frontend/.env` com `VITE_API_URL=http://localhost:3001` (ou a URL do seu backend). Em produção você usa a URL do Render.

### 1.3 Resumo da simulação

Se **backend** e **frontend** derem build sem erro, o projeto está **pronto para postar em produção**.

---

## Fase 2 — Postagem em produção (checklist)

Siga na ordem. Marque cada item conforme for fazendo.

### 2.1 Código no GitHub

- [ ] Repositório criado no GitHub (ex.: `aurix`).
- [ ] Na pasta do projeto:
  ```powershell
  git init
  git add .
  git commit -m "Projeto Aurix inicial"
  git branch -M main
  git remote add origin https://github.com/SEU_USUARIO/aurix.git
  git push -u origin main
  ```
- [ ] Arquivo `.gitignore` na raiz contém: `node_modules`, `.env`, `backend/.env`, `frontend/.env`, `dist` (para não subir senhas nem pastas de build).

### 2.2 Backend no Render

- [ ] Login no https://render.com com GitHub.
- [ ] **New +** → **Web Service** → Conectar repositório **aurix**.
- [ ] Configurar:
  - **Root Directory:** `backend`
  - **Build Command:** `npm install --include=dev && npm run build && npx prisma generate`
  - **Start Command:** `npm start`
- [ ] Variáveis de ambiente no Render:
  - `DATABASE_URL` = (mesma do seu `backend/.env`)
  - `JWT_SECRET` = (string longa; pode gerar com: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
  - `JWT_EXPIRES_IN` = `7d`
  - `PORT` = `3001`
  - `NODE_ENV` = `production`
  - `FRONTEND_URL` = (por enquanto `https://vercel.app`; depois troca pela URL do Vercel)
- [ ] **Create Web Service** e aguardar o deploy.
- [ ] Anotar a URL do backend (ex.: `https://aurix-backend.onrender.com`).
- [ ] Testar no navegador: `https://SUA-URL.onrender.com/health` → deve retornar `{"status":"ok",...}`.

### 2.3 Migrar o banco no Render (produção)

O Render não roda migrações automaticamente. Você pode:

**Opção A — Rodar migração da sua máquina apontando para o mesmo banco:**

Se o `DATABASE_URL` do Render é o **mesmo** do Supabase que você já usa:

- [ ] Na pasta `backend`: `npx prisma migrate deploy` (já deve estar aplicado se você usa o mesmo banco).

**Opção B — Build no Render com migrate no Start (se quiser automatizar):**

No Render, **Start Command** pode ser:

`npx prisma migrate deploy && npm start`

Assim, a cada deploy o Render aplica as migrações e sobe o servidor. Use se o banco for só de produção.

- [ ] Decidido qual opção e executado.

### 2.4 Frontend no Vercel

- [ ] Login no https://vercel.com com GitHub.
- [ ] **Add New...** → **Project** → Importar repositório **aurix**.
- [ ] Configurar:
  - **Root Directory:** `frontend`
  - **Framework Preset:** Vite
  - **Build Command:** `npm run build`
  - **Output Directory:** `dist`
- [ ] Variável de ambiente:
  - **Name:** `VITE_API_URL`
  - **Value:** `https://SUA-URL-DO-RENDER.onrender.com/api` (URL do backend **com** `/api` no final).
- [ ] **Deploy** e aguardar.
- [ ] Anotar a URL do site (ex.: `https://aurix-xxx.vercel.app`).

### 2.5 Ajustar CORS no backend

- [ ] No Render, no serviço do backend, editar **Environment**.
- [ ] **FRONTEND_URL** = URL exata do Vercel (ex.: `https://aurix-xxx.vercel.app`), sem barra no final.
- [ ] Salvar (o Render faz redeploy automático).

### 2.6 Testar o site em produção

- [ ] Abrir a URL do Vercel no navegador.
- [ ] Fazer login (usuário/senha que existem no banco).
- [ ] Testar: Dashboard, Clientes, Produtos, Vendas, Agendamentos (se usar). Se tudo carregar e funcionar, a postagem em produção foi concluída.

---

## Resumo das URLs (preencher após o deploy)

| O quê            | URL |
|------------------|-----|
| **Site (frontend)** | https://________________.vercel.app |
| **API (backend)**  | https://________________.onrender.com |
| **Health check**   | https://________________.onrender.com/health |

---

## Se algo der errado

- **Backend não inicia no Render:** ver **Logs** no Render; conferir Root Directory, Build Command e Start Command.
- **Site abre mas não faz login:** conferir `VITE_API_URL` no Vercel (URL do backend) e `FRONTEND_URL` no Render (URL do Vercel).
- **Backend “dorme” (plano Free):** primeira requisição pode demorar 30–60 s; opcional: usar UptimeRobot para chamar `/health` a cada 5 minutos.

Para mais detalhes, use o **PASSO-A-PASSO-DEPLOY.md** na raiz do projeto.

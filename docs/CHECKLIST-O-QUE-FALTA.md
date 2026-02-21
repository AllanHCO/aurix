# Checklist: o que falta para o Aurix funcionar 100%?

Hoje você tem **um** serviço no Render que:
- Faz o build do backend + frontend
- Sobe só o **frontend** (`serve frontend/dist`)

Ou seja: a **tela** abre, mas a **API não está rodando** em lugar nenhum. Por isso login e dados não funcionam na URL do Render.

---

## O que você precisa fazer

### 1. Backend no ar (API)

Você precisa de **um segundo serviço** no Render só para a API:

1. No Render: **New +** → **Web Service**
2. Repositório: mesmo (Aurix)
3. Configurar:
   - **Name:** `aurix-api` (ou `aurix-backend`)
   - **Root Directory:** `backend`  ← importante
   - **Build Command:** `npm install --include=dev && npm run build && npx prisma generate`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. **Variáveis de ambiente** (Environment):
   - `DATABASE_URL` = mesma do seu `backend/.env` (Supabase)
   - `JWT_SECRET` = string aleatória longa
   - `JWT_EXPIRES_IN` = `7d`
   - `PORT` = `3001`
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = URL do seu frontend no Render (ex: `https://aurix-xxx.onrender.com`)
5. Criar o serviço e esperar o deploy.
6. Testar: abrir no navegador `https://aurix-api.onrender.com/health` (ou a URL que o Render der). Deve aparecer `{"status":"ok",...}`.

Quando isso estiver ok, você tem:
- **Frontend:** `https://aurix-xxx.onrender.com` (já existe)
- **Backend:** `https://aurix-api.onrender.com` (novo)

---

### 2. Site no Render em tela branca? (frontend)

Se **aurix-43dn.onrender.com** (ou a URL do seu frontend) abre em branco mas no localhost funciona, confira:

**A) Root Directory do serviço frontend no Render**

- Se **Root Directory** estiver **vazio** (raiz do repositório):
  - **Build Command:** `npm run build:frontend` ou `npm run build`
  - **Start Command:** `serve frontend/dist -s -l ${PORT:-4173}`
- Se **Root Directory** for **`frontend`**:
  - **Build Command:** `npm run build`
  - **Start Command:** `serve dist -s -l ${PORT:-4173}` ou `npm run start`  
  (não use `serve frontend/dist` quando a raiz do serviço for a pasta `frontend`.)

**B) Variável VITE_API_URL**

- No serviço do **frontend** no Render, em **Environment**, adicione:
  - **Key:** `VITE_API_URL`
  - **Value:** `https://aurix-backend-rh6r.onrender.com/api` (ou a URL do seu backend + `/api`)
- Salve e faça **novo deploy** do frontend (a variável é usada na hora do build).

**C) Conferir no navegador**

- Abra a URL do site, tecla **F12** → aba **Console**. Se aparecer erro 404 em algum arquivo `.js` ou `.css`, o Start Command ou a pasta servida estão errados.
- Na aba **Network**, recarregue a página e veja se algum recurso falha (vermelho).

---

### 3. Frontend chamando a API

O frontend precisa saber a URL da API **na hora do build**. Então:

1. No Render, abra o serviço do **frontend** (o que já existe).
2. Vá em **Environment** (variáveis de ambiente).
3. Adicione:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://aurix-api.onrender.com/api` (troque pela URL real do backend e coloque `/api` no final)
4. Salve.
5. Faça um **novo deploy** desse serviço (Manual Deploy → Deploy latest commit).  
   Só assim o build do frontend usa a nova URL.

Depois disso, ao abrir a URL do frontend e fazer login, o site vai chamar a API no Render.

---

### 4. CORS no backend

O backend só aceita requisições do frontend se a origem estiver em `FRONTEND_URL`.  
Você já deve ter colocado a URL do frontend em `FRONTEND_URL` no passo 1. Se a URL do frontend for outra, ajuste `FRONTEND_URL` no serviço do backend e salve (o Render faz redeploy).

---

## Resumo

| O quê | Onde | Status |
|-------|------|--------|
| Banco (Supabase) | Supabase | ✅ Feito |
| Frontend no ar | Render (1º serviço) | ✅ Feito |
| Backend no ar (API) | Render (2º serviço) | ❌ Falta criar |
| Frontend com URL da API | Variável `VITE_API_URL` + redeploy | ❌ Falta configurar |
| CORS (backend aceitar frontend) | Variável `FRONTEND_URL` no backend | ❌ Falta (ou conferir) |

---

## Depois que tudo estiver ok

- Acessar a URL do **frontend** no Render.
- Login: **admin@aurix.com** / **123456**.
- Usar o sistema (Dashboard, Clientes, Produtos, Vendas).

Opcional mais para frente:
- UptimeRobot para o backend não “dormir” tanto (ping em `/health` a cada 5 min).
- Domínio próprio (ex: aurix.com.br) no Render e/ou Vercel.
- Frontend na Vercel em vez do Render (ver `PASSO-A-PASSO-DEPLOY.md`).

---

## Em uma frase

**Sim, precisa fazer mais duas coisas:** (1) criar um **segundo** serviço no Render só para o **backend** e (2) no serviço do **frontend**, colocar **VITE_API_URL** com a URL desse backend e dar **redeploy**. Depois disso o Aurix funciona de ponta a ponta na nuvem.

# 🚀 Passo a passo: colocar o Aurix no ar (100% grátis)

Siga na ordem. Você já fez a **Parte 1** (Supabase).

---

## ✅ O que você já fez
- [x] Criou o banco no Supabase
- [x] Configurou o `.env` com `DATABASE_URL`
- [x] Rodou `npx prisma migrate deploy`
- [x] Rodou `npx prisma db seed`
- [x] Backend funcionando localmente

---

## 📤 Antes de tudo: subir o código no GitHub

Se o projeto **ainda não** está no GitHub:

1. Crie uma conta em https://github.com (se não tiver).
2. Crie um repositório novo (ex: `aurix`). **Não** marque "Add README".
3. No terminal, na pasta do projeto (`c:\Users\allan\apps\Aurix`):

```bash
git init
git add .
git commit -m "Projeto Aurix inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/aurix.git
git push -u origin main
```

**Importante:** Crie um arquivo `.gitignore` na raiz do projeto (se não existir) com pelo menos:

```
node_modules
.env
backend/.env
frontend/.env
frontend/.env.production
dist
```

Assim a senha do banco não vai para o GitHub.

---

## 🔵 PARTE 2: Backend no Render

### Passo 1: Entrar no Render
1. Acesse https://render.com
2. Clique em **Get Started**
3. Faça login com **GitHub** (authorize o Render)

### Passo 2: Criar o Web Service
1. No dashboard, clique em **New +** → **Web Service**
2. Se pedir, conecte sua conta do GitHub e autorize o repositório **Aurix** (ou o nome que você deu)
3. Selecione o repositório do Aurix
4. Clique em **Connect**

### Passo 3: Configurar o serviço
Preencha assim:

| Campo | Valor |
|-------|--------|
| **Name** | `aurix-backend` |
| **Region** | **Oregon (US West)** ou o mais próximo |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | **Node** |
| **Build Command** | `npm install --include=dev && npm run build && npx prisma generate` |
| | *(O `--include=dev` instala TypeScript e @types/* necessários para o `tsc` no build.)* |
| **Start Command** | `npm start` |
| **Plan** | **Free** |

### Passo 4: Variáveis de ambiente
Role até **Environment Variables** e clique em **Add Environment Variable**.

Adicione **uma por uma**:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Cole a **mesma** string do seu `backend/.env` (a linha do `DATABASE_URL="postgresql://..."`) |
| `JWT_SECRET` | Uma string aleatória longa (ex: gere no terminal, veja abaixo) |
| `JWT_EXPIRES_IN` | `7d` |
| `PORT` | `3001` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Por enquanto use `https://vercel.app` (depois você troca pela URL do seu frontend) |

**Gerar JWT_SECRET no terminal (PowerShell):**
```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copie o resultado e use como valor de `JWT_SECRET`.

### Passo 5: Criar o serviço
1. Clique em **Create Web Service**
2. O Render vai fazer o build e o deploy (pode levar 5–10 minutos)
3. Quando terminar, aparecerá uma URL, tipo:  
   `https://aurix-backend.onrender.com`
4. **Anote essa URL** — é a URL do seu backend.

### Passo 6: Testar o backend
No navegador abra:
- `https://SUA-URL.onrender.com/health`  
Deve aparecer algo como: `{"status":"ok",...}`

Se aparecer, a **Parte 2** está feita.

---

## 🟢 PARTE 3: Frontend no Vercel

### Passo 1: Entrar no Vercel
1. Acesse https://vercel.com
2. Clique em **Sign Up** ou **Log In**
3. Faça login com **GitHub**

### Passo 2: Importar o projeto
1. Clique em **Add New...** → **Project**
2. Na lista, escolha o repositório **Aurix** (ou o nome que você deu)
3. Clique em **Import**

### Passo 3: Configurar o build
Deixe assim:

| Campo | Valor |
|-------|--------|
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` (clique em Edit e coloque `frontend`) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### Passo 4: Variável de ambiente
1. Expanda **Environment Variables**
2. **Name:** `VITE_API_URL`
3. **Value:** `https://SUA-URL-DO-RENDER.onrender.com/api`  
   (troque pela URL que você anotou na Parte 2 e **adicione `/api` no final**)
4. Clique em **Add**

### Passo 5: Fazer o deploy
1. Clique em **Deploy**
2. Aguarde 2–3 minutos
3. Quando terminar, o Vercel mostra a URL do site, tipo:  
   `https://aurix-xxx.vercel.app`
4. **Anote essa URL** — é o seu site no ar.

### Passo 6: Ajustar CORS no backend (Render)
1. Volte no Render → seu serviço **aurix-backend**
2. Vá em **Environment**
3. Edite a variável **FRONTEND_URL** e coloque exatamente a URL do Vercel, ex:  
   `https://aurix-xxx.vercel.app`
4. Salve — o Render faz um novo deploy sozinho.

### Passo 7: Testar o site
1. Abra a URL do Vercel no navegador
2. Faça login com: **admin@aurix.com** / **123456**
3. Navegue (Dashboard, Clientes, Produtos, Vendas). Se tudo carregar e funcionar, o deploy está ok.

---

## 📋 Resumo das URLs

Depois de tudo feito, você terá:

| O quê | URL |
|-------|-----|
| **Site (frontend)** | https://aurix-xxx.vercel.app |
| **API (backend)** | https://aurix-backend.onrender.com |
| **Banco de dados** | Supabase (só pelo backend) |

---

## ❓ Problemas comuns

**Backend não inicia no Render**
- Confira se **Root Directory** é `backend`
- Confira **Build Command** e **Start Command**
- Veja os **Logs** no Render (aba Logs)

**Site abre mas não faz login**
- Confira se `VITE_API_URL` no Vercel está com a URL do Render + `/api`
- Confira se no Render a variável `FRONTEND_URL` é exatamente a URL do Vercel (sem barra no final)

**Backend “dorme” depois de um tempo**
- No plano Free, o Render desliga após ~15 min sem acesso
- A primeira requisição pode demorar 30–60 s
- Opcional: use https://uptimerobot.com para chamar `https://SUA-URL.onrender.com/health` a cada 5 minutos

---

Quando terminar a Parte 2 ou a Parte 3, diga em qual parte você está e o que apareceu na tela (ou o erro) que eu te ajudo no próximo passo.

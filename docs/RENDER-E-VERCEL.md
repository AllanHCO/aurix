# Render e Vercel — explicado de forma simples

## O que são?

São **plataformas de hospedagem na nuvem**: você sobe seu código (via GitHub) e elas **buildam** e **publicam** seu app na internet, gerando uma URL (ex: `https://aurix.onrender.com`).

- **Render** e **Vercel** fazem o “servidor” e a infra por você.
- Você não precisa configurar máquina, IP, domínio ou servidor sozinho.

---

## Render

### O que é
Plataforma que hospeda **backends** (APIs, Node, Python, etc.) e também **sites estáticos** e **bancos**. Muito usada para APIs e serviços que ficam rodando 24h.

### Conceitos principais

| Conceito | O que significa |
|----------|------------------|
| **Web Service** | Serviço que **roda o tempo todo** (ou até “dormir” no plano free). Roda `npm start` ou comando que você definir. Ideal para **backend** (Node/Express). |
| **Static Site** | Só **arquivos estáticos** (HTML, CSS, JS já buildados). Não roda Node no servidor; Render só entrega os arquivos. Ideal para **frontend** (React/Vite depois do build). |
| **Build** | Comando que prepara o app (ex: `npm run build`, `tsc`, `vite build`). Roda uma vez a cada deploy. |
| **Start** | Comando que **sobe o app** (ex: `npm start` → `node dist/server.js`). No Web Service, é isso que fica rodando. |
| **Environment Variables** | Variáveis de ambiente (senhas, URLs, `DATABASE_URL`, `JWT_SECRET`). Você configura no painel; o app lê em `process.env`. |
| **Deploy** | O processo de: pegar o código novo → rodar o Build → (no Web Service) rodar o Start. Cada “deploy” é uma nova versão no ar. |
| **Logs** | Saída do que seu app está fazendo (erros, `console.log`, etc.). Útil para debugar. |

### Plano Free (resumo)
- **Web Service**: grátis, mas o app **“dorme”** depois de ~15 min sem acesso. A primeira requisição depois disso pode demorar 30–60 s.
- **Static Site**: grátis, sem “dormir”.
- Deploy automático quando você dá **push** no GitHub (se auto-deploy estiver ligado).

### No seu projeto (Aurix)
- No Render você pode ter:
  - **1 Web Service** para o **backend** (Node/Express, pasta `backend`, `npm start`).
  - **1 Static Site** ou **1 Web Service** para o **frontend** (arquivos da pasta `frontend/dist` depois do build).
- A URL do backend você usa no frontend (ex: `VITE_API_URL=https://aurix-api.onrender.com/api`).

---

## Vercel

### O que é
Plataforma focada em **frontend** e **funções serverless**: sites estáticos (React, Next, Vite, etc.) e APIs em forma de “funções” que rodam sob demanda.

### Conceitos principais

| Conceito | O que significa |
|----------|------------------|
| **Project** | Um “projeto” = um app (ex: seu frontend Aurix). Ligado a um repositório do GitHub. |
| **Build** | Comando que gera os arquivos do site (ex: `npm run build` no Vite gera a pasta `dist`). |
| **Output Directory** | Pasta com os arquivos que a Vercel vai servir (ex: `dist` para Vite). |
| **Deploy** | Cada push (ou deploy manual) gera uma nova “versão” do site. A versão ligada ao domínio principal é a “production”. |
| **Environment Variables** | Variáveis (ex: `VITE_API_URL`). No build do frontend, viram valores “embutidos” no JS. |
| **Preview** | Cada branch/PR pode ter uma URL de preview (ex: `aurix-git-feature.vercel.app`). |
| **Serverless Functions** | Pequenas APIs que rodam “sob demanda” (não 24h). No Aurix você não precisa disso se o backend está no Render. |

### Plano Free (resumo)
- Sites estáticos e serverless com limite generoso.
- **Não “dorme”**: a primeira visita é rápida.
- Deploy automático ao dar **push** no repositório (quando configurado).
- CDN global: o site é servido de um datacenter perto do usuário.

### No seu projeto (Aurix)
- **Frontend** na Vercel: você conecta o repo, aponta **Root Directory** para `frontend`, configura **Build** e **Output** (`dist`). A Vercel faz o build e serve o site.
- A **API** continua no **Render** (backend). No frontend você só precisa da variável `VITE_API_URL` apontando para essa API.

---

## Render x Vercel — quando usar cada um

| Você quer hospedar… | Melhor opção | Motivo |
|--------------------|--------------|--------|
| **Backend (API Node/Express)** | **Render** (Web Service) | Feito para app que roda o tempo todo; fácil configurar `npm start`, env vars, banco. |
| **Frontend (React/Vite)** | **Vercel** ou **Render** | Vercel: focado em frontend, CDN, sem “dormir”. Render: Static Site ou Web Service com `serve` também funciona. |
| **Só frontend, sem backend** | **Vercel** | Simples, rápido, ótimo para estático. |
| **Backend + frontend no mesmo lugar** | **Render** (2 serviços ou 1 build que gera frontend + backend) | Você pode ter 1 Web Service para API e 1 Static Site (ou outro Web Service) para o site. |

---

## Fluxo geral (como as peças se conectam)

```
[Seu código no PC]
        │
        │  git push origin main
        ▼
   [GitHub]
        │
   ┌────┴────┐
   │         │
   ▼         ▼
[Render]  [Vercel]
   │         │
   │         │  build do frontend
   │         │  (usa VITE_API_URL = URL do Render)
   │         │
   │         ▼
   │    [Site estático]
   │    (HTML, CSS, JS)
   │         │
   │  build do backend
   │  (Node, npm start)
   │         │
   ▼         │
[API no ar]  │
   │         │
   └────┬────┘
        │
   Usuário acessa o site (Vercel)
   → o site chama a API (Render)
   → a API fala com o banco (Supabase)
```

- **GitHub**: onde está o código.
- **Render**: roda o backend (e, se quiser, pode servir o frontend também).
- **Vercel**: focado em servir o frontend (build + CDN).
- **Supabase**: banco de dados (já configurado por você).

---

## Resumo em uma frase

- **Render**: “Servidor” para backend (e opcionalmente para o frontend); você define comando de build e de start, e as variáveis de ambiente.
- **Vercel**: Focada em colocar **frontend** no ar com build automático, CDN e deploy a cada push; ideal para React/Vite/Next.

Os dois podem trabalhar juntos: **backend no Render, frontend na Vercel**, com o frontend apontando para a URL da API no Render (`VITE_API_URL`).

---

## Link público de agendamento (/agenda/:slug)

A rota **/agenda/:slug** (ex: `/agenda/minhaempresa`) é **pública** (sem login). Para funcionar:

1. **Frontend (SPA):** Se o frontend for servido como Static Site no **Render**, configure um **rewrite** para que todas as rotas que não forem arquivo estático sirvam `index.html`:
   - No painel do Render → Static Site → **Redirects/Rewrites**: adicione uma regra do tipo **Rewrite**: `/*` → `/index.html` (ou conforme a opção disponível no painel).
   - Assim, ao acessar `https://seusite.onrender.com/agenda/minhaempresa` o servidor entrega o `index.html` e o React Router exibe a página de agendamento.

2. **Vercel:** O projeto já tem `frontend/vercel.json` com `"rewrites": [{"source": "/(.*)", "destination": "/index.html"}]`, então `/agenda/:slug` já cai no SPA.

3. **Backend:** As rotas públicas são prefixadas com `/api/public/agenda` e não exigem autenticação. CORS está liberado para a origem do frontend (e para rotas públicas aceita qualquer origem).

# 🚀 Guia de Deploy - Aurix

## Opção Recomendada: Vercel (Frontend) + Railway (Backend + DB)

### 📋 Pré-requisitos
- Conta no GitHub
- Conta no Vercel (grátis): https://vercel.com
- Conta no Railway (pago, ~$5-10/mês): https://railway.app

---

## 🔵 PARTE 1: Backend + Banco de Dados (Railway)

### 1.1. Criar projeto no Railway
1. Acesse https://railway.app
2. Faça login com GitHub
3. Clique em "New Project"
4. Selecione "Deploy from GitHub repo"
5. Escolha o repositório do Aurix
6. Selecione a pasta `backend`

### 1.2. Adicionar PostgreSQL
1. No projeto Railway, clique em "+ New"
2. Selecione "Database" → "PostgreSQL"
3. Railway criará automaticamente o banco
4. Copie a variável `DATABASE_URL` que aparece

### 1.3. Configurar Variáveis de Ambiente
No Railway, vá em "Variables" e adicione:
```
DATABASE_URL=<valor copiado do PostgreSQL>
JWT_SECRET=<gere uma string aleatória longa>
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://seu-site.vercel.app
```

### 1.4. Deploy do Backend
1. Railway detecta automaticamente Node.js
2. Configure o "Start Command": `npm start`
3. Railway fará o build e deploy automaticamente
4. Anote a URL gerada (ex: `https://aurix-backend.railway.app`)

### 1.5. Rodar Migrations
No terminal do Railway (ou via CLI):
```bash
npx prisma migrate deploy
npx prisma generate
```

---

## 🟢 PARTE 2: Frontend (Vercel)

### 2.1. Preparar Frontend
1. Crie arquivo `frontend/.env.production`:
```env
VITE_API_URL=https://seu-backend.railway.app/api
```

### 2.2. Deploy no Vercel
1. Acesse https://vercel.com
2. Faça login com GitHub
3. Clique em "Add New Project"
4. Importe o repositório do Aurix
5. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### 2.3. Variáveis de Ambiente no Vercel
Adicione:
```
VITE_API_URL=https://seu-backend.railway.app/api
```

### 2.4. Deploy
1. Clique em "Deploy"
2. Aguarde o build (2-3 minutos)
3. Vercel gerará uma URL (ex: `https://aurix.vercel.app`)

---

## 🔧 PARTE 3: Ajustes Finais

### 3.1. Atualizar CORS no Backend
No Railway, atualize a variável:
```
FRONTEND_URL=https://seu-site.vercel.app
```

### 3.2. Atualizar API URL no Frontend
No Vercel, atualize:
```
VITE_API_URL=https://seu-backend.railway.app/api
```

### 3.3. Testar
1. Acesse a URL do Vercel
2. Faça login
3. Teste todas as funcionalidades

---

## 🌐 PARTE 4: Domínio Próprio (Opcional)

### 4.1. Comprar Domínio
- Registro.br (Brasil)
- Namecheap
- Google Domains

### 4.2. Configurar no Vercel
1. Vá em "Settings" → "Domains"
2. Adicione seu domínio
3. Configure os DNS conforme instruções

### 4.3. Configurar no Railway
1. No projeto backend, vá em "Settings" → "Networking"
2. Adicione domínio customizado (se disponível)

---

## 💰 Custos Estimados

### Opção Básica (Recomendada para começar):
- **Vercel**: Grátis (até 100GB bandwidth/mês)
- **Railway**: ~$5-10/mês (Hobby plan)
- **Domínio**: ~R$ 30-50/ano (opcional)
- **Total**: ~R$ 30-50/mês

### Opção Escalável:
- **Vercel Pro**: $20/mês (mais bandwidth)
- **Railway**: $20/mês (mais recursos)
- **Total**: ~R$ 200/mês

---

## 📝 Checklist Pós-Deploy

- [ ] Backend rodando e acessível
- [ ] Banco de dados conectado
- [ ] Migrations rodadas
- [ ] Frontend acessível
- [ ] Login funcionando
- [ ] Todas as rotas testadas
- [ ] HTTPS configurado
- [ ] Variáveis de ambiente corretas
- [ ] Logs funcionando
- [ ] Backup do banco configurado (Railway faz automaticamente)

---

## 🆘 Troubleshooting

### Backend não conecta ao banco
- Verifique `DATABASE_URL` no Railway
- Confirme que o PostgreSQL está rodando
- Rode migrations novamente

### Frontend não conecta ao backend
- Verifique `VITE_API_URL` no Vercel
- Confirme CORS no backend (`FRONTEND_URL`)
- Verifique logs no Railway

### Erro 404 no frontend
- Configure "Rewrites" no Vercel:
  - Source: `/(.*)`
  - Destination: `/index.html`

---

## 📚 Recursos Úteis

- [Documentação Vercel](https://vercel.com/docs)
- [Documentação Railway](https://docs.railway.app)
- [Prisma Deploy](https://www.prisma.io/docs/guides/deployment)

---

## 🎯 Próximos Passos

1. **Monitoramento**: Configure logs e alertas
2. **Backup**: Configure backup automático do banco
3. **Analytics**: Adicione Google Analytics ou similar
4. **SEO**: Configure meta tags e sitemap
5. **Performance**: Otimize imagens e assets
6. **Segurança**: Configure rate limiting e validações

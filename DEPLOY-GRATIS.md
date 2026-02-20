# 🆓 Deploy 100% GRÁTIS - Aurix

## 🎯 Opção Recomendada: Vercel + Render + Supabase

**Tudo grátis para começar! Sem cartão de crédito necessário.**

---

## 📋 Pré-requisitos
- Conta no GitHub (grátis)
- Conta no Vercel (grátis): https://vercel.com
- Conta no Render (grátis): https://render.com
- Conta no Supabase (grátis): https://supabase.com

---

## 🟢 PARTE 1: Banco de Dados (Supabase) - GRÁTIS

### 1.1. Criar Projeto no Supabase
1. Acesse https://supabase.com
2. Clique em "Start your project"
3. Faça login com GitHub
4. Clique em "New Project"
5. Preencha:
   - **Name**: aurix-db
   - **Database Password**: (anote essa senha!)
   - **Region**: South America (São Paulo) - mais próximo
   - **Pricing Plan**: Free
6. Clique em "Create new project"
7. Aguarde 2-3 minutos para criar

### 1.2. Obter String de Conexão
1. No projeto Supabase, vá em "Settings" → "Database"
2. Role até "Connection string"
3. Selecione "URI"
4. Copie a string (ex: `postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres`)
5. **Substitua `[PASSWORD]` pela senha que você criou**

### 1.3. Configurar Prisma para Supabase
1. No seu projeto, edite `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:SUA_SENHA@db.xxx.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1"
```

2. Rode as migrations:
```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

**Limites do Supabase Free:**
- ✅ 500 MB de banco de dados
- ✅ 2 GB de bandwidth
- ✅ Sem limite de tempo
- ✅ Backup automático

---

## 🔵 PARTE 2: Backend (Render) - GRÁTIS

### 2.1. Criar Web Service no Render
1. Acesse https://render.com
2. Faça login com GitHub
3. Clique em "New +" → "Web Service"
4. Conecte seu repositório GitHub
5. Configure:
   - **Name**: aurix-backend
   - **Region**: São Paulo (se disponível) ou US East
   - **Branch**: main
   - **Root Directory**: backend
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build && npx prisma generate`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 2.2. Configurar Variáveis de Ambiente
No Render, vá em "Environment" e adicione:
```
DATABASE_URL=<sua string do Supabase>
JWT_SECRET=<gere uma string aleatória longa>
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://seu-site.vercel.app
```

**Como gerar JWT_SECRET:**
```bash
# No terminal:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2.3. Deploy
1. Clique em "Create Web Service"
2. Render começará o build automaticamente
3. Aguarde 5-10 minutos
4. Anote a URL gerada (ex: `https://aurix-backend.onrender.com`)

**⚠️ IMPORTANTE - Limites do Render Free:**
- ✅ Grátis para sempre
- ⚠️ **Spins down após 15 minutos de inatividade**
- ⚠️ **Primeira requisição após spin down pode demorar 30-60s**
- ✅ 750 horas/mês grátis (mais que suficiente)

**Solução para o spin down:**
- Use um serviço como UptimeRobot (grátis) para fazer ping a cada 5 minutos
- Ou aceite o delay inicial (usuários entenderão)

---

## 🟢 PARTE 3: Frontend (Vercel) - GRÁTIS

### 3.1. Preparar Frontend
1. Crie arquivo `frontend/.env.production`:
```env
VITE_API_URL=https://seu-backend.onrender.com/api
```

### 3.2. Deploy no Vercel
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

### 3.3. Variáveis de Ambiente no Vercel
Adicione:
```
VITE_API_URL=https://seu-backend.onrender.com/api
```

### 3.4. Deploy
1. Clique em "Deploy"
2. Aguarde 2-3 minutos
3. Vercel gerará uma URL (ex: `https://aurix.vercel.app`)

**Limites do Vercel Free:**
- ✅ 100 GB bandwidth/mês
- ✅ Deploys ilimitados
- ✅ HTTPS automático
- ✅ Sem limite de tempo

---

## 🔧 PARTE 4: Manter Backend Ativo (Opcional)

### Opção A: UptimeRobot (Recomendado)
1. Acesse https://uptimerobot.com
2. Crie conta grátis
3. Adicione novo monitor:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: Aurix Backend
   - **URL**: `https://seu-backend.onrender.com/health`
   - **Monitoring Interval**: 5 minutes
4. Isso manterá o backend sempre ativo

### Opção B: Cron Job no Vercel
Crie `api/keep-alive.ts` no frontend:
```typescript
export default async function handler(req: any, res: any) {
  await fetch('https://seu-backend.onrender.com/health');
  res.status(200).json({ ok: true });
}
```

Configure cron no Vercel (via dashboard) para rodar a cada 5 minutos.

---

## 📊 Comparação de Limites

### Supabase (Free)
- ✅ 500 MB banco de dados
- ✅ 2 GB bandwidth
- ✅ Backup automático
- ✅ Sem limite de tempo

### Render (Free)
- ✅ 750 horas/mês
- ✅ 512 MB RAM
- ✅ Spin down após 15min inatividade
- ✅ Sem limite de tempo

### Vercel (Free)
- ✅ 100 GB bandwidth/mês
- ✅ Deploys ilimitados
- ✅ Sem limite de tempo

---

## 🎯 Checklist de Deploy

- [ ] Supabase criado e configurado
- [ ] Migrations rodadas no Supabase
- [ ] Backend deployado no Render
- [ ] Variáveis de ambiente configuradas
- [ ] Frontend deployado no Vercel
- [ ] URLs atualizadas (CORS e API)
- [ ] Testado login e funcionalidades
- [ ] UptimeRobot configurado (opcional)

---

## 🆘 Troubleshooting

### Backend não conecta ao banco
- Verifique `DATABASE_URL` no Render
- Confirme que a senha está correta
- Teste a conexão localmente primeiro

### Backend demora para responder
- Normal no Render Free (spin down)
- Configure UptimeRobot para manter ativo
- Ou considere upgrade para plano pago ($7/mês)

### Frontend não conecta ao backend
- Verifique `VITE_API_URL` no Vercel
- Confirme CORS no backend (`FRONTEND_URL`)
- Verifique logs no Render

### Erro de CORS
- No Render, adicione:
```
FRONTEND_URL=https://seu-site.vercel.app
```

---

## 💡 Dicas

1. **Comece grátis**: Teste tudo antes de pagar
2. **Monitore uso**: Acompanhe limites no dashboard
3. **Upgrade quando necessário**: Quando crescer, migre para planos pagos
4. **Backup**: Supabase faz backup automático, mas exporte dados periodicamente

---

## 🚀 Quando Fazer Upgrade?

**Considere upgrade quando:**
- Backend recebe muitas requisições (Render Free pode ser lento)
- Banco passa de 500 MB (Supabase)
- Precisa de mais performance
- Quer remover limitações

**Custos de upgrade:**
- Render: $7/mês (remove spin down)
- Supabase: $25/mês (8 GB banco)
- Vercel: $20/mês (mais bandwidth)

**Total upgrade**: ~R$ 150/mês (ainda muito barato!)

---

## ✅ Vantagens desta Stack Grátis

- ✅ **100% grátis** para começar
- ✅ **Sem cartão de crédito** necessário
- ✅ **Escalável** - fácil migrar para planos pagos
- ✅ **Profissional** - mesmo stack usado por grandes empresas
- ✅ **Sem surpresas** - limites claros e transparentes

---

**Pronto para começar! 🎉**

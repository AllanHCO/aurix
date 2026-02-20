# 🚀 Guia Rápido de Início

## Passo a Passo para Rodar o Projeto

### 1. Instalar Dependências

```bash
npm run install:all
```

### 2. Configurar Banco de Dados

1. Crie o banco PostgreSQL:
```sql
CREATE DATABASE aurix;
```

2. Configure o `.env` do backend:
```bash
cd backend
cp .env.example .env
```

Edite o `.env` com suas credenciais do PostgreSQL.

### 3. Executar Migrations

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 4. Iniciar Aplicação

Na raiz do projeto:
```bash
npm run dev
```

Isso iniciará:
- ✅ Backend: http://localhost:3001
- ✅ Frontend: http://localhost:5173

### 5. Acessar a Aplicação

Abra http://localhost:5173 no navegador.

**Credenciais padrão:**
- Email: `admin@aurix.com`
- Senha: `123456`

## 🎯 Próximos Passos

1. Faça login com as credenciais acima
2. Explore o Dashboard
3. Adicione produtos ao estoque
4. Cadastre clientes
5. Registre sua primeira venda!

## ⚠️ Problemas Comuns

### Erro de conexão com banco
- Verifique se o PostgreSQL está rodando
- Confirme as credenciais no `.env`
- Teste a conexão: `psql -U seu_usuario -d aurix`

### Porta já em uso
- Backend: Altere `PORT` no `.env`
- Frontend: Altere `port` no `vite.config.ts`

### Erro de migrations
- Delete a pasta `backend/prisma/migrations` (se existir)
- Execute novamente: `npm run prisma:migrate`

## 📚 Documentação Completa

Veja o [README.md](./README.md) para mais detalhes.

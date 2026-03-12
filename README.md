# 🚀 Aurix - Sistema de Gestão Comercial

Sistema SaaS web de gestão comercial para pequenos negócios (mecânicos, barbearias, lojas, autônomos).

## 📋 Características

- ✅ **Autenticação** - Login e cadastro de usuários
- 📊 **Dashboard** - Métricas em tempo real (faturamento, vendas, estoque baixo)
- 📦 **Produtos** - CRUD completo com controle de estoque
- 👤 **Clientes** - Gestão de clientes com histórico de compras
- 💰 **Vendas** - Registro de vendas com controle de estoque automático
- 📈 **Relatórios** - Relatórios por período com exportação CSV

## 🛠️ Stack Tecnológica

### Backend
- Node.js + Express
- TypeScript
- PostgreSQL
- Prisma ORM
- JWT para autenticação
- bcryptjs para hash de senhas

### Frontend
- React + TypeScript
- Vite
- React Router
- React Hook Form + Zod
- Tailwind CSS
- Axios
- React Hot Toast

## 📦 Pré-requisitos

- Node.js 18+ 
- PostgreSQL 14+
- npm ou yarn

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone <seu-repositorio>
cd Aurix
```

### 2. Instale as dependências

```bash
npm run install:all
```

### 3. Configure o banco de dados

1. Crie um banco PostgreSQL:
```sql
CREATE DATABASE aurix;
```

2. Configure as variáveis de ambiente do backend:
```bash
cd backend
cp .env.example .env
```

3. Edite o arquivo `.env` com suas credenciais (use **apenas** banco e credenciais de **desenvolvimento**; nunca use produção em máquina local):
```env
DATABASE_URL="postgresql://user:password@localhost:5432/aurix?schema=public"
JWT_SECRET="seu-secret-super-seguro-aqui"
JWT_EXPIRES_IN="7d"
PORT=3001
FRONTEND_URL="http://localhost:5173"
```

> **Separação de ambientes:** Localhost nunca deve usar banco, auth ou storage de produção. Para regras completas, arquivos `.env` por ambiente e validações, veja **[docs/ENV.md](docs/ENV.md)**.

### 4. Execute as migrations

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 5. Inicie os servidores

Na raiz do projeto:
```bash
npm run dev
```

Isso iniciará:
- Backend em `http://localhost:3001`
- Frontend em `http://localhost:5173`

## 📝 Credenciais Padrão

Após executar o seed:
- **Email:** admin@aurix.com
- **Senha:** 123456

## 🏗️ Estrutura do Projeto

```
Aurix/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Lógica de negócio
│   │   ├── routes/         # Rotas da API
│   │   ├── middleware/     # Middlewares (auth, error handler)
│   │   ├── prisma/         # Seed do banco
│   │   └── server.ts       # Entry point
│   ├── prisma/
│   │   └── schema.prisma  # Schema do banco
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── contexts/       # Context API (Auth)
│   │   ├── pages/          # Páginas da aplicação
│   │   ├── services/       # API client
│   │   └── utils/          # Funções utilitárias
│   └── package.json
└── package.json           # Workspace root
```

## 🔐 Regras de Negócio Implementadas

### Vendas
- ✅ Vendas com status "PAGO" diminuem estoque automaticamente
- ✅ Vendas "PENDENTE" não alteram estoque
- ✅ Validação de estoque antes de finalizar venda paga
- ✅ Cálculo automático: `soma(produto * quantidade) - desconto`

### Dashboard
- ✅ Faturamento calculado apenas com vendas "PAGO"
- ✅ Atualização em tempo real após registrar venda
- ✅ Alertas visuais para produtos com estoque baixo

### Produtos
- ✅ Não permite estoque negativo
- ✅ Alerta visual quando `estoque_atual <= estoque_minimo`
- ✅ Validação de campos obrigatórios

### Clientes
- ✅ Histórico de compras por cliente
- ✅ Total gasto calculado apenas com vendas pagas

## 🧪 Testes

Para testar as funcionalidades:

1. **Login/Cadastro**: Acesse `/login` ou `/register`
2. **Dashboard**: Visualize métricas em `/dashboard`
3. **Produtos**: CRUD completo em `/produtos`
4. **Clientes**: CRUD completo em `/clientes`
5. **Vendas**: Registre vendas em `/vendas`
6. **Relatórios**: Gere relatórios em `/relatorios`

## 📦 Deploy

### Backend

1. Configure variáveis de ambiente no servidor
2. Execute migrations: `npm run prisma:migrate deploy`
3. Build: `npm run build`
4. Inicie: `npm start`

### Frontend

1. Build: `npm run build`
2. Servir arquivos estáticos da pasta `dist/`

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.

## 🎯 Próximos Passos (V2)

- [ ] Múltiplos usuários por conta
- [ ] CRM avançado
- [ ] Metas e dashboards complexos
- [ ] Relatórios financeiros avançados
- [ ] Notificações em tempo real
- [ ] App mobile

---

Desenvolvido com ❤️ para pequenos negócios

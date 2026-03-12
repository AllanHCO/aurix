# Subir para produção agora (com melhorias de ambiente e multi-tenant)

Siga **nesta ordem**. Não pule o passo do banco.

---

## 1. Migrar o banco de PRODUÇÃO (obrigatório antes do deploy)

O código novo exige as colunas `usuario_id` em **categorias**, **clientes** e **produtos**. Se você subir o backend sem migrar, a API vai quebrar.

### Se o banco de produção for no Supabase

1. Acesse o **projeto de produção** no [Supabase](https://supabase.com/dashboard).
2. Vá em **SQL Editor**.
3. Abra o arquivo `backend/prisma/migrations_add_tenant_usuario_id.sql` no seu projeto e **copie todo o conteúdo**.
4. (Opcional) Ajuste o script se precisar: por exemplo, se não existir nenhum usuário em `usuarios`, o backfill pode falhar — nesse caso crie primeiro um usuário manualmente ou adapte o `SELECT id FROM usuarios LIMIT 1`.
5. Cole o SQL no editor do Supabase e execute (**Run**).
6. Confira se não deu erro (todas as colunas criadas, índices ok).

### Se o banco for em outro lugar (VPS, Railway, etc.)

Rode o mesmo SQL no banco de produção (por exemplo com `psql` ou cliente gráfico):

```bash
psql "SUA_DATABASE_URL_DE_PRODUCAO" -f backend/prisma/migrations_add_tenant_usuario_id.sql
```

**Dica:** faça backup do banco antes (export ou snapshot).

---

## 2. Variáveis de ambiente no Fly.io (backend)

As variáveis no Fly são **secrets**. Na pasta **backend**, no terminal:

```powershell
cd c:\Users\allan\apps\Aurix\backend
fly secrets set NODE_ENV=production
fly secrets set APP_ENV=production
fly secrets set DATABASE_URL="postgresql://..."   # URL do banco de PRODUÇÃO
fly secrets set JWT_SECRET="sua-chave-forte-min-32-caracteres"
fly secrets set FRONTEND_URL="https://seu-app.vercel.app"   # URL do front, sem barra no final
```

(Substitua os valores pelas suas credenciais e URL do front.)

Se já estiverem configurados, não precisa mudar. Só confira que **DATABASE_URL** é a de produção e **FRONTEND_URL** é a URL exata da Vercel.

---

## 3. Subir o código

### Opção A — Push no Git (se o Fly estiver ligado ao GitHub)

Na pasta do projeto:

```powershell
cd c:\Users\allan\apps\Aurix
git add .
git status
git commit -m "Deploy: isolamento por ambiente e multi-tenant (usuario_id em categorias, clientes, produtos)"
git push origin main
```

- **Fly.io** (backend): deploy automático se o app estiver conectado ao repositório.
- **Vercel** (frontend): idem.

### Opção B — Deploy manual do backend no Fly

Se preferir (ou se o Fly não fizer deploy automático):

```powershell
cd c:\Users\allan\apps\Aurix\backend
fly deploy
```

O frontend continua subindo pela Vercel ao dar `git push origin main`.

Aguarde alguns minutos até o build terminar.

---

## 4. Conferir

1. **Backend:** abra `https://SEU-APP.fly.dev/health` (ou a URL do seu app no Fly). Deve retornar `{"status":"ok",...}` e não erro 500.
2. **Frontend:** abra a URL da Vercel, faça login e teste uma tela (ex.: listar clientes ou produtos). Se aparecer erro de “coluna não existe”, o passo 1 não foi aplicado no banco de produção.
3. Na Vercel, a variável **VITE_API_URL** deve apontar para o backend no Fly, por exemplo: `https://seu-app.fly.dev/api` (com `/api` no final). Se mudou de Render para Fly, atualize essa variável e faça um novo deploy do frontend.

---

## Resumo

| Passo | O quê |
|-------|--------|
| 1 | Rodar `migrations_add_tenant_usuario_id.sql` no **banco de produção** |
| 2 | Conferir secrets no Fly (NODE_ENV, APP_ENV, DATABASE_URL, JWT_SECRET, FRONTEND_URL) |
| 3 | `git push origin main` e/ou `cd backend && fly deploy` |
| 4 | Testar /health no Fly e o app no frontend (Vercel); conferir VITE_API_URL se precisar |

Depois disso, as melhorias (ambiente e multi-tenant) estarão em produção. O banco de dev você ajusta quando for usar (reset + seed ou rodar o mesmo SQL no banco de dev).

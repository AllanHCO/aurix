# Deploy no Fly.io (São Paulo)

Backend + frontend sobem juntos em um único app.

## Pré-requisitos

- Fly CLI instalado e logado (`fly auth login`)
- `DATABASE_URL` do Supabase SP em mãos
- `JWT_SECRET` (o mesmo que você usa hoje ou um novo)

## Passos

1. **Abra o terminal na raiz do projeto**
   ```
   cd c:\Users\allan\apps\Aurix
   ```

2. **Criar o app no Fly (só na primeira vez)**
   ```
   fly launch --no-deploy
   ```
   - Nome do app: pode usar `aurix-prod` (ou outro que quiser)
   - Região: **gru** (São Paulo)
   - Criar Postgres no Fly? **Não** (você usa Supabase)

3. **Configurar variáveis de ambiente (secrets)**
   ```
   fly secrets set DATABASE_URL="sua-url-do-supabase-sp-aqui"
   fly secrets set JWT_SECRET="seu-jwt-secret-aqui"
   ```
   Cole a `DATABASE_URL` completa do Supabase SP (com `?sslmode=require` no final, se o Supabase exigir).

   Se você usa outras variáveis (e-mail, etc.), adicione:
   ```
   fly secrets set NOME_DA_VAR="valor"
   ```

4. **Deploy**
   ```
   fly deploy
   ```

5. **Testar**
   - Acesse: `https://<nome-do-app>.fly.dev`
   - Faça login e use o sistema normalmente.

## Comandos úteis

- Ver logs: `fly logs`
- Abrir o app no navegador: `fly open`
- Listar secrets: `fly secrets list`

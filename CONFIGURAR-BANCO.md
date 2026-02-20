# Guia: Configurar o banco de dados do Aurix

Siga na ordem. Se travar em algum passo, anote em qual e peça ajuda.

---

## Passo 1: Abrir o pgAdmin

1. No Windows, procure por **pgAdmin** no menu Iniciar.
2. Abra o pgAdmin.
3. Na primeira vez pode pedir uma senha “master” — crie uma e anote (ou pule se permitir).
4. Na coluna da **esquerda** aparece “Servers”. Clique na setinha para expandir.
5. Clique em **PostgreSQL** (ou no nome do seu servidor). Pode pedir a **senha do PostgreSQL** — é a senha que você definiu quando instalou o PostgreSQL. Digite e marque “Save password” se quiser.

---

## Passo 2: Criar o banco “aurix”

1. Com o servidor expandido, clique com o **botão direito** em **Databases**.
2. Escolha **Create** → **Database...**
3. No campo **Database** escreva: `aurix`
4. Em **Owner** pode deixar como está (geralmente “postgres”).
5. Clique em **Save**.

Pronto: o banco `aurix` foi criado.

---

## Passo 3: Ajustar o arquivo .env

1. Abra a pasta do projeto no computador: `C:\Users\allan\apps\Aurix\backend`
2. Procure o arquivo **`.env`** (pode estar “escondido” — no Explorer, em “Exibir” ative “Itens ocultos” ou “Arquivos ocultos”).
3. Abra o `.env` com o Bloco de Notas (ou Cursor/VS Code).
4. Na primeira linha você vai ver algo assim:
   ```env
   DATABASE_URL="postgresql://postgres:sua_senha@localhost:5432/aurix?schema=public"
   ```
5. Troque **apenas** `sua_senha` pela **senha real** que você usa para entrar no PostgreSQL no pgAdmin.
   - Exemplo: se sua senha for `12345`, fica:
     ```env
     DATABASE_URL="postgresql://postgres:12345@localhost:5432/aurix?schema=public"
     ```
6. Se no PostgreSQL você usa outro **usuário** (em vez de `postgres`), troque também a palavra `postgres` antes dos dois pontos.
7. Salve o arquivo e feche.

---

## Passo 4: Rodar as migrations (criar tabelas)

1. Abra o **Prompt de Comando** (CMD) ou **PowerShell**.
2. Vá na pasta do backend e rode os comandos **um por vez**:

```bash
cd C:\Users\allan\apps\Aurix\backend
```

Depois:

```bash
npx prisma migrate dev --name init
```

- Se pedir para criar a pasta de migrations, digite **y** e Enter.
- Se der erro de conexão, a senha ou o nome do banco no `.env` estão errados — volte ao Passo 3.

---

## Passo 5: Criar o usuário inicial (seed)

No **mesmo** terminal, ainda na pasta `backend`:

```bash
npm run prisma:seed
```

Ou:

```bash
npx prisma db seed
```

Isso cria o usuário:
- **Email:** admin@aurix.com  
- **Senha:** 123456  

---

## Passo 6: Subir o backend e testar

1. No terminal:

```bash
npm run dev
```

2. Deixe o terminal aberto (deve aparecer “Server running on http://localhost:3001”).
3. No **Insomnia**, faça de novo o **POST** para:
   - URL: `http://localhost:3001/api/auth/login`
   - Body (JSON):
     ```json
     {
       "email": "admin@aurix.com",
       "senha": "123456"
     }
     ```

Se tudo estiver certo, a resposta virá com **token** e dados do usuário, sem erro 500.

---

## Resumo rápido

| O quê              | Onde / Como                                      |
|--------------------|--------------------------------------------------|
| Criar banco        | pgAdmin → Databases → Create → Database → `aurix` |
| Senha do banco     | Arquivo `backend\.env` → `DATABASE_URL`          |
| Criar tabelas      | `npx prisma migrate dev --name init`             |
| Criar usuário admin| `npm run prisma:seed` ou `npx prisma db seed`     |
| Subir o servidor   | `npm run dev` na pasta `backend`                 |

Se parar em algum passo, diga qual número (1, 2, 3…) e o que apareceu na tela (ou envie um print) que eu te ajudo no próximo passo.

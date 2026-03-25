# Comandos Git para subir em produção

Rode na pasta do projeto (`c:\Users\allan\apps\Aurix`). Pode colar no PowerShell ou CMD.

---

## Opção 1 — Rodar o script

```powershell
cd c:\Users\allan\apps\Aurix
.\subir-producao.ps1
```

Se der erro de política de execução:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\subir-producao.ps1
```

---

## Opção 2 — Comandos um a um (copiar e colar)

```powershell
cd c:\Users\allan\apps\Aurix
```

```powershell
git add .
```

```powershell
git status
```
*(só para conferir o que vai no commit)*

```powershell
git commit -m "Deploy: dashboard, tema, performance, docs e ajustes para produção"
```

```powershell
git push origin main
```

---

## Se ainda não tiver configurado o remote (primeira vez)

```powershell
git remote add origin https://github.com/SEU_USUARIO/aurix.git
git branch -M main
git push -u origin main
```

*(Troque `SEU_USUARIO` e `aurix` pelo seu usuário e nome do repositório no GitHub.)*

---

## Depois do push

- **Fly.io** (backend): faz deploy automático ao detectar o push no `main` (se o app estiver conectado ao GitHub). Senão, rode `cd backend && fly deploy`.
- **Vercel** (frontend): idem.

Só aguardar alguns minutos e testar as URLs.

---

## Fly.io: se o app reiniciar com "JWT_SECRET é obrigatório"

O backend em produção exige **secrets** no Fly. Configure (uma vez) na pasta do backend:

```powershell
cd c:\Users\allan\apps\Aurix\backend
fly secrets set NODE_ENV=production -a aurix-prod
fly secrets set APP_ENV=production -a aurix-prod
fly secrets set DATABASE_URL="postgresql://usuario:senha@host:5432/banco" -a aurix-prod
fly secrets set JWT_SECRET="uma-chave-secreta-com-pelo-menos-32-caracteres-aqui" -a aurix-prod
fly secrets set FRONTEND_URL="https://seu-front.vercel.app" -a aurix-prod
```

- **JWT_SECRET**: mínimo 32 caracteres (use uma frase longa ou gere em https://generate-secret.vercel.app/32 ).
- **DATABASE_URL**: URL do banco de **produção** (Supabase, etc.).
- **FRONTEND_URL**: URL do front (ex.: Vercel), sem barra no final.

Depois: `fly deploy -a aurix-prod` (ou push de novo). Confira: `fly secrets list -a aurix-prod`.

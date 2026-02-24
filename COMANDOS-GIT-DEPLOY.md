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

- **Render** (backend): faz deploy automático ao detectar o push no `main`.
- **Vercel** (frontend): idem.

Só aguardar alguns minutos e testar as URLs.

# Comandos para subir o Aurix para produção (Git)
# Rode este script na pasta do projeto: c:\Users\allan\apps\Aurix
# Ou copie e cole cada bloco no PowerShell.

Set-Location $PSScriptRoot

# 1) Adicionar todos os arquivos (respeitando .gitignore)
git add .

# 2) Ver o que será commitado (opcional)
git status

# 3) Fazer o commit
git commit -m ""

# 4) Enviar para o GitHub (Fly.io e Vercel fazem deploy automático ao dar push)
git push origin main

Write-Host ""
Write-Host "Pronto. Se o remote estiver certo, o Fly.io (backend) e a Vercel (frontend) vao fazer o deploy automatico." -ForegroundColor Green

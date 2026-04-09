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
Write-Host "Push concluido. O Fly.io NAO faz deploy sozinho ao dar push (a menos que voce tenha GitHub Actions)." -ForegroundColor Yellow
Write-Host "Para publicar backend + frontend (SPA embutido na imagem), na RAIZ do repo rode:" -ForegroundColor Green
Write-Host "  fly deploy" -ForegroundColor Cyan
Write-Host "Nao use 'fly deploy' dentro de backend/ — essa imagem e so API e fica sem o React atualizado." -ForegroundColor Yellow

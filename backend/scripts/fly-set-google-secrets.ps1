# Configura secrets do Google OAuth no Fly (app aurix-prod).
# Uso: na pasta backend ou na raiz do repo:
#   powershell -ExecutionPolicy Bypass -File scripts/fly-set-google-secrets.ps1
#
# Pré-requisito: fly auth login (uma vez nesta máquina)

$ErrorActionPreference = "Stop"
# fly auth whoami retorna erro se nao logado — nao usar $ErrorActionPreference Stop antes disso
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$envLocal = Join-Path $root "backend\.env.local"
if (-not (Test-Path $envLocal)) {
  Write-Error "Arquivo nao encontrado: $envLocal"
}

$cid = $null
$sec = $null
Get-Content $envLocal -Encoding UTF8 | ForEach-Object {
  $line = $_.Trim()
  if ($line -match '^GOOGLE_CLIENT_ID="([^"]*)"') { $cid = $Matches[1] }
  if ($line -match '^GOOGLE_CLIENT_SECRET="([^"]*)"') { $sec = $Matches[1] }
}

if (-not $cid -or -not $sec) {
  Write-Error "Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET em backend\.env.local"
}

$redirect = "https://aurix-prod.fly.dev/api/integrations/google-calendar/callback"

$ErrorActionPreference = "Continue"
$null = flyctl auth whoami 2>&1
$ErrorActionPreference = "Stop"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Faca login no Fly (abrira o navegador)..."
  flyctl auth login
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

Write-Host "Definindo secrets no app aurix-prod..."
flyctl secrets set `
  "GOOGLE_CLIENT_ID=$cid" `
  "GOOGLE_CLIENT_SECRET=$sec" `
  "GOOGLE_REDIRECT_URI=$redirect" `
  -a aurix-prod

if ($LASTEXITCODE -eq 0) {
  Write-Host "OK. Faca deploy se ainda nao aplicou: fly deploy -a aurix-prod (na raiz do repo)"
}

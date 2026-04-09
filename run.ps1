$ErrorActionPreference = 'Stop'

Write-Host '== Estoque local runner ==' -ForegroundColor Cyan

if (-not (Test-Path '.\.venv')) {
    Write-Host 'Criando ambiente virtual .venv...' -ForegroundColor Yellow
    python -m venv .venv
}

$python = '.\.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    throw 'Nao foi possivel localizar .venv\Scripts\python.exe'
}

# Forca SQLite local (evita apontar por engano para Postgres remoto no .env).
# Credenciais de admin vêm do arquivo .env. No Windows, variáveis de ambiente do usuário
# ou de sessões antigas (ex.: ADMIN_USERNAME=admin) substituem o .env no Pydantic — aí o
# login com o e-mail do .env falha com 401. Removemos do processo atual para o .env valer.
$env:DATABASE_URL = 'sqlite:///./estoque_local.db'
Remove-Item Env:ADMIN_USERNAME -ErrorAction SilentlyContinue
Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
if (-not $env:SECRET_KEY) { $env:SECRET_KEY = 'dev-local-secret-key' }
if (-not $env:IMPORT_SECRET) { $env:IMPORT_SECRET = 'dev-local-import-secret' }

if (-not (Test-Path '.\.env')) {
    Write-Host 'Criando .env a partir de .env.example...' -ForegroundColor Yellow
    Copy-Item '.\.env.example' '.\.env'
}

Write-Host 'Instalando/atualizando dependencias...' -ForegroundColor Yellow
& $python -m pip install -r requirements.txt

Write-Host 'Inicializando banco local...' -ForegroundColor Yellow
& $python setup_local.py

Write-Host 'Subindo servidor em http://127.0.0.1:8000' -ForegroundColor Green
& '.\.venv\Scripts\uvicorn.exe' app.main:app --reload

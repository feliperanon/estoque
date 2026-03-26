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

# Forca execucao local independente de credenciais remotas no .env
$env:DATABASE_URL = 'sqlite:///./estoque_local.db'
if (-not $env:SECRET_KEY) { $env:SECRET_KEY = 'dev-local-secret-key' }
if (-not $env:IMPORT_SECRET) { $env:IMPORT_SECRET = 'dev-local-import-secret' }
if (-not $env:ADMIN_USERNAME) { $env:ADMIN_USERNAME = 'admin' }
if (-not $env:ADMIN_PASSWORD) { $env:ADMIN_PASSWORD = 'admin123' }

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

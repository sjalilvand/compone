# ============================================================
#  Iran Companies & Factories Information Bank - Setup Script
#  Repository: https://github.com/sjalilvand/compone
#  Usage:  powershell -ExecutionPolicy Bypass -File .\setup.ps1
# ============================================================

$ErrorActionPreference = "Stop"
Write-Host "=== Iran Companies DB - Local Setup ===" -ForegroundColor Cyan

# --- 1) Check Node.js ---
$nodeOk = $false
try {
    $nodeV = (node --version)
    $nodeOk = $true
} catch { }
if (-Not $nodeOk) {
    Write-Host "ERROR: Node.js was not found." -ForegroundColor Red
    Write-Host "Install Node.js 20 LTS or newer from https://nodejs.org , then re-run this script."
    exit 1
}
Write-Host "Node.js detected: $nodeV"

# --- 2) Install dependencies ---
Write-Host "`n[1/4] Installing npm dependencies (this may take a few minutes)..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: npm install failed." -ForegroundColor Red; exit 1 }

# --- 3) Create .env if missing ---
Write-Host "`n[2/4] Preparing .env ..." -ForegroundColor Yellow
if (-Not (Test-Path ".env")) {
    "DATABASE_URL=file:../db/custom.db" | Out-File -FilePath ".env" -Encoding ascii
    Write-Host "  .env created with DATABASE_URL."
} else {
    Write-Host "  .env already exists - skipped."
}

# --- 4) Prisma client + database ---
Write-Host "`n[3/4] Generating Prisma client ..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: prisma generate failed." -ForegroundColor Red; exit 1 }

if (-Not (Test-Path "db\custom.db")) {
    Write-Host "  Database file not found - creating empty schema (prisma db push) ..."
    npx prisma db push
} else {
    Write-Host "  Database found (db\custom.db) with sample pilot data - kept as is."
}

# --- Done ---
Write-Host "`n[4/4] Setup finished successfully." -ForegroundColor Green
Write-Host ""
Write-Host "  Start the app:      npm run dev:win"
Write-Host "  Admin panel:        http://localhost:3000"
Write-Host "  Analytics dashboard: http://localhost:3000/dashboard"
Write-Host ""
Write-Host "  Tip: to start with an empty database, delete db\custom.db and run: npx prisma db push"

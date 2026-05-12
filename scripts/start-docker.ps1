# =============================================================================
# scripts\start.ps1 — Bodhion Docker startup script (Windows PowerShell)
# =============================================================================
# Usage (from project root):
#   .\scripts\start.ps1
#   # If execution policy blocks it:
#   PowerShell -ExecutionPolicy Bypass -File .\scripts\start.ps1
#
# What this script does:
#   1. Verifies Docker Desktop is running
#   2. Copies .env.default -> .env if .env does not already exist
#   3. Runs docker compose (split-service stack) in detached mode
#   4. Prints the URL when done
# =============================================================================

$ErrorActionPreference = 'Stop'

# ── Resolve project root (parent of the scripts\ folder) ─────────────────────
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir '..'))
$ComposeFile = Join-Path $ProjectRoot 'docker\docker-compose.yml'
$EnvFile     = Join-Path $ProjectRoot '.env'
$EnvDefault  = Join-Path $ProjectRoot '.env.default'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Bodhion — Docker startup"               -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ── 1. Check Docker daemon ────────────────────────────────────────────────────
Write-Host "`n[1/4] Checking Docker daemon..." -ForegroundColor Yellow
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker Desktop is not running." -ForegroundColor Red
    Write-Host ""
    Write-Host "  > Open Docker Desktop from the Start Menu and wait for"
    Write-Host "    the whale icon in the system tray to stop animating,"
    Write-Host "    then re-run this script."
    exit 1
}
Write-Host "      Docker is running." -ForegroundColor Green

# ── 2. Copy .env.default -> .env if .env absent ───────────────────────────────
Write-Host "`n[2/4] Checking environment file..." -ForegroundColor Yellow
if (-not (Test-Path $EnvFile)) {
    if (-not (Test-Path $EnvDefault)) {
        Write-Host "ERROR: $EnvDefault not found. Cannot create .env." -ForegroundColor Red
        exit 1
    }
    Copy-Item $EnvDefault $EnvFile
    Write-Host "      Created .env from .env.default." -ForegroundColor Green
    Write-Host "      IMPORTANT: Edit .env and set WEBUI_SECRET_KEY to a real secret." -ForegroundColor Yellow
} else {
    Write-Host "      .env already exists -- skipping copy." -ForegroundColor Green
}

# ── 3. Read BODHION_PORT from .env for the URL message ─────────────────────
$Port = '80'
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^BODHION_PORT\s*=\s*(.+)$') {
        $Port = $Matches[1].Trim().Trim('"').Trim("'")
    }
}

# ── 4. Build and start services ───────────────────────────────────────────────
Write-Host "`n[3/4] Building images and starting services..." -ForegroundColor Yellow
Write-Host "      Compose file: $ComposeFile"

docker compose -f $ComposeFile up --build -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: docker compose failed. Check the output above." -ForegroundColor Red
    exit 1
}

# ── 5. Done ───────────────────────────────────────────────────────────────────
Write-Host "`n[4/4] Services started." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Bodhion is starting up!"                -ForegroundColor Green
Write-Host "  URL: http://localhost:$Port"           -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  View logs:     docker compose -f docker\docker-compose.yml logs -f"
Write-Host "  Stop services: docker compose -f docker\docker-compose.yml down"
Write-Host ""

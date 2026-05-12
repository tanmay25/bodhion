# =============================================================================
# scripts\start-frontend.ps1 — Start the Next.js frontend locally (no Docker)
# =============================================================================
# Usage (from project root):
#   .\scripts\start-frontend.ps1            # development mode (hot reload)
#   .\scripts\start-frontend.ps1 --prod     # production mode (build + start)
#
# If blocked by execution policy:
#   PowerShell -ExecutionPolicy Bypass -File .\scripts\start-frontend.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir '..')).Path
$EnvFile     = Join-Path $ProjectRoot '.env'
$FrontendDir = Join-Path $ProjectRoot 'frontend'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Bodhion — Frontend (local)"             -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ── 1. Check Node / npm ───────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not found. Install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "  Node: $(node --version)   npm: $(npm --version)" -ForegroundColor Green

# ── 2. Read NEXT_PUBLIC_API_URL from .env ─────────────────────────────────────
$ApiUrl = 'http://127.0.0.1:8080'
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^NEXT_PUBLIC_API_URL\s*=\s*(.+)$') {
            $val = $Matches[1].Trim().Trim('"').Trim("'")
            if ($val) { $ApiUrl = $val }
        }
    }
}
$env:NEXT_PUBLIC_API_URL = $ApiUrl
Write-Host "  API URL: $ApiUrl" -ForegroundColor Green

# ── 3. Install dependencies if node_modules is missing ───────────────────────
if (-not (Test-Path (Join-Path $FrontendDir 'node_modules'))) {
    Write-Host "  node_modules not found — running npm install..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    npm install
    Pop-Location
}

# ── 4. Launch ─────────────────────────────────────────────────────────────────
Set-Location $FrontendDir

$ProdMode = $args -contains '--prod'

if ($ProdMode) {
    Write-Host "`n  Building for production..." -ForegroundColor Cyan
    npm run build
    Write-Host "`n  Starting production server on http://localhost:3001" -ForegroundColor Cyan
    Write-Host "  Press Ctrl+C to stop.`n" -ForegroundColor Yellow
    npm start
} else {
    Write-Host "`n  Starting dev server on http://localhost:3001" -ForegroundColor Cyan
    Write-Host "  Press Ctrl+C to stop.`n" -ForegroundColor Yellow
    npm run dev
}

# =============================================================================
# scripts\start-backend.ps1 — Start the FastAPI backend locally (no Docker)
# =============================================================================
# Usage (from project root):
#   .\scripts\start-backend.ps1            # production-like
#   .\scripts\start-backend.ps1 --reload   # dev mode with auto-reload
#
# If blocked by execution policy:
#   PowerShell -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir '..')).Path
$EnvFile     = Join-Path $ProjectRoot '.env'
$BackendDir  = Join-Path $ProjectRoot 'backend'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Bodhion — Backend (local)"              -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ── 1. Check Python ───────────────────────────────────────────────────────────
$Python = (Get-Command python -ErrorAction SilentlyContinue) ??
          (Get-Command python3 -ErrorAction SilentlyContinue)
if (-not $Python) {
    Write-Host "ERROR: Python not found. Install Python 3.11+ and add it to PATH." -ForegroundColor Red
    exit 1
}
Write-Host "  $($Python.Name): $(& $Python.Source --version 2>&1)" -ForegroundColor Green

# ── 2. Load .env ──────────────────────────────────────────────────────────────
$EnvVars = @{}
if (Test-Path $EnvFile) {
    Write-Host "  Loaded: $EnvFile" -ForegroundColor Green
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+?)\s*=\s*(.*)$') {
            $EnvVars[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"').Trim("'")
            [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim())
        }
    }
} else {
    Write-Host "  WARNING: .env not found — using defaults." -ForegroundColor Yellow
}

# ── 3. Apply defaults ─────────────────────────────────────────────────────────
$Host_   = if ($env:HOST)            { $env:HOST }            else { '0.0.0.0' }
$Port    = if ($env:PORT)            { $env:PORT }            else { '8080' }
$Workers = if ($env:UVICORN_WORKERS) { $env:UVICORN_WORKERS } else { '1' }

# ── 4. Launch ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Starting backend on http://${Host_}:${Port}" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

Set-Location $BackendDir

# Extra args passed through (e.g. --reload)
$ExtraArgs = $args
if ($ExtraArgs.Count -eq 0) {
    $ExtraArgs = @('--workers', $Workers)
}

& $Python.Source -m uvicorn bodhion.main:app `
    --host $Host_ `
    --port $Port `
    --forwarded-allow-ips '*' `
    --ws auto `
    @ExtraArgs

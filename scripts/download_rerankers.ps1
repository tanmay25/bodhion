# =============================================================================
# scripts\download_rerankers.ps1 — Pre-download all reranker models locally
# =============================================================================
# Usage (from project root):
#   .\scripts\download_rerankers.ps1
#   .\scripts\download_rerankers.ps1 --model BAAI/bge-reranker-v2-m3
#
# If blocked by execution policy:
#   PowerShell -ExecutionPolicy Bypass -File .\scripts\download_rerankers.ps1
# =============================================================================

param(
    [string]$model = ""
)

$ErrorActionPreference = 'Stop'

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir '..')).Path
$EnvFile     = Join-Path $ProjectRoot '.env'
$ScriptFile  = Join-Path $ScriptDir 'download_rerankers.py'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Bodhion — Reranker Model Downloader"    -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ── 1. Check Python ───────────────────────────────────────────────────────────
$Python = (Get-Command python -ErrorAction SilentlyContinue) ??
          (Get-Command python3 -ErrorAction SilentlyContinue)
if (-not $Python) {
    Write-Host "ERROR: Python not found. Install Python 3.11+ and add it to PATH." -ForegroundColor Red
    exit 1
}
Write-Host "  Python: $(& $Python.Source --version 2>&1)" -ForegroundColor Green

# ── 2. Load .env (to pick up SENTENCE_TRANSFORMERS_HOME if set) ───────────────
if (Test-Path $EnvFile) {
    Write-Host "  Loaded: $EnvFile" -ForegroundColor Green
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+?)\s*=\s*(.*)$') {
            [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim())
        }
    }
} else {
    Write-Host "  WARNING: .env not found — using defaults." -ForegroundColor Yellow
}

# ── 3. Run the Python download script ─────────────────────────────────────────
Write-Host ""
$ExtraArgs = @()
if ($model -ne "") {
    $ExtraArgs = @("--model", $model)
}

& $Python.Source $ScriptFile @ExtraArgs

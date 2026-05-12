@echo off
:: =============================================================================
:: scripts\start-backend.bat — Start the FastAPI backend locally (no Docker)
:: =============================================================================
:: Usage (from project root):
::   scripts\start-backend.bat          -> production mode (workers, no reload)
::   scripts\start-backend.bat --dev    -> dev mode (--reload, single worker)
:: =============================================================================

setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "ENV_FILE=%PROJECT_ROOT%\.env"
set "BACKEND_DIR=%PROJECT_ROOT%\backend"

:: ── Parse --dev flag ──────────────────────────────────────────────────────────
set "DEV_MODE=0"
for %%A in (%*) do (
    if /i "%%A"=="--dev" set "DEV_MODE=1"
)

echo ========================================
if "%DEV_MODE%"=="1" (
    echo   Bodhion ^— Backend [DEV / hot-reload]
) else (
    echo   Bodhion ^— Backend [production]
)
echo ========================================

:: ── 1. Check Python ──────────────────────────────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.11+ and add it to PATH.
    exit /b 1
)
for /f "tokens=*" %%V in ('python --version 2^>^&1') do echo   %%V

:: ── 2. Load .env ─────────────────────────────────────────────────────────────
if exist "%ENV_FILE%" (
    echo   Loading: %ENV_FILE%
    for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
        set "line=%%A"
        if not "!line:~0,1!"=="#" (
            if not "%%A"=="" if not "%%B"=="" (
                set "%%A=%%B"
            )
        )
    )
) else (
    echo   WARNING: .env not found -- using defaults.
)

:: ── 3. Apply defaults ────────────────────────────────────────────────────────
if "%HOST%"==""             set HOST=0.0.0.0
if "%PORT%"==""             set PORT=8080
if "%UVICORN_WORKERS%"==""  set UVICORN_WORKERS=1

:: ── 4. Launch ────────────────────────────────────────────────────────────────
echo.
echo   URL  : http://%HOST%:%PORT%
if "%DEV_MODE%"=="1" (
    echo   Mode : DEV ^(--reload, 1 worker, log-level=debug^)
) else (
    echo   Mode : production ^(%UVICORN_WORKERS% worker^(s^)^)
)
echo   Press Ctrl+C to stop.
echo.

cd /d "%BACKEND_DIR%"

set FORWARDED_ALLOW_IPS=*

if "%DEV_MODE%"=="1" (
    :: --reload requires a single worker; watchfiles triggers restart on any .py change
    python -m uvicorn bodhion.main:app ^
        --host "%HOST%" ^
        --port "%PORT%" ^
        --reload ^
        --reload-dir bodhion ^
        --log-level debug
) else (
    python -m uvicorn bodhion.main:app ^
        --host "%HOST%" ^
        --port "%PORT%" ^
        --workers "%UVICORN_WORKERS%"
)

endlocal

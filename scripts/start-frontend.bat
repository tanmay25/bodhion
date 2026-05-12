@echo off
:: =============================================================================
:: scripts\start-frontend.bat — Start the Next.js frontend locally (no Docker)
:: =============================================================================
:: Usage (from project root):
::   scripts\start-frontend.bat          (development mode — hot reload)
::   scripts\start-frontend.bat --prod   (build + production start)
:: =============================================================================

setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "ENV_FILE=%PROJECT_ROOT%\.env"
set "FRONTEND_DIR=%PROJECT_ROOT%\frontend"

echo ========================================
echo   Bodhion ^— Frontend (local)
echo ========================================

:: ── 1. Check Node / npm ──────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Install Node.js 18+ from https://nodejs.org
    exit /b 1
)
for /f "tokens=*" %%V in ('node --version') do echo   Node: %%V
for /f "tokens=*" %%V in ('npm  --version') do echo   npm:  %%V

:: ── 2. Read NEXT_PUBLIC_API_URL from .env ────────────────────────────────────
set "NEXT_PUBLIC_API_URL=http://127.0.0.1:8080"
if exist "%ENV_FILE%" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
        if "%%A"=="NEXT_PUBLIC_API_URL" if not "%%B"=="" set "NEXT_PUBLIC_API_URL=%%B"
    )
)
echo   API URL: %NEXT_PUBLIC_API_URL%

:: ── 3. Install dependencies if node_modules missing ──────────────────────────
if not exist "%FRONTEND_DIR%\node_modules" (
    echo   node_modules not found -- running npm install...
    pushd "%FRONTEND_DIR%"
    npm install
    popd
)

:: ── 4. Launch ────────────────────────────────────────────────────────────────
echo.
cd /d "%FRONTEND_DIR%"

set "PROD_MODE=false"
for %%A in (%*) do (
    if "%%A"=="--prod" set "PROD_MODE=true"
)

if "%PROD_MODE%"=="true" (
    echo   Building for production...
    npm run build
    echo.
    echo   Starting production server on http://localhost:3001
    echo   Press Ctrl+C to stop.
    echo.
    npm start
) else (
    echo   Starting dev server on http://localhost:3001
    echo   Press Ctrl+C to stop.
    echo.
    npm run dev
)

endlocal

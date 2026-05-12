@echo off
REM =============================================================================
REM scripts\start.bat — Bodhion Docker startup script (Windows Command Prompt)
REM =============================================================================
REM Usage (from project root):
REM   scripts\start.bat
REM
REM What this script does:
REM   1. Verifies Docker Desktop is running
REM   2. Copies .env.default -> .env if .env does not already exist
REM   3. Runs docker compose (split-service stack) in detached mode
REM   4. Prints the URL when done
REM =============================================================================

setlocal EnableDelayedExpansion

REM ── Resolve project root (parent of the scripts\ folder) ─────────────────
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "COMPOSE_FILE=%PROJECT_ROOT%\docker\docker-compose.yml"
set "ENV_FILE=%PROJECT_ROOT%\.env"
set "ENV_DEFAULT=%PROJECT_ROOT%\.env.default"

echo ========================================
echo   Bodhion ^— Docker startup
echo ========================================

REM ── 1. Check Docker daemon ────────────────────────────────────────────────
echo.
echo [1/4] Checking Docker daemon...
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker Desktop is not running.
    echo.
    echo   ^> Open Docker Desktop from the Start Menu and wait for the
    echo     whale icon in the system tray to stop animating, then re-run
    echo     this script.
    echo.
    exit /b 1
)
echo       Docker is running.

REM ── 2. Copy .env.default -> .env if .env absent ───────────────────────────
echo.
echo [2/4] Checking environment file...
if not exist "%ENV_FILE%" (
    if not exist "%ENV_DEFAULT%" (
        echo ERROR: %ENV_DEFAULT% not found. Cannot create .env.
        exit /b 1
    )
    copy "%ENV_DEFAULT%" "%ENV_FILE%" >nul
    echo       Created .env from .env.default.
    echo       IMPORTANT: Edit .env and set WEBUI_SECRET_KEY to a real secret.
) else (
    echo       .env already exists -- skipping copy.
)

REM ── 3. Read BODHION_PORT from .env for the URL message ─────────────────
set "PORT=80"
for /f "usebackq tokens=1,2 delims==" %%A in ("%ENV_FILE%") do (
    if "%%A"=="BODHION_PORT" set "PORT=%%B"
)

REM ── 4. Build and start services ───────────────────────────────────────────
echo.
echo [3/4] Building images and starting services...
echo       Compose file: %COMPOSE_FILE%
docker compose -f "%COMPOSE_FILE%" up --build -d
if errorlevel 1 (
    echo ERROR: docker compose failed. Check the output above.
    exit /b 1
)

REM ── 5. Done ───────────────────────────────────────────────────────────────
echo.
echo [4/4] Services started.
echo.
echo ========================================
echo   Bodhion is starting up!
echo   URL: http://localhost:%PORT%
echo ========================================
echo.
echo   View logs:     docker compose -f docker\docker-compose.yml logs -f
echo   Stop services: docker compose -f docker\docker-compose.yml down
echo.

endlocal

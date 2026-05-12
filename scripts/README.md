scripts/ -- Bodhion Startup Scripts
====================================

All commands are run from the PROJECT ROOT (mti-mindai-main/).

Scripts named  start-docker.*   require Docker Desktop to be running.
Scripts named  start-backend.*  run the FastAPI backend directly on your machine.
Scripts named  start-frontend.* run the Next.js frontend directly on your machine.


SCRIPT INDEX
============

  Name                    Platform              Needs Docker
  ----------------------  --------------------  ------------
  start-docker.sh         Linux / macOS / WSL   YES
  start-docker.ps1        Windows PowerShell    YES
  start-docker.bat        Windows CMD           YES
  start-backend.sh        Linux / macOS / WSL   no
  start-backend.ps1       Windows PowerShell    no
  start-backend.bat       Windows CMD           no
  start-frontend.sh       Linux / macOS / WSL   no
  start-frontend.ps1      Windows PowerShell    no
  start-frontend.bat      Windows CMD           no
  prepare-pyodide.js      Any (Node.js)         no


WHAT EACH SCRIPT DOES
======================

  start-docker.*
    Builds and starts the FULL STACK (backend + frontend + nginx) using
    Docker Compose. Both services run in containers. Access the app at
    http://localhost:80 (or the port set in .env as BODHION_PORT).

    On first run, copies .env.default -> .env automatically if .env
    does not exist. Edit .env and set WEBUI_SECRET_KEY and
    OLLAMA_BASE_URL before starting.

  start-backend.*
    Starts the FastAPI/uvicorn backend ONLY, directly on your machine.
    No Docker required. Backend runs at http://localhost:8080.
    Loads .env from the project root for configuration.
    Pass --reload flag for auto-reload during development.

  start-frontend.*
    Starts the Next.js frontend ONLY, directly on your machine.
    No Docker required. Frontend runs at http://localhost:3000.
    Reads NEXT_PUBLIC_API_URL from .env (defaults to
    http://127.0.0.1:8080 to reach the local backend).
    Runs npm install automatically if node_modules is missing.
    Pass --prod to build first and then start in production mode.

  prepare-pyodide.js
    One-time setup script. Downloads Pyodide WASM assets into
    static/pyodide/. Only needed for in-browser Python execution.
    Run once after cloning, or when updating the Pyodide version.


USAGE EXAMPLES
==============

-- Full Docker stack (backend + frontend together) --------------------

    Linux / macOS
        bash scripts/start-docker.sh

    Windows PowerShell  (preferred)
        .\scripts\start-docker.ps1

    Windows CMD
        scripts\start-docker.bat


-- Backend only (local, no Docker) -----------------------------------

    Development mode  -- auto-reloads on file save
        bash scripts/start-backend.sh --reload
        .\scripts\start-backend.ps1 --reload

    Production-like  -- uses UVICORN_WORKERS from .env
        bash scripts/start-backend.sh
        .\scripts\start-backend.ps1
        scripts\start-backend.bat


-- Frontend only (local, no Docker) ----------------------------------

    Development mode  -- hot reload, default
        bash scripts/start-frontend.sh
        .\scripts\start-frontend.ps1
        scripts\start-frontend.bat

    Production mode  -- builds first, then starts
        bash scripts/start-frontend.sh --prod
        .\scripts\start-frontend.ps1 --prod
        scripts\start-frontend.bat --prod


-- Pyodide setup (one-time) ------------------------------------------

        node scripts/prepare-pyodide.js


TYPICAL LOCAL DEV WORKFLOW
==========================

Open two terminal windows from the project root:

    Terminal 1  (backend)
        bash scripts/start-backend.sh --reload

    Terminal 2  (frontend)
        bash scripts/start-frontend.sh

Then open http://localhost:3000 in your browser.
The frontend will proxy API calls to the backend at port 8080.

#!/usr/bin/env bash
# =============================================================================
# scripts/start-backend.sh — Start the FastAPI backend locally (no Docker)
# =============================================================================
# Usage (from project root):
#   bash scripts/start-backend.sh          # production-like (workers from .env)
#   bash scripts/start-backend.sh --reload # dev mode with auto-reload
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
BACKEND_DIR="${PROJECT_ROOT}/backend"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Bodhion — Backend (local)${NC}"
echo -e "${CYAN}========================================${NC}"

# ── 1. Check Python ───────────────────────────────────────────────────────────
PYTHON=$(command -v python3 || command -v python || true)
if [ -z "$PYTHON" ]; then
    echo -e "${RED}ERROR: Python not found. Install Python 3.11+.${NC}"
    exit 1
fi
echo -e "${GREEN}  Python: $($PYTHON --version)${NC}"

# ── 2. Load .env ──────────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
    while IFS= read -r line; do
        # Skip comments and blank lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue
        key="${line%%=*}"
        value="${line#*=}"
        # Strip surrounding double or single quotes
        if [[ "$value" =~ ^\"(.*)\"$ ]]; then
            value="${BASH_REMATCH[1]}"
        elif [[ "$value" =~ ^\'(.*)\'$ ]]; then
            value="${BASH_REMATCH[1]}"
        fi
        export "$key=$value"
    done < "$ENV_FILE"
    echo -e "${GREEN}  Loaded: ${ENV_FILE}${NC}"
else
    echo -e "${YELLOW}  WARNING: .env not found — using defaults.${NC}"
fi

# ── 3. Apply defaults ─────────────────────────────────────────────────────────
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-8080}"
export UVICORN_WORKERS="${UVICORN_WORKERS:-1}"
export CORS_ALLOW_ORIGIN="${CORS_ALLOW_ORIGIN:-http://localhost:3000;http://localhost:8080}"

# ── 4. Check requirements are installed ───────────────────────────────────────
if ! "$PYTHON" -c "import uvicorn" 2>/dev/null; then
    echo -e "${YELLOW}  uvicorn not found — installing requirements...${NC}"
    "$PYTHON" -m pip install -r "${BACKEND_DIR}/requirements.txt"
fi

# ── 5. Launch ─────────────────────────────────────────────────────────────────
echo -e "\n${CYAN}  Starting backend on http://${HOST}:${PORT}${NC}"
echo -e "${YELLOW}  Press Ctrl+C to stop.${NC}\n"

cd "$BACKEND_DIR"

# Pass through any extra args (e.g. --reload for dev mode)
EXTRA_ARGS=("$@")
if [ "${#EXTRA_ARGS[@]}" -eq 0 ]; then
    EXTRA_ARGS=(--workers "$UVICORN_WORKERS")
fi

exec "$PYTHON" -m uvicorn bodhion.main:app \
    --host "$HOST" \
    --port "$PORT" \
    --forwarded-allow-ips '*' \
    --ws auto \
    "${EXTRA_ARGS[@]}"

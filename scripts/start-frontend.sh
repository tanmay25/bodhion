#!/usr/bin/env bash
# =============================================================================
# scripts/start-frontend.sh — Start the Next.js frontend locally (no Docker)
# =============================================================================
# Usage (from project root):
#   bash scripts/start-frontend.sh          # development mode (hot reload)
#   bash scripts/start-frontend.sh --prod   # production mode (build + start)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Bodhion — Frontend (local)${NC}"
echo -e "${CYAN}========================================${NC}"

# ── 1. Check Node / npm ───────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    echo -e "${RED}ERROR: Node.js not found. Install Node.js 18+.${NC}"
    exit 1
fi
if ! command -v npm &>/dev/null; then
    echo -e "${RED}ERROR: npm not found.${NC}"
    exit 1
fi
echo -e "${GREEN}  Node: $(node --version)  npm: $(npm --version)${NC}"

# ── 2. Read NEXT_PUBLIC_API_URL from .env (fallback to local backend) ─────────
NEXT_PUBLIC_API_URL="http://127.0.0.1:8080"
if [ -f "$ENV_FILE" ]; then
    VAL=$(grep -E '^NEXT_PUBLIC_API_URL=' "$ENV_FILE" | cut -d= -f2 | tr -d ' "' || true)
    [ -n "$VAL" ] && NEXT_PUBLIC_API_URL="$VAL"
fi
export NEXT_PUBLIC_API_URL
echo -e "${GREEN}  API URL: ${NEXT_PUBLIC_API_URL}${NC}"

# ── 3. Install dependencies if node_modules is missing ───────────────────────
if [ ! -d "${FRONTEND_DIR}/node_modules" ]; then
    echo -e "${YELLOW}  node_modules not found — running npm install...${NC}"
    npm --prefix "$FRONTEND_DIR" install
fi

# ── 4. Launch ─────────────────────────────────────────────────────────────────
cd "$FRONTEND_DIR"

PROD_MODE=false
for arg in "$@"; do
    [ "$arg" = "--prod" ] && PROD_MODE=true
done

if $PROD_MODE; then
    echo -e "\n${CYAN}  Building for production...${NC}"
    npm run build
    echo -e "\n${CYAN}  Starting production server on http://localhost:3001${NC}"
    echo -e "${YELLOW}  Press Ctrl+C to stop.${NC}\n"
    exec npm start
else
    echo -e "\n${CYAN}  Starting dev server on http://localhost:3001${NC}"
    echo -e "${YELLOW}  Press Ctrl+C to stop.${NC}\n"
    exec npm run dev
fi

#!/usr/bin/env bash
# =============================================================================
# scripts/start-docker.sh — Bodhion Docker startup script (Linux / macOS)
# =============================================================================
# Usage (from project root):
#   bash scripts/start-docker.sh
#
# What this script does:
#   1. Verifies Docker daemon is running
#   2. Copies .env.default → .env if .env does not already exist
#   3. Runs docker compose (split-service stack) in detached mode
#   4. Prints the URL when done
# =============================================================================

set -euo pipefail

# ── Resolve project root regardless of where the script is called from ────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env"
ENV_DEFAULT="${PROJECT_ROOT}/.env.default"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Bodhion — Docker startup${NC}"
echo -e "${CYAN}========================================${NC}"

# ── 1. Check Docker daemon ────────────────────────────────────────────────────
echo -e "\n${YELLOW}[1/4] Checking Docker daemon...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Docker daemon is not running.${NC}"
    echo "  • On Linux:  sudo systemctl start docker"
    echo "  • On macOS:  open Docker Desktop, wait until the whale icon stops animating"
    exit 1
fi
echo -e "${GREEN}      Docker is running.${NC}"

# ── 2. Copy .env.default → .env if .env absent ────────────────────────────────
echo -e "\n${YELLOW}[2/4] Checking environment file...${NC}"
if [ ! -f "${ENV_FILE}" ]; then
    if [ ! -f "${ENV_DEFAULT}" ]; then
        echo -e "${RED}ERROR: ${ENV_DEFAULT} not found. Cannot create .env.${NC}"
        exit 1
    fi
    cp "${ENV_DEFAULT}" "${ENV_FILE}"
    echo -e "${GREEN}      Created .env from .env.default.${NC}"
    echo -e "${YELLOW}      IMPORTANT: Edit .env and set WEBUI_SECRET_KEY to a real secret before use.${NC}"
else
    echo -e "${GREEN}      .env already exists — skipping copy.${NC}"
fi

# ── 3. Read port from .env for the final URL message ─────────────────────────
PORT=$(grep -E '^BODHION_PORT=' "${ENV_FILE}" | cut -d= -f2 | tr -d ' "' || echo "80")
PORT="${PORT:-80}"

# ── 4. Build and start services ───────────────────────────────────────────────
echo -e "\n${YELLOW}[3/4] Building images and starting services...${NC}"
echo -e "      Compose file: ${COMPOSE_FILE}"
docker compose -f "${COMPOSE_FILE}" up --build -d

# ── 5. Done ───────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[4/4] Waiting for services to become healthy...${NC}"
sleep 5

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Bodhion is starting up!${NC}"
echo -e "${GREEN}  URL: http://localhost:${PORT}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  View logs:     docker compose -f docker/docker-compose.yml logs -f"
echo "  Stop services: docker compose -f docker/docker-compose.yml down"
echo ""

#!/usr/bin/env bash
# =============================================================================
# scripts/download_rerankers.sh — Pre-download all reranker models locally
# =============================================================================
# Usage (from project root):
#   bash scripts/download_rerankers.sh
#   bash scripts/download_rerankers.sh --model BAAI/bge-reranker-v2-m3
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

echo "========================================"
echo "  Bodhion — Reranker Model Downloader"
echo "========================================"

# ── 1. Check Python ───────────────────────────────────────────────────────────
PYTHON=$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)
if [ -z "$PYTHON" ]; then
    echo "ERROR: Python not found. Install Python 3.11+ and add it to PATH." >&2
    exit 1
fi
echo "  Python: $($PYTHON --version)"

# ── 2. Load .env (to pick up SENTENCE_TRANSFORMERS_HOME if set) ───────────────
if [ -f "$ENV_FILE" ]; then
    echo "  Loaded: $ENV_FILE"
    set -o allexport
    # shellcheck disable=SC1090
    source <(grep -v '^\s*#' "$ENV_FILE" | grep '=')
    set +o allexport
else
    echo "  WARNING: .env not found — using defaults."
fi

# ── 3. Run the Python download script ─────────────────────────────────────────
echo ""
exec "$PYTHON" "$SCRIPT_DIR/download_rerankers.py" "$@"

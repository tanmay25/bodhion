# =============================================================================
# docker/Makefile — Bodhion developer workflow
# =============================================================================
# Run from the docker/ directory:
#   make <target>
#
# Or from the project root:
#   make -C docker <target>
#
# First-time setup:
#   1. Copy ../.env.default → ../.env and fill in secrets
#   2. make up
# =============================================================================

# ── Variables ─────────────────────────────────────────────────────────────────
COMPOSE       := docker compose -f docker-compose.yml
ENV_FILE      := ../.env
BACKEND_SVC   := backend
FRONTEND_SVC  := frontend
BACKEND_IMG   := bodhion_backend
FRONTEND_IMG  := bodhion_frontend

# Colours (fallback to empty if terminal doesn't support them)
RED    := \033[0;31m
YELLOW := \033[1;33m
GREEN  := \033[0;32m
CYAN   := \033[0;36m
BOLD   := \033[1m
NC     := \033[0m

# ── Default target ────────────────────────────────────────────────────────────
.DEFAULT_GOAL := help
.PHONY: help ps health env-check \
        build build-backend build-frontend build-no-cache \
        up start restart restart-backend restart-frontend \
        stop down down-volumes \
        logs logs-backend logs-frontend \
        shell-backend shell-frontend shell-nginx \
        rmi clean clean-all prune \
        _check-env _check-running-backend _check-running-frontend _guard-confirm

# =============================================================================
# INFO
# =============================================================================

help: ## Show this help table
	@printf "$(BOLD)$(CYAN)\n  Bodhion Docker — developer targets\n$(NC)\n"
	@printf "  $(BOLD)%-22s  %-10s  %s$(NC)\n" "Target" "Group" "Description"
	@printf "  %-22s  %-10s  %s\n"  "──────────────────────" "──────────" "──────────────────────────────────────────"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-22s$(NC)  %s\n", $$1, $$2}'
	@printf "\n  $(YELLOW)Usage examples:$(NC)\n"
	@printf "    make up                         # build + start everything\n"
	@printf "    make logs-backend               # tail backend logs\n"
	@printf "    make shell-backend              # bash into backend container\n"
	@printf "    make restart-frontend           # restart nginx+Next.js\n"
	@printf "    make clean                      # stop + remove images\n"
	@printf "    make clean-all CONFIRM=yes      # ⚠  destroys volume data\n\n"

ps: ## Show service status, ports, and health state
	@printf "$(CYAN)── Container status ──────────────────────────────────$(NC)\n"
	@$(COMPOSE) ps

health: ## Show Docker healthcheck state for both containers
	@printf "$(CYAN)── Healthcheck: backend ──────────────────────────────$(NC)\n"
	@docker inspect --format \
	  "Status: {{.State.Health.Status}}\nLast output: {{(index .State.Health.Log 0).Output}}" \
	  bodhion_backend 2>/dev/null || printf "$(YELLOW)  Container not running$(NC)\n"
	@printf "\n$(CYAN)── Healthcheck: frontend ─────────────────────────────$(NC)\n"
	@docker inspect --format \
	  "Status: {{.State.Health.Status}}\nLast output: {{(index .State.Health.Log 0).Output}}" \
	  bodhion_frontend 2>/dev/null || printf "$(YELLOW)  Container not running$(NC)\n"

env-check: ## Verify ../.env exists and print non-secret variables
	@printf "$(CYAN)── Environment file check ────────────────────────────$(NC)\n"
	@if [ ! -f "$(ENV_FILE)" ]; then \
	  printf "$(RED)  ERROR: $(ENV_FILE) not found.\n"; \
	  printf "  Run:  cp ../.env.default ../.env  then edit secrets.$(NC)\n"; \
	  exit 1; \
	fi
	@printf "$(GREEN)  Found: $(ENV_FILE)$(NC)\n\n"
	@printf "  $(BOLD)%-35s  %s$(NC)\n" "Variable" "Value"
	@printf "  %-35s  %s\n" "───────────────────────────────────" "──────────────────────────"
	@grep -v '^\s*#' "$(ENV_FILE)" | grep -v '^\s*$$' | \
	  awk -F= '{ \
	    val = $$2; \
	    if ($$1 ~ /KEY|SECRET|PASSWORD|TOKEN/) val = "***masked***"; \
	    printf "  %-35s  %s\n", $$1, val \
	  }'

# =============================================================================
# BUILD
# =============================================================================

build: _check-env ## Build all images (backend + frontend)
	@printf "$(CYAN)── Building all images ───────────────────────────────$(NC)\n"
	@$(COMPOSE) build

build-backend: _check-env ## Build backend image only
	@printf "$(CYAN)── Building backend image ────────────────────────────$(NC)\n"
	@$(COMPOSE) build $(BACKEND_SVC)

build-frontend: _check-env ## Build frontend image only (Node build → nginx)
	@printf "$(CYAN)── Building frontend image ───────────────────────────$(NC)\n"
	@$(COMPOSE) build $(FRONTEND_SVC)

build-no-cache: _check-env ## Rebuild all images from scratch (no layer cache)
	@printf "$(YELLOW)── Rebuilding all images — no cache ─────────────────$(NC)\n"
	@$(COMPOSE) build --no-cache

# =============================================================================
# RUN
# =============================================================================

up: _check-env ## Build (if needed) and start all services in detached mode
	@printf "$(CYAN)── Starting Bodhion stack ─────────────────────────────$(NC)\n"
	@$(COMPOSE) up --build -d
	@printf "\n$(GREEN)  Stack is up. Run 'make ps' to check status.$(NC)\n"
	@printf "$(GREEN)  Access: http://localhost:$$(grep -m1 BODHION_PORT $(ENV_FILE) | cut -d= -f2 | tr -d ' ' || echo 80)$(NC)\n"

start: ## Start existing stopped containers without rebuilding
	@printf "$(CYAN)── Starting containers (no rebuild) ─────────────────$(NC)\n"
	@$(COMPOSE) start

restart: ## Restart all services
	@printf "$(CYAN)── Restarting all services ───────────────────────────$(NC)\n"
	@$(COMPOSE) restart

restart-backend: ## Restart backend service only
	@printf "$(CYAN)── Restarting backend ────────────────────────────────$(NC)\n"
	@$(COMPOSE) restart $(BACKEND_SVC)

restart-frontend: ## Restart frontend service only (nginx + Next.js)
	@printf "$(CYAN)── Restarting frontend ───────────────────────────────$(NC)\n"
	@$(COMPOSE) restart $(FRONTEND_SVC)

# =============================================================================
# STOP
# =============================================================================

stop: ## Stop running containers (preserves them — restartable with 'start')
	@printf "$(CYAN)── Stopping containers ───────────────────────────────$(NC)\n"
	@$(COMPOSE) stop

down: ## Stop and remove containers + internal network (volume kept)
	@printf "$(CYAN)── Taking down stack ─────────────────────────────────$(NC)\n"
	@$(COMPOSE) down

down-volumes: _guard-confirm ## ⚠  Stop + remove containers AND named volume (DATA LOSS)
	@printf "$(RED)── Removing containers + bodhion-backend-data volume ──$(NC)\n"
	@$(COMPOSE) down --volumes
	@printf "$(YELLOW)  Volume removed. All backend data (DB, uploads) is gone.$(NC)\n"

# =============================================================================
# LOGS
# =============================================================================

logs: ## Follow logs from all services (last 100 lines)
	@$(COMPOSE) logs -f --tail=100

logs-backend: ## Follow backend (FastAPI/uvicorn) logs
	@$(COMPOSE) logs -f --tail=100 $(BACKEND_SVC)

logs-frontend: ## Follow frontend (nginx + Next.js) logs
	@$(COMPOSE) logs -f --tail=100 $(FRONTEND_SVC)

# =============================================================================
# INTERACTIVE SHELL
# =============================================================================

shell-backend: _check-running-backend ## Open a bash shell inside the backend container
	@printf "$(CYAN)── Entering backend container (bash) ────────────────$(NC)\n"
	@printf "$(YELLOW)  Type 'exit' to leave the container.$(NC)\n"
	@docker exec -it bodhion_backend /bin/bash

shell-frontend: _check-running-frontend ## Open a sh shell inside the frontend/nginx container
	@printf "$(CYAN)── Entering frontend container (sh) ─────────────────$(NC)\n"
	@printf "$(YELLOW)  Type 'exit' to leave the container.$(NC)\n"
	@docker exec -it bodhion_frontend /bin/sh

shell-nginx: _check-running-frontend ## Open sh in frontend and tail the nginx error log
	@printf "$(CYAN)── nginx error log (live) ────────────────────────────$(NC)\n"
	@docker exec -it bodhion_frontend /bin/sh -c "tail -f /var/log/nginx/error.log"

# =============================================================================
# CLEANUP
# =============================================================================

rmi: ## Remove built images (runs 'down' first to release them)
	@printf "$(YELLOW)── Removing Bodhion images ────────────────────────────$(NC)\n"
	@$(COMPOSE) down 2>/dev/null || true
	@docker rmi $(BACKEND_IMG):latest  2>/dev/null && \
	  printf "$(GREEN)  Removed $(BACKEND_IMG):latest$(NC)\n"  || \
	  printf "$(YELLOW)  $(BACKEND_IMG):latest not found — skipping$(NC)\n"
	@docker rmi $(FRONTEND_IMG):latest 2>/dev/null && \
	  printf "$(GREEN)  Removed $(FRONTEND_IMG):latest$(NC)\n" || \
	  printf "$(YELLOW)  $(FRONTEND_IMG):latest not found — skipping$(NC)\n"

clean: ## Stop + remove containers and images (volume kept)
	@printf "$(YELLOW)── Full cleanup (containers + images) ───────────────$(NC)\n"
	@$(COMPOSE) down 2>/dev/null || true
	@docker rmi $(BACKEND_IMG):latest  2>/dev/null || true
	@docker rmi $(FRONTEND_IMG):latest 2>/dev/null || true
	@printf "$(GREEN)  Done. Named volume bodhion-backend-data preserved.$(NC)\n"

clean-all: _guard-confirm ## ⚠  Stop + remove containers, images AND volume (DATA LOSS)
	@printf "$(RED)── Full teardown including data volume ───────────────$(NC)\n"
	@$(COMPOSE) down --volumes 2>/dev/null || true
	@docker rmi $(BACKEND_IMG):latest  2>/dev/null || true
	@docker rmi $(FRONTEND_IMG):latest 2>/dev/null || true
	@printf "$(YELLOW)  All containers, images, and volume data removed.$(NC)\n"

prune: ## Remove ALL dangling Docker images and unused networks system-wide
	@printf "$(YELLOW)── Docker system prune (dangling resources) ──────────$(NC)\n"
	@docker system prune -f
	@printf "$(GREEN)  System prune complete.$(NC)\n"

# =============================================================================
# INTERNAL GUARDS (not shown in help)
# =============================================================================

_check-env:
	@if [ ! -f "$(ENV_FILE)" ]; then \
	  printf "$(RED)ERROR: $(ENV_FILE) not found.\n"; \
	  printf "  Run:  cp ../.env.default ../.env  then edit secrets.$(NC)\n"; \
	  exit 1; \
	fi

_check-running-backend:
	@if ! docker ps --format '{{.Names}}' | grep -q '^bodhion_backend$$'; then \
	  printf "$(RED)ERROR: backend container is not running. Run 'make up' first.$(NC)\n"; \
	  exit 1; \
	fi

_check-running-frontend:
	@if ! docker ps --format '{{.Names}}' | grep -q '^bodhion_frontend$$'; then \
	  printf "$(RED)ERROR: frontend container is not running. Run 'make up' first.$(NC)\n"; \
	  exit 1; \
	fi

_guard-confirm:
	@if [ "$(CONFIRM)" != "yes" ]; then \
	  printf "$(RED)⚠  This target destroys data and cannot be undone.\n"; \
	  printf "   Re-run with:  make $(MAKECMDGOALS) CONFIRM=yes$(NC)\n"; \
	  exit 1; \
	fi

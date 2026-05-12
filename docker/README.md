# Bodhion — Docker Commands

All commands run from the **`docker/`** directory, or prefix with `-C docker` from the project root.

---

## First-time setup

```bash
# 1. Create your local env file (one-time)
cp ../.env.default ../.env

# 2. Edit secrets
#    Set WEBUI_SECRET_KEY and OLLAMA_BASE_URL at minimum
nano ../.env        # or open in your editor

# 3. Build and start
make up
```

---

## Build

```bash
# Build all images
make build

# Build individual images
make build-backend
make build-frontend

# Force full rebuild — ignores layer cache
make build-no-cache
```

---

## Start

```bash
# Build (if needed) + start all services in background
make up

# Start already-built containers without rebuilding
make start

# Start from project root
make -C docker up
```

---

## Stop

```bash
# Stop containers (keeps them, restartable with 'make start')
make stop

# Stop + remove containers and network (volume kept)
make down

# Stop + remove containers, network AND all data volume  ⚠ data loss
make down-volumes CONFIRM=yes
```

---

## Restart individual services

```bash
make restart-backend
make restart-frontend

# Restart both
make restart
```

---

## Logs

```bash
# All services (live)
make logs

# Individual service
make logs-backend
make logs-frontend
```

---

## Shell access

```bash
# bash into the backend container
make shell-backend

# sh into the frontend/nginx container
make shell-frontend

# Live nginx error log
make shell-nginx
```

---

## Status and health

```bash
# Container status and ports
make ps

# Docker healthcheck state
make health

# Verify .env and show active variables
make env-check
```

---

## Cleanup

```bash
# Remove built images (containers stopped first)
make rmi

# Remove containers + images, keep data volume
make clean

# Remove everything including data volume  ⚠ data loss
make clean-all CONFIRM=yes

# Remove all dangling Docker images system-wide
make prune
```

---

## Using docker compose directly

```bash
# From docker/ directory — equivalent to the make targets above
docker compose -f docker-compose.yml up --build -d
docker compose -f docker-compose.yml logs -f backend
docker compose -f docker-compose.yml exec backend bash
docker compose -f docker-compose.yml down
```

---

## Default URL

```
http://localhost:80      # or whatever BODHION_PORT is set to in ../.env
```

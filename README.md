# Bodhion

**Bodhion is an enterprise-ready, self-hosted AI platform built by [Tanmay Mondal](mailto:t.mondal25@gmail.com).** It unifies multiple large language models — local and cloud-hosted — into a single interface, with a built-in RAG pipeline, document intelligence, voice, and a fully extensible function/pipeline framework. Designed for teams who want full control over their AI workflows without compromising on power or privacy.

---

## Key Features ⭐

- 🚀 **Effortless Setup**: Start the full stack with a single script using Docker Compose. No Kubernetes required for standard deployments.

- 🤝 **Ollama & OpenAI-Compatible APIs**: Connect to local Ollama models or any OpenAI-compatible endpoint — LMStudio, GroqCloud, Mistral, OpenRouter, and more. Configure any number of providers simultaneously.

- 🛡️ **Granular Permissions & User Groups**: Administrators can define detailed user roles, permissions, and group-level model access for a secure multi-tenant environment.

- 📱 **Responsive Design**: Seamless experience across desktop, laptop, and mobile. Includes a Progressive Web App (PWA) for offline access on localhost.

- ✒️🔢 **Full Markdown & LaTeX Support**: Rich rendering of Markdown, code blocks, tables, and LaTeX math in chat responses.

- 🎤📹 **Voice & Video Interface**: Hands-free interaction with multiple Speech-to-Text providers (Local Whisper, OpenAI, Deepgram, Azure) and Text-to-Speech engines (Azure, ElevenLabs, OpenAI, WebAPI, Transformers).

- 🛠️ **Custom Model Builder**: Create and configure workspace models built on top of base provider models — set system prompts, default parameters, and descriptions through the UI.

- 🐍 **Native Python Function Calling**: Extend LLM capabilities with pure Python functions. Built-in code editor with syntax highlighting lets you write and deploy functions directly from the admin panel.

- 💾 **Persistent Artifact Storage**: Built-in key-value storage API for journals, trackers, leaderboards, and collaborative tools with personal and shared data scopes across sessions.

- 📚 **Local RAG Pipeline**: Retrieval Augmented Generation with support for 9 vector databases (ChromaDB, PGVector, Qdrant, Milvus, Elasticsearch, OpenSearch, Pinecone, S3Vector, Oracle 23ai) and multiple extraction engines. Load documents into chat or the knowledge library via the `#` command.

- 🔬 **Bodhion Native Extractor**: Bodhion's proprietary PDF extraction engine with OCR preprocessing (Tesseract), borderless table detection, header/footer suppression, and hyphenated line-break repair — delivering significantly higher embedding quality from real-world enterprise documents.

- 🔍 **Web Search for RAG**: 15+ search providers including SearXNG, Google PSE, Brave, Tavily, Perplexity, Bing, DuckDuckGo, Jina, Exa, and Azure AI Search inject real-time results directly into chat.

- 🌐 **Web Browsing**: Incorporate any URL into chat using the `#` command. The page content is fetched and included as context.

- 🎨 **Image Generation & Editing**: Supports DALL-E, Gemini, ComfyUI (local), and AUTOMATIC1111 (local) for both generation and prompt-based editing.

- ⚙️ **Multi-Model Conversations**: Engage multiple models simultaneously in the same chat session, comparing responses side-by-side.

- 🔐 **Role-Based Access Control (RBAC)**: Restrict model access and administrative actions by role. Only authorised users can pull or create models.

- 🗄️ **Flexible Storage Backends**: SQLite (default, with optional encryption), PostgreSQL, S3, Google Cloud Storage, and Azure Blob Storage.

- 🔐 **Enterprise Authentication**: LDAP/Active Directory, SCIM 2.0 automated provisioning, SSO via trusted headers, and OAuth. Integrates with Okta, Azure AD, and Google Workspace for automated user lifecycle management.

- ☁️ **Cloud Storage Integrations**: Native Google Drive and OneDrive/SharePoint file pickers for seamless document import.

- 📊 **Production Observability**: Built-in OpenTelemetry (traces, metrics, logs) for integration with any observability stack.

- ⚖️ **Horizontal Scalability**: Redis-backed session management and WebSocket support for multi-worker and multi-node deployments behind load balancers.

- 🧩 **Pipelines & Plugin Framework**: Integrate custom Python logic and libraries via the Pipelines framework — function calling, rate limiting, usage monitoring, live translation, message filtering, and more.

- 🌐 **Multilingual UI**: i18n support for multiple languages across the Bodhion interface.

---

## Quick Start 🚀

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2+
- A running [Ollama](https://ollama.com) instance **or** an OpenAI-compatible API key

### 1 — Configure environment

```bash
# From the project root
cp .env.default .env
```

Open `.env` and set at minimum:

```env
WEBUI_SECRET_KEY=<a-long-random-string>
OLLAMA_BASE_URL=http://host.docker.internal:11434   # or your Ollama server URL
```

### 2 — Start the full stack

**Linux / macOS / WSL:**
```bash
bash scripts/start-docker.sh
```

**Windows PowerShell** (recommended):
```powershell
.\scripts\start-docker.ps1
# If blocked by execution policy:
PowerShell -ExecutionPolicy Bypass -File .\scripts\start-docker.ps1
```

**Windows CMD:**
```cmd
scripts\start-docker.bat
```

Bodhion will be available at **`http://localhost:80`** (or the port set as `BODHION_PORT` in `.env`).

> **First run:** Docker will build the backend and frontend images from source. This takes a few minutes. Subsequent starts are instant.

### 3 — Manage the stack

```bash
# View logs from all services
docker compose -f docker/docker-compose.yml logs -f

# Stop all services (data preserved)
docker compose -f docker/docker-compose.yml down

# Rebuild after code changes
docker compose -f docker/docker-compose.yml up --build -d
```

For a full list of developer targets, use the Makefile:

```bash
make -C docker help
```

---

## Startup Scripts 🛠️

All startup scripts live in [`scripts/`](./scripts/) and must be run from the **project root**.

| Script | Platform | Needs Docker | Description |
|--------|----------|:------------:|-------------|
| `start-docker.sh` | Linux / macOS / WSL | Yes | Full stack via Docker Compose |
| `start-docker.ps1` | Windows PowerShell | Yes | Full stack via Docker Compose |
| `start-docker.bat` | Windows CMD | Yes | Full stack via Docker Compose |
| `start-backend.sh` | Linux / macOS / WSL | No | FastAPI backend only (local) |
| `start-backend.ps1` | Windows PowerShell | No | FastAPI backend only (local) |
| `start-backend.bat` | Windows CMD | No | FastAPI backend only (local) |
| `start-frontend.sh` | Linux / macOS / WSL | No | Next.js frontend only (local) |
| `start-frontend.ps1` | Windows PowerShell | No | Next.js frontend only (local) |
| `start-frontend.bat` | Windows CMD | No | Next.js frontend only (local) |
| `prepare-pyodide.js` | Any (Node.js) | No | One-time Pyodide WASM setup |

---

### Full Stack — Docker Compose

Builds and starts the **complete stack** (FastAPI backend + Next.js frontend + nginx) in containers.

> On first run, the script automatically copies `.env.default` → `.env` if `.env` does not exist.
> Edit `.env` and set `WEBUI_SECRET_KEY` and `OLLAMA_BASE_URL` before starting.

After startup use `make -C docker ps` to verify both containers are healthy.

---

### Backend Only — Local (No Docker)

Starts the FastAPI/uvicorn backend directly. Loads configuration from `.env`. Backend runs at `http://localhost:8080`.

**Development mode** (auto-reloads on file save):
```bash
# Linux / macOS / WSL
bash scripts/start-backend.sh --reload

# Windows PowerShell
.\scripts\start-backend.ps1 --reload
```

**Production-like mode:**
```bash
bash scripts/start-backend.sh          # Linux / macOS / WSL
.\scripts\start-backend.ps1            # Windows PowerShell
scripts\start-backend.bat              # Windows CMD
```

---

### Frontend Only — Local (No Docker)

Starts the Next.js dev server. Reads `NEXT_PUBLIC_API_URL` from `.env` (defaults to `http://127.0.0.1:8080`). Runs `npm install` automatically if `node_modules` is missing. Frontend runs at `http://localhost:3000`.

**Development mode** (hot reload):
```bash
bash scripts/start-frontend.sh         # Linux / macOS / WSL
.\scripts\start-frontend.ps1           # Windows PowerShell
scripts\start-frontend.bat             # Windows CMD
```

**Production build + serve:**
```bash
bash scripts/start-frontend.sh --prod
.\scripts\start-frontend.ps1 --prod
scripts\start-frontend.bat --prod
```

---

### Local Development Workflow

Open **two terminal windows** from the project root:

**Terminal 1 — Backend:**
```bash
bash scripts/start-backend.sh --reload
```

**Terminal 2 — Frontend:**
```bash
bash scripts/start-frontend.sh
```

Open [http://localhost:3000](http://localhost:3000). The frontend dev server proxies all `/api/*`, `/ollama/*`, and `/openai/*` calls to the backend at port `8080`.

---

### One-Time Setup — Pyodide (In-Browser Python)

Only needed if you use the in-browser Python execution feature. Run once after cloning:

```bash
node scripts/prepare-pyodide.js
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         nginx (port 80)                         │
│   /           → Next.js frontend (port 3001)                    │
│   /api/*      → FastAPI backend  (port 8080)                    │
│   /ollama/*   → FastAPI backend  (port 8080)                    │
│   /ws/*       → FastAPI backend  (port 8080)                    │
└─────────────────────────────────────────────────────────────────┘
          │                              │
┌─────────┴──────────┐        ┌──────────┴──────────┐
│  Next.js Frontend  │        │   FastAPI Backend    │
│  (App Router)      │        │   (bodhion package)  │
│  React 19          │        │   SQLite / Postgres  │
│  Tailwind CSS      │        │   ChromaDB / Qdrant  │
│  Zustand / TQ      │        │   Alembic migrations │
└────────────────────┘        └─────────────────────┘
```

- **Frontend** — Next.js 15 (App Router), React 19, Tailwind CSS, Zustand, TanStack Query. See [`frontend/README.md`](./frontend/README.md).
- **Backend** — FastAPI (`bodhion` package), SQLAlchemy + Alembic, Socket.IO, Redis. See [`backend/README.md`](./backend/README.md).
- **Docker** — Two-service Compose stack with Dockerfile.backend and Dockerfile.frontend.nginx. See [`docker/README.md`](./docker/README.md).

---

## Troubleshooting

**Backend container can't reach Ollama on the host machine:**

When running via Docker Compose, the backend container cannot reach `localhost` on the host. Use the special hostname `host.docker.internal` in your `.env`:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

On Linux you may need to add `--add-host=host.docker.internal:host-gateway` to the Docker run flags, or set it in `docker-compose.yml`.

**Port already in use:**

Change the host port by setting `BODHION_PORT` in `.env`:

```env
BODHION_PORT=8080
```

**HuggingFace model downloads failing in offline environments:**

```env
HF_HUB_OFFLINE=1
```

---

## License 📜

This project is built and maintained by [Tanmay Mondal](mailto:t.mondal25@gmail.com).  
© 2025 Tanmay Mondal. All rights reserved.

This codebase includes components from various open-source projects under their respective licenses. For complete licensing details see the [LICENSE](./LICENSE) and [LICENSE_HISTORY](./LICENSE_HISTORY) files.

---

## Support 💬

For questions, bug reports, or feature requests, please open an issue on this repository.

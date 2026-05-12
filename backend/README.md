# Bodhion — Backend

The backend is a **FastAPI** application located in the `bodhion/` package. It serves REST API endpoints, WebSocket connections, and static assets for the Bodhion platform.

---

## Folder Structure

```
backend/
├── bodhion/                     # Main application package
│   ├── main.py                 # FastAPI app entry point
│   ├── config.py               # App configuration (env-driven)
│   ├── env.py                  # Environment variable definitions
│   ├── constants.py            # Shared constants
│   ├── functions.py            # Custom function execution
│   ├── tasks.py                # Background task helpers
│   ├── bodhion_banner.py        # Startup banner
│   ├── alembic.ini             # Database migration config
│   │
│   ├── models/                 # SQLAlchemy ORM models & Pydantic schemas
│   │   ├── auths.py            # Authentication
│   │   ├── users.py            # Users
│   │   ├── chats.py            # Chat sessions
│   │   ├── chat_messages.py    # Individual messages
│   │   ├── files.py            # File uploads
│   │   ├── knowledge.py        # Knowledge base entries
│   │   ├── memories.py         # User memories
│   │   ├── tools.py            # Tool definitions
│   │   ├── functions.py        # Custom functions
│   │   ├── prompts.py          # Saved prompts
│   │   ├── models.py           # LLM model records
│   │   ├── groups.py           # User groups
│   │   ├── folders.py          # Chat folders
│   │   ├── channels.py         # Channels
│   │   ├── feedbacks.py        # User feedback / evaluations
│   │   └── ...
│   │
│   ├── routers/                # FastAPI route handlers
│   │   ├── auths.py            # /auths — login, signup, token
│   │   ├── users.py            # /users — user management
│   │   ├── chats.py            # /chats — chat CRUD
│   │   ├── ollama.py           # /ollama — Ollama proxy
│   │   ├── openai.py           # /openai — OpenAI-compatible proxy
│   │   ├── models.py           # /models — model management
│   │   ├── files.py            # /files — file upload/download
│   │   ├── retrieval.py        # /retrieval — RAG pipeline
│   │   ├── knowledge.py        # /knowledge — knowledge base
│   │   ├── audio.py            # /audio — STT/TTS
│   │   ├── images.py           # /images — image generation
│   │   ├── tools.py            # /tools — tool management
│   │   ├── functions.py        # /functions — custom functions
│   │   ├── prompts.py          # /prompts — prompt library
│   │   ├── memories.py         # /memories — user memories
│   │   ├── pipelines.py        # /pipelines — pipeline server
│   │   ├── configs.py          # /configs — admin config
│   │   ├── groups.py           # /groups — user groups
│   │   ├── channels.py         # /channels — real-time channels
│   │   ├── evaluations.py      # /evaluations — model evaluations
│   │   ├── tasks.py            # /tasks — background tasks
│   │   ├── services.py         # /services — external services
│   │   ├── scim.py             # /scim — SCIM 2.0 provisioning
│   │   ├── analytics.py        # /analytics
│   │   ├── skills.py           # /skills
│   │   ├── terminals.py        # /terminals — code execution
│   │   ├── notes.py            # /notes
│   │   └── utils.py            # /utils — misc utilities
│   │
│   ├── retrieval/              # RAG / retrieval engine
│   │   ├── utils.py            # Core retrieval logic
│   │   ├── loaders/            # Document loaders (PDF, web, YouTube, etc.)
│   │   ├── models/             # Reranker models (ColBERT, external)
│   │   ├── vector/             # Vector DB abstraction (ChromaDB, Qdrant, etc.)
│   │   └── web/                # Web search providers (SearXNG, Brave, Bing, etc.)
│   │
│   ├── utils/                  # Shared utility modules
│   │   ├── auth.py             # JWT / session auth helpers
│   │   ├── middleware.py       # Custom middleware
│   │   ├── chat.py             # Chat processing helpers
│   │   ├── models.py           # Model resolution helpers
│   │   ├── embeddings.py       # Embedding utilities
│   │   ├── files.py            # File handling
│   │   ├── oauth.py            # OAuth provider logic
│   │   ├── redis.py            # Redis client helpers
│   │   ├── task.py             # Task queue helpers
│   │   ├── logger.py           # Logging setup
│   │   ├── audit.py            # Audit logging
│   │   ├── rate_limit.py       # Rate limiting
│   │   ├── security_headers.py # HTTP security headers
│   │   └── ...
│   │
│   ├── socket/                 # WebSocket / real-time layer
│   │   ├── main.py             # Socket.IO setup & event handlers
│   │   └── utils.py            # Socket utilities
│   │
│   ├── storage/                # Storage backend abstraction (local, S3, GCS)
│   ├── internal/               # Internal DB session & wrapper helpers
│   ├── migrations/             # Alembic migration scripts
│   ├── test/                   # Unit and integration tests
│   └── static/                 # Served static assets (Swagger UI, fonts)
│
├── data/                       # Runtime data (not committed)
│   ├── webui.db                # SQLite database (default)
│   ├── uploads/                # User-uploaded files
│   ├── cache/                  # Audio, image, and model cache
│   └── vector_db/              # ChromaDB vector store
│
├── requirements.txt            # Full dependency list
└── requirements-min.txt        # Minimal dependency list
```

---

## Prerequisites

- **Python 3.11** (required — other versions may cause compatibility issues)
- A running **Ollama** instance or an **OpenAI-compatible API** key
- **Tesseract OCR** — required by `BodhionNativeLoader` for extracting text from raster images in PDFs (see setup below)

---

## Tesseract OCR Setup

`BodhionNativeLoader` (`bodhion/retrieval/loaders/bodhion_native.py`) uses Tesseract to OCR raster images embedded in PDFs. The Tesseract binary must be installed on your system **before** ingesting PDF documents.

### Step 1 — Install the Tesseract binary

**Ubuntu 22.04 / 24.04** (ships Tesseract 4.x):
```bash
apt-get update && apt-get install -y tesseract-ocr
```

**Ubuntu 20.04** (optional upgrade to 5.x via PPA):
```bash
apt-get install -y tesseract-ocr
add-apt-repository ppa:alex-p/tesseract-ocr5
apt-get update && apt-get install -y tesseract-ocr
```

**macOS:**
```bash
brew install tesseract          # installs 5.x
```

**Windows:**
1. Download the 5.x installer from the [UB-Mannheim release page](https://github.com/UB-Mannheim/tesseract/wiki)
   (e.g. `tesseract-ocr-w64-setup-5.x.x.exe`)
2. Run the installer.
3. Add the install directory to your system **PATH**:
   `C:\Program Files\Tesseract-OCR`

**Docker / Dockerfile (recommended for production):**
```dockerfile
RUN apt-get update && apt-get install -y \
        tesseract-ocr \
        tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*
```

### Step 2 — Verify installation

```bash
tesseract --version
```

Expected output:
```
tesseract 5.x.x
 ...
```

> Tesseract 4.x also works. Tesseract 5.x is recommended for better accuracy.

### Step 3 — Install the Python binding

The `pytesseract` package is already listed in `requirements.txt`. If it is missing:

```bash
pip install pytesseract
```

### Step 4 — (Optional) Add extra language packs

By default only English (`eng`) is included. To support additional languages:

```bash
# Example: Hindi, French, German
apt-get install -y tesseract-ocr-hin tesseract-ocr-fra tesseract-ocr-deu
```

Then update the `_ocr_image_bytes()` call in `bodhion_native.py` to activate the extra languages:

```python
pytesseract.image_to_string(image, lang='eng+fra')
```

---

## Setup — Virtual Environment

### 1. Create a virtual environment

```bash
# From the backend/ directory
python -m venv venv
```

### 2. Activate the virtual environment

**Windows (Command Prompt):**
```cmd
venv\Scripts\activate.bat
```

**Windows (PowerShell):**
```powershell
venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

> For a lighter install without optional heavy dependencies (e.g. local embedding models), use:
> ```bash
> pip install -r requirements-min.txt
> ```

---

## Running the Server

From the `backend/` directory, with the virtual environment activated:

```bash
uvicorn bodhion.main:app --host 0.0.0.0 --port 8080 --reload
```

| Flag | Description |
|------|-------------|
| `--host 0.0.0.0` | Listen on all network interfaces |
| `--port 8080` | Default port (matches `.env` `PORT=8080`) |
| `--reload` | Auto-reload on code changes (development only) |

The API will be available at [http://localhost:8080](http://localhost:8080).  
Swagger UI docs are served at [http://localhost:8080/docs](http://localhost:8080/docs).

### Production run (no auto-reload)

```bash
uvicorn bodhion.main:app --host 0.0.0.0 --port 8080 --workers 4
```

---

## Environment Variables

Configuration is loaded from the `.env` file in the project root. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind host |
| `PORT` | `8080` | Server port |
| `DATABASE_URL` | SQLite (`./data/webui.db`) | Database connection string |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OPENAI_API_KEY` | — | OpenAI-compatible API key |
| `CORS_ALLOW_ORIGIN` | `http://localhost:3001` | Allowed frontend origins |
| `SECRET_KEY` | — | JWT signing secret |
| `REDIS_URL` | — | Redis URL (for WebSocket scaling) |
| `HF_HUB_OFFLINE` | `0` | Set to `1` to disable Hugging Face downloads |

---

## Support

If you have any questions or encounter issues, please open an issue on this repository.

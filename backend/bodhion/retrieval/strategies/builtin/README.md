# Adding a Custom Chunking Strategy

Chunking strategies control how extracted document text is split into chunks before embedding.
Each strategy is a Python class that lives in this folder, self-registers via a decorator, and is
picked up automatically by the API and the Admin UI — no routing or config-file wiring needed beyond
the steps below.

---

## How the system works

```
builtin/__init__.py          ← imports every module here (triggers @register)
         │
         ▼
registry.py  _REGISTRY       ← dict[name → class]
         │
         ├── GET /api/v1/retrieval/strategies   → returns available() list → UI dropdown
         │
         └── resolve_strategy_for_docs()        → instantiates the class with kwargs from
                                                   RAG_CHUNKING_STRATEGY_KWARGS and runs split()
```

The active strategy per extraction engine is stored in `RAG_CHUNKING_STRATEGY_MAP`
(e.g. `{"default": "character", "bodhion-native-extractor": "hr_policy_section"}`).
You assign a strategy to an engine from **Admin → Documents → Chunking Strategy**.

---

## Step-by-step: add a new strategy

### Step 1 — Create the strategy file

Create `builtin/your_strategy.py` (name the file after the strategy):

```python
import logging
from typing import List

from langchain_core.documents import Document
from bodhion.retrieval.strategies.base import BaseChunkingStrategy
from bodhion.retrieval.strategies.registry import register

log = logging.getLogger(__name__)


@register
class YourStrategy(BaseChunkingStrategy):
    name = "your_strategy_name"   # snake_case; must be unique across all strategies

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50) -> None:
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split(self, docs: List[Document]) -> List[Document]:
        """
        Receive a list of Document objects (one per extracted page/block).
        Return a (usually longer) list of chunk Documents.
        Preserve or enrich doc.metadata — it flows through to the vector store.
        """
        result: List[Document] = []
        # ... your splitting logic ...
        return result
```

**Rules:**
- `name` must be a non-empty snake_case string and unique in the registry.
- `__init__` parameters become the configurable kwargs (see Step 3).
- `split()` must return `List[Document]`; never return an empty list unless the input was empty.

---

### Step 2 — Import it in `__init__.py`

Open `builtin/__init__.py` and add one line:

```python
from . import character_strategy
from . import token_strategy
from . import hr_policy_strategy
from . import your_strategy        # ← add this
```

This import fires the `@register` decorator, which inserts the class into `_REGISTRY`.

---

### Step 3 — Add default kwargs in `config.py`

Open `backend/bodhion/config.py` and add your strategy's constructor defaults to
`RAG_CHUNKING_STRATEGY_KWARGS`:

```python
RAG_CHUNKING_STRATEGY_KWARGS = PersistentConfig(
    "RAG_CHUNKING_STRATEGY_KWARGS",
    "rag.chunking_strategy_kwargs",
    {
        "character":          {"chunk_size": 1000, "chunk_overlap": 200},
        "hr_policy_section":  {"chunk_size": 800,  "chunk_overlap": 150, "min_chunk_chars": 150},
        "token":              {"chunk_size": 512,  "chunk_overlap": 64,  "tiktoken_encoding": "cl100k_base"},
        "your_strategy_name": {"chunk_size": 500,  "chunk_overlap": 50},   # ← add this
    },
)
```

These values are passed as `**kwargs` to `__init__` at runtime and can be overridden from the
Admin UI later without a code change.

---

### Step 4 — (Optional) Pre-assign the strategy to an engine

If you want the strategy active by default for a specific extraction engine, update
`RAG_CHUNKING_STRATEGY_MAP` in `config.py`:

```python
RAG_CHUNKING_STRATEGY_MAP = PersistentConfig(
    "RAG_CHUNKING_STRATEGY_MAP",
    "rag.chunking_strategy_map",
    {
        "default":                   "character",
        "bodhion-native-extractor":   "hr_policy_section",
        "your_engine_name":          "your_strategy_name",   # ← add this
    },
)
```

Alternatively, assign it from **Admin → Documents → Chunking Strategy** without touching code.

---

### Step 5 — Restart the backend

```bash
uvicorn bodhion.main:app --reload
```

`GET /api/v1/retrieval/strategies` will now include `"your_strategy_name"` and the
**Admin → Documents → Chunking Strategy** dropdown will display it as **"Your Strategy Name"**
(the UI converts snake_case to Title Case automatically).

---

## Existing strategies for reference

| File | `name` | Description |
|---|---|---|
| `character_strategy.py` | `character` | LangChain `RecursiveCharacterTextSplitter` with optional markdown-header pre-split |
| `token_strategy.py` | `token` | Tiktoken-based token splitter (GPT token boundaries) |
| `hr_policy_section.py` | `hr_policy_section` | Regex splits on numbered section headings, then merges small chunks |

---

## Key files

| Path | Purpose |
|---|---|
| `base.py` | `BaseChunkingStrategy` ABC — `split()` contract |
| `registry.py` | `_REGISTRY`, `@register`, `resolve_strategy_for_docs()` |
| `builtin/__init__.py` | Imports that trigger registration |
| `config.py` (`RAG_CHUNKING_STRATEGY_MAP`) | Maps extraction engine → strategy name |
| `config.py` (`RAG_CHUNKING_STRATEGY_KWARGS`) | Default constructor kwargs per strategy |
| `routers/retrieval.py:473` | `GET /strategies` endpoint |
| `routers/retrieval.py:1600` | Where `resolve_strategy_for_docs()` is called during ingestion |

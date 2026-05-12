# Adding a Custom Post-Processing Step

Post-processors run **after** text extraction and **before** chunking/embedding.
Each processor is a Python class that lives in this folder, self-registers via a decorator, and is
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
         ├── GET /api/v1/retrieval/processors   → returns available() list → UI checkbox list
         │
         └── resolve_chain_for_docs()           → builds ProcessorChain from the active profile,
                                                   instantiates each class with kwargs from
                                                   RAG_PROCESSOR_KWARGS, and runs process() in order
```

Which processors are enabled per extraction engine is stored in `RAG_PROCESSOR_PROFILES`
(e.g. `{"bodhion-native-extractor": ["filter_cover_toc", "filter_min_content"]}`).
You toggle processors and reorder them from **Admin → Documents → Post-Processing Pipeline**.

---

## Step-by-step: add a new processor

### Step 1 — Create the processor file

Create `builtin/your_processor.py` (name the file after the processor):

```python
import logging
from typing import List

from langchain_core.documents import Document
from bodhion.retrieval.processors.base import BaseDocumentProcessor
from bodhion.retrieval.processors.registry import register

log = logging.getLogger(__name__)


@register
class YourProcessor(BaseDocumentProcessor):
    name = "your_processor_name"   # snake_case; must be unique across all processors

    def __init__(self, some_param: int = 10) -> None:
        self.some_param = some_param

    def process(self, docs: List[Document]) -> List[Document]:
        """
        Receive the current list of Document objects.
        Return the transformed list — may be shorter (filtered), same length, or longer.
        Preserve or enrich doc.metadata where relevant.
        """
        result: List[Document] = []
        # ... your processing logic ...
        return result
```

**Rules:**
- `name` must be a non-empty snake_case string and unique in the registry.
- `__init__` parameters become the configurable kwargs (see Step 3).
- `process()` must return `List[Document]`; returning an empty list drops all documents for
  that file — only do this intentionally (e.g. a strict filter).
- Processors in a chain share no state; each receives the output of the previous one.

---

### Step 2 — Import it in `__init__.py`

Open `builtin/__init__.py` and add one line:

```python
from . import cover_toc_filter
from . import image_placeholder_strip
from . import table_deduplicator
from . import min_content_filter
from . import context_prefix_injector
from . import your_processor          # ← add this
```

This import fires the `@register` decorator, which inserts the class into `_REGISTRY`.

---

### Step 3 — Add default kwargs in `config.py`

If your processor accepts constructor parameters, open `backend/bodhion/config.py` and add the
defaults to `RAG_PROCESSOR_KWARGS`:

```python
RAG_PROCESSOR_KWARGS = PersistentConfig(
    "RAG_PROCESSOR_KWARGS",
    "rag.processor_kwargs",
    {
        "filter_min_content":    {"min_chars": 100},
        "inject_context_prefix": {"include_section": True},
        "your_processor_name":   {"some_param": 10},   # ← add this
    },
)
```

These values are passed as `**kwargs` to `__init__` at runtime and can be overridden from the
Admin UI later without a code change.

---

### Step 4 — (Optional) Pre-enable the processor for an engine

If you want the processor active by default for a specific extraction engine, update
`RAG_PROCESSOR_PROFILES` in `config.py`:

```python
RAG_PROCESSOR_PROFILES = PersistentConfig(
    "RAG_PROCESSOR_PROFILES",
    "rag.processor_profiles",
    {
        "default": [],
        "bodhion-native-extractor": [
            "filter_cover_toc",
            "strip_image_placeholders",
            "your_processor_name",    # ← insert at the position you want it to run
        ],
    },
)
```

Order matters — processors run left-to-right as listed.
Alternatively, enable and reorder it from **Admin → Documents → Post-Processing Pipeline**
without touching code.

---

### Step 5 — Restart the backend

```bash
uvicorn bodhion.main:app --reload
```

`GET /api/v1/retrieval/processors` will now include `"your_processor_name"` and the
**Admin → Documents → Post-Processing Pipeline** panel will display it as
**"Your Processor Name"** with a numbered step badge when enabled
(the UI converts snake_case to Title Case automatically).

---

## Existing processors for reference

| File | `name` | Description |
|---|---|---|
| `cover_toc_filter.py` | `filter_cover_toc` | Drops cover-page and table-of-contents chunks |
| `image_placeholder_strip.py` | `strip_image_placeholders` | Removes `[IMAGE]` placeholder tokens left by the extractor |
| `table_deduplicator.py` | `deduplicate_tables` | Eliminates duplicate table blocks repeated across pages |
| `min_content_filter.py` | `filter_min_content` | Drops chunks below a minimum character count (`min_chars`) |
| `context_prefix_injector.py` | `inject_context_prefix` | Prepends document title and section heading to each chunk |

---

## Key files

| Path | Purpose |
|---|---|
| `base.py` | `BaseDocumentProcessor` ABC — `process()` contract |
| `registry.py` | `_REGISTRY`, `@register`, `ProcessorChain`, `resolve_chain_for_docs()` |
| `builtin/__init__.py` | Imports that trigger registration |
| `config.py` (`RAG_PROCESSOR_PROFILES`) | Maps extraction engine → ordered list of processor names |
| `config.py` (`RAG_PROCESSOR_KWARGS`) | Default constructor kwargs per processor |
| `routers/retrieval.py:466` | `GET /processors` endpoint |
| `routers/retrieval.py:1589` | Where `resolve_chain_for_docs()` is called during ingestion |

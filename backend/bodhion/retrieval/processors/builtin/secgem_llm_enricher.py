"""
SecGEM LLM Enricher — optional Ollama-backed post-processor.
Registered as: "secgem_llm_enricher"

Runs AFTER secgem_entity_splitter. Fills in metadata fields that rule-based
extraction cannot reliably determine from text alone:

  chunk_type            field enriched        prompt goal
  ─────────────────     ─────────────────     ────────────────────────────────
  secs_message          name (if missing)     extract the canonical message name
  secs_message          direction (if None)   classify direction from description
  variable_definition   domain                classify as carrier/process/equipment
  alarm_definition      category              classify alarm category
  state_model           model_name            infer state machine name from context

Graceful degradation:
  - If Ollama is unreachable at startup or per-call, logs a warning and returns
    docs unchanged. Never raises — the pipeline continues with rules-only output.
  - Each enrichment has an independent try/except so one bad call never blocks
    the rest of the batch.

To add to the pipeline, include "secgem_llm_enricher" in the processor profile
for "bodhion-secgem-extractor" in config.py, AFTER "secgem_entity_splitter":

    "bodhion-secgem-extractor": [
        "filter_cover_toc",
        "secgem_entity_splitter",
        "secgem_llm_enricher",   ← add here
        "filter_min_content",
    ],
"""

import json
import logging
import urllib.request
import urllib.error
from typing import List, Optional

from langchain_core.documents import Document

from bodhion.retrieval.processors.base import BaseDocumentProcessor
from bodhion.retrieval.processors.registry import register

log = logging.getLogger(__name__)

# ── Prompt templates ───────────────────────────────────────────────────────────

_SECS_NAME_PROMPT = """\
You are a SEMI SECS/GEM expert. Given the following SECS message definition,
extract the canonical message name (e.g. "ProceedWithCarrier", "CarrierOut").
Reply with ONLY the name, no punctuation, no explanation.

Message:
{content}
"""

_SECS_DIR_PROMPT = """\
You are a SEMI SECS/GEM expert. Determine the communication direction of this
SECS message. Reply with ONLY one of: host_to_eq, eq_to_host, both.

Message:
{content}
"""

_VAR_DOMAIN_PROMPT = """\
You are a SEMI equipment automation expert. Classify which domain this variable
belongs to. Reply with ONLY one of: carrier, process, equipment, substrate, lot.

Variable:
{content}
"""

_ALARM_CATEGORY_PROMPT = """\
You are a SEMI E30/GEM expert. Classify the alarm category.
Reply with ONLY one of: personal_safety, equipment, process, environment, other.

Alarm:
{content}
"""

_STATE_MODEL_NAME_PROMPT = """\
You are a SEMI standards expert. Given this state transition table excerpt,
what is the name of the state machine? Reply with ONLY the name (e.g.
"Carrier State Model", "Process Job State Model"), no explanation.

Table:
{content}
"""


@register
class SecGemLlmEnricher(BaseDocumentProcessor):
    """
    Optional Ollama-backed enricher for SecGEM entity chunks.
    Registered as: "secgem_llm_enricher"
    """

    name = "secgem_llm_enricher"

    def __init__(
        self,
        ollama_base_url: str = "http://localhost:11434",
        model: str = "mistral",
        timeout: int = 30,
    ) -> None:
        self._base_url = ollama_base_url.rstrip("/")
        self._model    = model
        self._timeout  = timeout
        self._available: Optional[bool] = None   # cached after first check

    # ── Public API ─────────────────────────────────────────────────────────────

    def process(self, docs: List[Document]) -> List[Document]:
        if not self._check_available():
            log.warning(
                "secgem_llm_enricher: Ollama not reachable at %s — "
                "skipping enrichment, rules-only output returned",
                self._base_url,
            )
            return docs

        enriched = []
        for doc in docs:
            try:
                enriched.append(self._enrich(doc))
            except Exception as exc:
                log.debug("secgem_llm_enricher: skipping doc (page %s): %s",
                          doc.metadata.get("page"), exc)
                enriched.append(doc)
        return enriched

    # ── Per-doc enrichment ─────────────────────────────────────────────────────

    def _enrich(self, doc: Document) -> Document:
        ctype   = doc.metadata.get("chunk_type", "")
        content = doc.page_content

        if ctype == "secs_message":
            if not doc.metadata.get("name"):
                name = self._call(
                    _SECS_NAME_PROMPT.format(content=content[:800])
                )
                if name:
                    doc.metadata["name"] = name.strip()[:80]

            if not doc.metadata.get("direction"):
                direction = self._call(
                    _SECS_DIR_PROMPT.format(content=content[:800])
                )
                if direction and direction.strip() in (
                    "host_to_eq", "eq_to_host", "both"
                ):
                    doc.metadata["direction"] = direction.strip()

        elif ctype == "variable_definition" and not doc.metadata.get("domain"):
            domain = self._call(
                _VAR_DOMAIN_PROMPT.format(content=content[:600])
            )
            if domain:
                doc.metadata["domain"] = domain.strip()[:40]

        elif ctype == "alarm_definition" and not doc.metadata.get("category"):
            category = self._call(
                _ALARM_CATEGORY_PROMPT.format(content=content[:600])
            )
            if category:
                doc.metadata["category"] = category.strip()[:40]

        elif ctype == "state_model" and not doc.metadata.get("model_name"):
            model_name = self._call(
                _STATE_MODEL_NAME_PROMPT.format(content=content[:800])
            )
            if model_name:
                doc.metadata["model_name"] = model_name.strip()[:80]

        return doc

    # ── Ollama HTTP helpers ────────────────────────────────────────────────────

    def _check_available(self) -> bool:
        if self._available is not None:
            return self._available
        try:
            url = f"{self._base_url}/api/tags"
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=5):
                pass
            self._available = True
        except Exception:
            self._available = False
        return self._available

    def _call(self, prompt: str) -> Optional[str]:
        """
        POST to Ollama /api/generate with stream=False.
        Returns the response text, or None on any error.
        """
        url     = f"{self._base_url}/api/generate"
        payload = json.dumps({
            "model":  self._model,
            "prompt": prompt,
            "stream": False,
        }).encode()
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                body = json.loads(resp.read().decode())
                return body.get("response", "").strip() or None
        except Exception as exc:
            log.debug("secgem_llm_enricher: Ollama call failed: %s", exc)
            self._available = False   # stop trying for remaining docs
            return None

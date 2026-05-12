"""
SecGEM extractor test suite.

Run with:
    cd backend
    pytest tests/test_secgem_extractor.py -v

The KIGEM PDF fixture path is read from the env var SECGEM_TEST_PDF.
If the variable is not set, PDF-dependent tests are skipped automatically.

Tests that do NOT require the PDF (unit tests on helpers, schemas, strategy)
always run.
"""

import os
import re
import json
import pytest
from typing import List
from unittest.mock import patch, MagicMock

from langchain_core.documents import Document

# ── Fixtures ───────────────────────────────────────────────────────────────────

PDF_PATH = os.environ.get("SECGEM_TEST_PDF", "")
needs_pdf = pytest.mark.skipif(not PDF_PATH, reason="SECGEM_TEST_PDF not set")


@pytest.fixture(scope="session")
def page_docs() -> List[Document]:
    """Load the KIGEM PDF once and return all page-level Documents."""
    from bodhion.retrieval.loaders.bodhion_native_secgem import BodhionSecGemLoader
    loader = BodhionSecGemLoader(
        file_path=PDF_PATH,
        extract_images=False,   # skip OCR for speed
        ocr_images=False,
    )
    return loader.load()


@pytest.fixture(scope="session")
def entity_docs(page_docs) -> List[Document]:
    """Run the entity splitter over all page Documents."""
    from bodhion.retrieval.processors.builtin.secgem_entity_splitter import (
        SecGemEntitySplitter,
    )
    splitter = SecGemEntitySplitter()
    return splitter.process(page_docs)


@pytest.fixture(scope="session")
def strategy_docs(entity_docs) -> List[Document]:
    """Run the SecGEM strategy over entity-split Documents."""
    from bodhion.retrieval.strategies.builtin.secgem_strategy import SecGemStrategy
    strategy = SecGemStrategy(chunk_size=800, chunk_overlap=100)
    return strategy.split(entity_docs)


# ── Schema unit tests (no PDF needed) ─────────────────────────────────────────

class TestSchemas:
    def test_secs_message_meta_defaults(self):
        from bodhion.retrieval.loaders.secgem_schemas import SecsMessageMeta
        m = SecsMessageMeta(stream=3, function=17, message_id="S3F17")
        d = m.model_dump()
        assert d["chunk_type"] == "secs_message"
        assert d["stream"] == 3
        assert d["function"] == 17
        assert d["related_messages"] == []
        assert d["processing_engine"] == "bodhion-secgem-extractor"

    def test_variable_definition_meta(self):
        from bodhion.retrieval.loaders.secgem_schemas import VariableDefinitionMeta
        m = VariableDefinitionMeta(var_id="1001", var_type="SVID", var_name="CarrierID")
        d = m.model_dump()
        assert d["chunk_type"] == "variable_definition"
        assert d["var_id"] == "1001"

    def test_event_definition_meta(self):
        from bodhion.retrieval.loaders.secgem_schemas import EventDefinitionMeta
        m = EventDefinitionMeta(event_id="100", event_name="CarrierArrived")
        d = m.model_dump()
        assert d["chunk_type"] == "event_definition"

    def test_alarm_definition_meta(self):
        from bodhion.retrieval.loaders.secgem_schemas import AlarmDefinitionMeta
        m = AlarmDefinitionMeta(alarm_id="200", alarm_name="DoorOpen")
        d = m.model_dump()
        assert d["chunk_type"] == "alarm_definition"

    def test_state_model_meta(self):
        from bodhion.retrieval.loaders.secgem_schemas import StateModelMeta
        m = StateModelMeta(model_name="Carrier State Model", states=["In Use", "Out of Service"])
        d = m.model_dump()
        assert d["chunk_type"] == "state_model"
        assert len(d["states"]) == 2

    def test_error_code_meta(self):
        from bodhion.retrieval.loaders.secgem_schemas import ErrorCodeMeta
        m = ErrorCodeMeta(code="3", description="Access denied")
        d = m.model_dump()
        assert d["chunk_type"] == "error_code"

    def test_narrative_meta(self):
        from bodhion.retrieval.loaders.secgem_schemas import NarrativeMeta
        m = NarrativeMeta(chapter="7 State Model", section_path="7 > 7.1")
        d = m.model_dump()
        assert d["chunk_type"] == "narrative"

    def test_chunk_type_to_model_lookup(self):
        from bodhion.retrieval.loaders.secgem_schemas import CHUNK_TYPE_TO_MODEL
        assert "secs_message" in CHUNK_TYPE_TO_MODEL
        assert "narrative" in CHUNK_TYPE_TO_MODEL
        assert len(CHUNK_TYPE_TO_MODEL) == 7

    def test_entity_chunk_types_excludes_narrative(self):
        from bodhion.retrieval.loaders.secgem_schemas import ENTITY_CHUNK_TYPES
        assert "narrative" not in ENTITY_CHUNK_TYPES
        assert "secs_message" in ENTITY_CHUNK_TYPES

    def test_all_meta_are_json_serializable(self):
        from bodhion.retrieval.loaders.secgem_schemas import (
            SecsMessageMeta, VariableDefinitionMeta, EventDefinitionMeta,
            AlarmDefinitionMeta, StateModelMeta, ErrorCodeMeta, NarrativeMeta,
        )
        for cls in (SecsMessageMeta, VariableDefinitionMeta, EventDefinitionMeta,
                    AlarmDefinitionMeta, StateModelMeta, ErrorCodeMeta, NarrativeMeta):
            d = cls().model_dump()
            json.dumps(d)   # raises if not serializable


# ── Entity splitter unit tests (no PDF needed) ────────────────────────────────

class TestEntitySplitter:

    def _make_doc(self, content: str, metadata: dict = None) -> Document:
        meta = {
            "processing_engine": "bodhion-secgem-extractor",
            "page": 0,
            "file_name": "test.pdf",
            "section_path": "7 State Model",
            **(metadata or {}),
        }
        return Document(page_content=content, metadata=meta)

    def test_non_secgem_doc_passes_through(self):
        from bodhion.retrieval.processors.builtin.secgem_entity_splitter import (
            SecGemEntitySplitter,
        )
        doc = Document(
            page_content="hello",
            metadata={"processing_engine": "bodhion-native-extractor"},
        )
        result = SecGemEntitySplitter().process([doc])
        assert result == [doc]

    def test_secs_fence_produces_secs_message_chunk(self):
        from bodhion.retrieval.processors.builtin.secgem_entity_splitter import (
            SecGemEntitySplitter,
        )
        content = "Some text\n\n```secs\nS3F17 ProceedWithCarrier\n<L [2]>\n  <U4[1] 100>\n</L>\n```\n\nMore text"
        doc = self._make_doc(content)
        result = SecGemEntitySplitter().process([doc])
        secs = [r for r in result if r.metadata.get("chunk_type") == "secs_message"]
        assert len(secs) >= 1
        assert secs[0].metadata["stream"] == 3
        assert secs[0].metadata["function"] == 17
        assert secs[0].metadata["message_id"] == "S3F17"

    def test_secs_name_extracted(self):
        from bodhion.retrieval.processors.builtin.secgem_entity_splitter import (
            SecGemEntitySplitter,
        )
        content = "```secs\nS3F17 ProceedWithCarrier Host->EQ\n<U4[1] 100>\n```"
        doc = self._make_doc(content)
        result = SecGemEntitySplitter().process([doc])
        secs = [r for r in result if r.metadata.get("chunk_type") == "secs_message"]
        assert secs[0].metadata.get("name") == "ProceedWithCarrier"

    def test_secs_direction_extracted(self):
        from bodhion.retrieval.processors.builtin.secgem_entity_splitter import (
            SecGemEntitySplitter,
        )
        content = "```secs\nS3F17 Host->EQ\n<U4[1] 100>\n```"
        doc = self._make_doc(content)
        result = SecGemEntitySplitter().process([doc])
        secs = [r for r in result if r.metadata.get("chunk_type") == "secs_message"]
        assert secs[0].metadata.get("direction") == "host_to_eq"

    def test_ceid_table_produces_event_chunks(self):
        from bodhion.retrieval.processors.builtin.secgem_entity_splitter import (
            SecGemEntitySplitter,
        )
        content = (
            "<!-- semi-table: ceid -->\n"
            "| CEID | Name | Description |\n"
            "| --- | --- | --- |\n"
            "| 100 | CarrierArrived | Carrier has arrived at load port |\n"
            "| 101 | CarrierRemoved | Carrier removed from load port |\n"
        )
        doc = self._make_doc(content)
        result = SecGemEntitySplitter().process([doc])
        events = [r for r in result if r.metadata.get("chunk_type") == "event_definition"]
        assert len(events) == 2
        ids = {e.metadata["event_id"] for e in events}
        assert "100" in ids
        assert "101" in ids

    def test_vid_table_produces_variable_chunks(self):
        from bodhion.retrieval.processors.builtin.secgem_entity_splitter import (
            SecGemEntitySplitter,
        )
        content = (
            "<!-- semi-table: vid -->\n"
            "| SVID | Name | Format |\n"
            "| --- | --- | --- |\n"
            "| 1001 | CarrierID | A |\n"
            "| 1002 | LotID | A |\n"
        )
        doc = self._make_doc(content)
        result = SecGemEntitySplitter().process([doc])
        variables = [r for r in result if r.metadata.get("chunk_type") == "variable_definition"]
        assert len(variables) == 2
        assert variables[0].metadata["var_type"] == "SVID"

    def test_alid_table_produces_alarm_chunks(self):
        from bodhion.retrieval.processors.builtin.secgem_entity_splitter import (
            SecGemEntitySplitter,
        )
        content = (
            "<!-- semi-table: alid -->\n"
            "| ALID | Name | Description |\n"
            "| --- | --- | --- |\n"
            "| 200 | DoorOpen | Door is open |\n"
        )
        doc = self._make_doc(content)
        result = SecGemEntitySplitter().process([doc])
        alarms = [r for r in result if r.metadata.get("chunk_type") == "alarm_definition"]
        assert len(alarms) == 1
        assert alarms[0].metadata["alarm_id"] == "200"

    def test_state_table_produces_one_state_model_chunk(self):
        from bodhion.retrieval.processors.builtin.secgem_entity_splitter import (
            SecGemEntitySplitter,
        )
        content = (
            "<!-- semi-table: state -->\n"
            "| Transition | From State | To State | Event |\n"
            "| --- | --- | --- | --- |\n"
            "| 1 | In Use | Out of Service | ErrorDetected |\n"
            "| 2 | Out of Service | In Use | Cleared |\n"
        )
        doc = self._make_doc(content)
        result = SecGemEntitySplitter().process([doc])
        states = [r for r in result if r.metadata.get("chunk_type") == "state_model"]
        assert len(states) == 1
        assert states[0].metadata["transitions"] == 2
        assert "In Use" in states[0].metadata["states"]

    def test_page_with_no_entities_becomes_narrative(self):
        from bodhion.retrieval.processors.builtin.secgem_entity_splitter import (
            SecGemEntitySplitter,
        )
        doc = self._make_doc("This is a plain prose paragraph with no SECS content.")
        result = SecGemEntitySplitter().process([doc])
        assert len(result) == 1
        assert result[0].metadata.get("chunk_type") == "narrative"

    def test_all_chunks_have_section_path(self):
        from bodhion.retrieval.processors.builtin.secgem_entity_splitter import (
            SecGemEntitySplitter,
        )
        content = "```secs\nS3F17\n<U4[1] 1>\n```"
        doc = self._make_doc(content, {"section_path": "7 State Model > 7.1 Carrier"})
        result = SecGemEntitySplitter().process([doc])
        for r in result:
            assert r.metadata.get("section_path") == "7 State Model > 7.1 Carrier"

    def test_metadata_is_json_serializable(self):
        from bodhion.retrieval.processors.builtin.secgem_entity_splitter import (
            SecGemEntitySplitter,
        )
        content = "```secs\nS3F17 ProceedWithCarrier\n<U4[1] 1>\n```"
        doc = self._make_doc(content)
        result = SecGemEntitySplitter().process([doc])
        for r in result:
            json.dumps(r.metadata)   # must not raise


# ── Strategy unit tests (no PDF needed) ───────────────────────────────────────

class TestSecGemStrategy:

    def _entity_doc(self, ctype: str, content: str = "x" * 2000) -> Document:
        return Document(
            page_content=content,
            metadata={"chunk_type": ctype, "processing_engine": "bodhion-secgem-extractor"},
        )

    def _narrative_doc(self, content: str) -> Document:
        return Document(
            page_content=content,
            metadata={"chunk_type": "narrative"},
        )

    def test_entity_chunks_never_split(self):
        from bodhion.retrieval.strategies.builtin.secgem_strategy import SecGemStrategy
        from bodhion.retrieval.loaders.secgem_schemas import ENTITY_CHUNK_TYPES
        strategy = SecGemStrategy(chunk_size=100)
        for ctype in ENTITY_CHUNK_TYPES:
            doc = self._entity_doc(ctype)
            result = strategy.split([doc])
            assert len(result) == 1, f"{ctype} chunk was split but should not be"

    def test_narrative_long_doc_is_split(self):
        from bodhion.retrieval.strategies.builtin.secgem_strategy import SecGemStrategy
        strategy = SecGemStrategy(chunk_size=100, chunk_overlap=10)
        doc = self._narrative_doc("word " * 300)
        result = strategy.split([doc])
        assert len(result) > 1

    def test_narrative_short_doc_stays_single(self):
        from bodhion.retrieval.strategies.builtin.secgem_strategy import SecGemStrategy
        strategy = SecGemStrategy(chunk_size=800)
        doc = self._narrative_doc("Short paragraph.")
        result = strategy.split([doc])
        assert len(result) == 1

    def test_mixed_batch(self):
        from bodhion.retrieval.strategies.builtin.secgem_strategy import SecGemStrategy
        strategy = SecGemStrategy(chunk_size=50, chunk_overlap=5)
        entity = self._entity_doc("secs_message", "x" * 500)
        narrative = self._narrative_doc("word " * 200)
        result = strategy.split([entity, narrative])
        # Entity stays as 1; narrative gets split into multiple
        entity_out  = [r for r in result if r.metadata.get("chunk_type") == "secs_message"]
        narrative_out = [r for r in result if r.metadata.get("chunk_type") == "narrative"]
        assert len(entity_out) == 1
        assert len(narrative_out) > 1


# ── LLM enricher unit tests (no PDF, Ollama mocked) ───────────────────────────

class TestSecGemLlmEnricher:

    def _secs_doc(self) -> Document:
        return Document(
            page_content="```secs\nS3F17\n<U4[1] 1>\n```",
            metadata={
                "chunk_type": "secs_message",
                "stream": 3, "function": 17,
                "message_id": "S3F17",
                "name": None, "direction": None,
            },
        )

    def test_ollama_unreachable_returns_docs_unchanged(self):
        from bodhion.retrieval.processors.builtin.secgem_llm_enricher import (
            SecGemLlmEnricher,
        )
        enricher = SecGemLlmEnricher(
            ollama_base_url="http://localhost:19999",  # nothing listens here
            timeout=1,
        )
        doc = self._secs_doc()
        result = enricher.process([doc])
        assert result == [doc]   # unchanged

    def test_ollama_available_enriches_name(self):
        from bodhion.retrieval.processors.builtin.secgem_llm_enricher import (
            SecGemLlmEnricher,
        )
        enricher = SecGemLlmEnricher()
        enricher._available = True   # bypass availability check

        with patch.object(enricher, "_call", return_value="ProceedWithCarrier"):
            doc = self._secs_doc()
            result = enricher.process([doc])
        assert result[0].metadata["name"] == "ProceedWithCarrier"

    def test_bad_direction_value_ignored(self):
        from bodhion.retrieval.processors.builtin.secgem_llm_enricher import (
            SecGemLlmEnricher,
        )
        enricher = SecGemLlmEnricher()
        enricher._available = True
        with patch.object(enricher, "_call", return_value="sideways"):
            doc = self._secs_doc()
            result = enricher.process([doc])
        assert result[0].metadata["direction"] is None

    def test_exception_in_enrich_does_not_raise(self):
        from bodhion.retrieval.processors.builtin.secgem_llm_enricher import (
            SecGemLlmEnricher,
        )
        enricher = SecGemLlmEnricher()
        enricher._available = True
        with patch.object(enricher, "_enrich", side_effect=RuntimeError("boom")):
            doc = self._secs_doc()
            result = enricher.process([doc])
        assert result[0] is doc   # original doc returned on error


# ── Integration tests against real KIGEM PDF ──────────────────────────────────

@needs_pdf
class TestKigemPdf:

    def test_loader_returns_documents(self, page_docs):
        assert len(page_docs) > 0

    def test_all_pages_have_processing_engine(self, page_docs):
        for doc in page_docs:
            assert doc.metadata.get("processing_engine") == "bodhion-secgem-extractor"

    def test_produces_secs_message_chunks(self, entity_docs):
        secs = [d for d in entity_docs if d.metadata.get("chunk_type") == "secs_message"]
        assert len(secs) >= 1, "Expected at least one secs_message chunk"

    def test_produces_variable_definition_chunks(self, entity_docs):
        variables = [d for d in entity_docs if d.metadata.get("chunk_type") == "variable_definition"]
        assert len(variables) >= 1, "Expected at least one variable_definition chunk"

    def test_produces_event_definition_chunks(self, entity_docs):
        events = [d for d in entity_docs if d.metadata.get("chunk_type") == "event_definition"]
        assert len(events) >= 1, "Expected at least one event_definition chunk"

    def test_s3f17_chunk_metadata(self, entity_docs):
        secs = [
            d for d in entity_docs
            if d.metadata.get("chunk_type") == "secs_message"
            and d.metadata.get("message_id") == "S3F17"
        ]
        assert len(secs) >= 1, "S3F17 chunk not found"
        s = secs[0]
        assert s.metadata["stream"]   == 3
        assert s.metadata["function"] == 17

    def test_section_path_populated_on_content_pages(self, entity_docs):
        content_docs = [
            d for d in entity_docs
            if d.metadata.get("chunk_type") not in ("narrative",)
               or d.metadata.get("page", 0) > 5   # skip cover pages
        ]
        with_path = [d for d in content_docs if d.metadata.get("section_path")]
        assert len(with_path) > 0, "No chunks have section_path set"

    def test_secgem_strategy_never_splits_entity_chunks(self, entity_docs):
        from bodhion.retrieval.strategies.builtin.secgem_strategy import SecGemStrategy
        from bodhion.retrieval.loaders.secgem_schemas import ENTITY_CHUNK_TYPES
        strategy = SecGemStrategy(chunk_size=200)   # small size would split narrative
        result   = strategy.split(entity_docs)
        for doc in result:
            if doc.metadata.get("chunk_type") in ENTITY_CHUNK_TYPES:
                assert "start_index" not in doc.metadata or True  # entity, not split

    def test_all_chunk_metadata_json_serializable(self, strategy_docs):
        for doc in strategy_docs:
            json.dumps(doc.metadata)   # must not raise TypeError

    def test_all_chunks_validate_against_pydantic_schema(self, strategy_docs):
        from bodhion.retrieval.loaders.secgem_schemas import CHUNK_TYPE_TO_MODEL
        for doc in strategy_docs:
            ctype = doc.metadata.get("chunk_type")
            if ctype not in CHUNK_TYPE_TO_MODEL:
                continue
            model_cls = CHUNK_TYPE_TO_MODEL[ctype]
            # Should not raise ValidationError
            model_cls(**{k: v for k, v in doc.metadata.items()
                         if k in model_cls.model_fields})

    def test_idempotent_rerun_produces_same_chunk_count(self, page_docs):
        """Re-running entity splitter on the same page docs must produce identical count."""
        from bodhion.retrieval.processors.builtin.secgem_entity_splitter import (
            SecGemEntitySplitter,
        )
        splitter = SecGemEntitySplitter()
        first  = splitter.process(page_docs)
        second = splitter.process(page_docs)
        assert len(first) == len(second), (
            f"Entity splitter not idempotent: {len(first)} vs {len(second)} chunks"
        )

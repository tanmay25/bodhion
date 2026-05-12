"""
SecGEM chunk metadata schemas.

One Pydantic model per semantic chunk type produced by BodhionSecGemLoader +
SecGemEntitySplitter. All models are:
  - Fully typed
  - JSON-serializable via .model_dump()
  - Used by the entity splitter (Phase 3) to build Document.metadata
  - Used by tests (Phase 7) to validate every chunk coming out of the pipeline

Chunk taxonomy:
  secs_message        — one per S<n>F<m> definition
  variable_definition — one per SVID / ECID / DVVAL row
  event_definition    — one per CEID row
  alarm_definition    — one per ALID row
  state_model         — one per state transition table
  error_code          — one per error-code table row
  narrative           — page-level fallback for prose sections
"""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field

_ENGINE = "bodhion-secgem-extractor"


# ── Per-entity metadata models ─────────────────────────────────────────────────

class SecsMessageMeta(BaseModel):
    chunk_type:        str            = "secs_message"
    stream:            Optional[int]  = None          # 3  (from S3F17)
    function:          Optional[int]  = None          # 17
    message_id:        Optional[str]  = None          # "S3F17"
    name:              Optional[str]  = None          # "ProceedWithCarrier"
    direction:         Optional[str]  = None          # "host_to_eq" | "eq_to_host" | "both"
    related_messages:  List[str]      = Field(default_factory=list)  # ["S3F18"]
    section_path:      str            = ""
    page:              int            = 0
    file_name:         str            = ""
    processing_engine: str            = _ENGINE


class VariableDefinitionMeta(BaseModel):
    chunk_type:        str           = "variable_definition"
    var_id:            Optional[str] = None   # "1001"
    var_type:          Optional[str] = None   # "SVID" | "ECID" | "DVVAL"
    var_name:          Optional[str] = None
    data_format:       Optional[str] = None   # "U4", "A", "BOOLEAN"
    domain:            Optional[str] = None   # "carrier" | "process" | "equipment"
    section_path:      str           = ""
    page:              int           = 0
    file_name:         str           = ""
    processing_engine: str           = _ENGINE


class EventDefinitionMeta(BaseModel):
    chunk_type:        str           = "event_definition"
    event_id:          Optional[str] = None   # CEID value, e.g. "100"
    event_name:        Optional[str] = None
    related_object:    Optional[str] = None   # "carrier" | "lot" | "substrate"
    section_path:      str           = ""
    page:              int           = 0
    file_name:         str           = ""
    processing_engine: str           = _ENGINE


class AlarmDefinitionMeta(BaseModel):
    chunk_type:        str           = "alarm_definition"
    alarm_id:          Optional[str] = None
    alarm_name:        Optional[str] = None
    category:          Optional[str] = None   # "personal_safety" | "equipment" | "process"
    section_path:      str           = ""
    page:              int           = 0
    file_name:         str           = ""
    processing_engine: str           = _ENGINE


class StateModelMeta(BaseModel):
    chunk_type:        str       = "state_model"
    model_name:        Optional[str]  = None
    states:            List[str] = Field(default_factory=list)
    transitions:       int       = 0        # number of transition rows found
    section_path:      str       = ""
    page:              int       = 0
    file_name:         str       = ""
    processing_engine: str       = _ENGINE


class ErrorCodeMeta(BaseModel):
    chunk_type:        str           = "error_code"
    code:              Optional[str] = None
    category:          Optional[str] = None
    description:       Optional[str] = None
    section_path:      str           = ""
    page:              int           = 0
    file_name:         str           = ""
    processing_engine: str           = _ENGINE


class NarrativeMeta(BaseModel):
    chunk_type:        str           = "narrative"
    chapter:           Optional[str] = None   # top-level section, e.g. "7 State Model"
    section_path:      str           = ""
    page:              int           = 0
    file_name:         str           = ""
    processing_engine: str           = _ENGINE


# ── Extractor config schema ────────────────────────────────────────────────────

class SecGemExtractorConfig(BaseModel):
    """Mirrors the BODHION_SECGEM_* config keys in retrieval.py ConfigForm."""
    extract_images:           bool = True
    ocr_images:               bool = True
    extract_tables:           bool = True
    image_min_width:          int  = 50
    image_min_height:         int  = 50
    detect_secs_blocks:       bool = True
    annotate_semi_tables:     bool = True
    preserve_section_context: bool = True


# ── Convenience lookup ─────────────────────────────────────────────────────────

CHUNK_TYPE_TO_MODEL = {
    "secs_message":        SecsMessageMeta,
    "variable_definition": VariableDefinitionMeta,
    "event_definition":    EventDefinitionMeta,
    "alarm_definition":    AlarmDefinitionMeta,
    "state_model":         StateModelMeta,
    "error_code":          ErrorCodeMeta,
    "narrative":           NarrativeMeta,
}

ENTITY_CHUNK_TYPES = frozenset(CHUNK_TYPE_TO_MODEL.keys()) - {"narrative"}

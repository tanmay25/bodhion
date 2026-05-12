"""
SecGEM Entity Splitter — post-processor for bodhion-secgem-extractor pages.

Input:  one Document per page (from BodhionSecGemLoader)
Output: one Document per semantic entity:

  chunk_type              trigger
  ─────────────────────── ─────────────────────────────────────────────────
  secs_message            each ```secs … ``` fence on the page
  event_definition        each data row in a <!-- semi-table: ceid --> table
  variable_definition     each data row in a <!-- semi-table: vid  --> table
  alarm_definition        each data row in a <!-- semi-table: alid --> table
  state_model             each <!-- semi-table: state --> table (1 chunk)
  error_code              each data row in a <!-- semi-table: error --> table
  narrative               any page that produced no entity chunks

Only processes docs with processing_engine == "bodhion-secgem-extractor".
All other docs pass through unchanged.
"""

import re
import logging
from typing import Dict, List, Optional, Tuple

from langchain_core.documents import Document

from bodhion.retrieval.processors.base import BaseDocumentProcessor
from bodhion.retrieval.processors.registry import register
from bodhion.retrieval.loaders.secgem_schemas import (
    AlarmDefinitionMeta,
    ErrorCodeMeta,
    EventDefinitionMeta,
    NarrativeMeta,
    SecsMessageMeta,
    StateModelMeta,
    VariableDefinitionMeta,
)

log = logging.getLogger(__name__)

# ── Compiled patterns ──────────────────────────────────────────────────────────

# Extracts the body of every ```secs … ``` fence
_SECS_FENCE_RE = re.compile(r"```secs\n(.*?)\n```", re.DOTALL)

# Matches <!-- semi-table: ceid --> (or vid / alid / state / error / attribute)
_SEMI_TABLE_COMMENT_RE = re.compile(r"<!--\s*semi-table:\s*(\w+)\s*-->")

# S#F# identifier
_SECS_MSG_RE = re.compile(r"\bS(\d{1,2})F(\d{1,3})\b")

# Message name: TitleCase word immediately after S#F#
_SECS_NAME_RE = re.compile(r"\bS\d{1,2}F\d{1,3}\s+([A-Z][A-Za-z][A-Za-z0-9]+)")

# Direction arrow variants
_SECS_DIR_RE = re.compile(
    r"(host\s*[-→>]+\s*eq|eq\s*[-→>]+\s*host"
    r"|h\s*[-→>]+\s*e|e\s*[-→>]+\s*h)",
    re.IGNORECASE,
)


@register
class SecGemEntitySplitter(BaseDocumentProcessor):
    """
    Registered as: "secgem_entity_splitter"

    Converts page-level SecGEM Documents into fine-grained entity chunks.
    Entity chunks carry fully-typed Pydantic metadata (serialised to dict)
    so every field is guaranteed present and correctly typed in the vector store.
    """

    name = "secgem_entity_splitter"

    def process(self, docs: List[Document]) -> List[Document]:
        out: List[Document] = []
        for doc in docs:
            if doc.metadata.get("processing_engine") != "bodhion-secgem-extractor":
                out.append(doc)
                continue
            out.extend(self._split_page(doc))

        log.debug(
            "secgem_entity_splitter: %d page(s) → %d entity chunk(s)",
            len(docs), len(out),
        )
        return out

    # ── Page splitter ──────────────────────────────────────────────────────────

    def _split_page(self, doc: Document) -> List[Document]:
        content  = doc.page_content
        base_meta = doc.metadata
        chunks: List[Document] = []

        # 1. SECS message fences
        chunks.extend(self._extract_secs_chunks(content, base_meta))

        # 2. SEMI table rows (ceid / vid / alid / state / error)
        chunks.extend(self._extract_table_entity_chunks(content, base_meta))

        # 3. Nothing extracted → emit whole page as narrative
        if not chunks:
            meta = NarrativeMeta(
                chapter      = _first_section(base_meta.get("section_path", "")),
                section_path = base_meta.get("section_path", ""),
                page         = base_meta.get("page", 0),
                file_name    = base_meta.get("file_name", ""),
            )
            chunks.append(Document(
                page_content=content,
                metadata=meta.model_dump(),
            ))

        return chunks

    # ── SECS message extraction ────────────────────────────────────────────────

    def _extract_secs_chunks(
        self, content: str, base_meta: dict
    ) -> List[Document]:
        chunks: List[Document] = []
        for fence_body in _SECS_FENCE_RE.findall(content):
            hdr  = self._parse_secs_header(fence_body)
            meta = SecsMessageMeta(
                stream           = hdr["stream"],
                function         = hdr["function"],
                message_id       = hdr["message_id"],
                name             = hdr["raw_name"],
                direction        = hdr["direction"],
                related_messages = hdr["related_messages"],
                section_path     = base_meta.get("section_path", ""),
                page             = base_meta.get("page", 0),
                file_name        = base_meta.get("file_name", ""),
            )
            chunks.append(Document(
                page_content=f"```secs\n{fence_body}\n```",
                metadata=meta.model_dump(),
            ))
        return chunks

    # ── Table-row entity extraction ────────────────────────────────────────────

    def _extract_table_entity_chunks(
        self, content: str, base_meta: dict
    ) -> List[Document]:
        chunks: List[Document] = []
        sp   = base_meta.get("section_path", "")
        page = base_meta.get("page", 0)
        fn   = base_meta.get("file_name", "")

        for m in _SEMI_TABLE_COMMENT_RE.finditer(content):
            ttype      = m.group(1)
            table_text = _slice_next_gfm_table(content, m.end())
            if not table_text:
                continue
            rows = _parse_gfm_table(table_text)
            if len(rows) < 2:
                continue

            header    = rows[0]
            data_rows = rows[1:]

            if ttype == "ceid":
                for row in data_rows:
                    doc = self._ceid_row(header, row, sp, page, fn, table_text)
                    if doc:
                        chunks.append(doc)

            elif ttype == "vid":
                for row in data_rows:
                    doc = self._vid_row(header, row, sp, page, fn, table_text)
                    if doc:
                        chunks.append(doc)

            elif ttype == "alid":
                for row in data_rows:
                    doc = self._alid_row(header, row, sp, page, fn, table_text)
                    if doc:
                        chunks.append(doc)

            elif ttype == "state":
                # State table → one chunk per table (state model), not per row
                doc = self._state_table(header, data_rows, sp, page, fn, table_text)
                if doc:
                    chunks.append(doc)

            elif ttype == "error":
                for row in data_rows:
                    doc = self._error_row(header, row, sp, page, fn, table_text)
                    if doc:
                        chunks.append(doc)

        return chunks

    # ── Row → Document builders ────────────────────────────────────────────────

    def _ceid_row(
        self,
        header: List[str],
        row: List[str],
        sp: str, page: int, fn: str,
        raw_table: str,
    ) -> Optional[Document]:
        r = _row_dict(header, row)
        ceid_val = r.get("ceid") or r.get("ceids") or r.get("collection event id") or r.get("collectioneventid")
        if not ceid_val:
            return None
        meta = EventDefinitionMeta(
            event_id       = ceid_val,
            event_name     = r.get("name") or r.get("event name") or r.get("eventname"),
            related_object = r.get("object") or r.get("related object"),
            section_path   = sp, page=page, file_name=fn,
        )
        text = _entity_text("CEID", ceid_val, meta.event_name, r)
        return Document(page_content=text, metadata=meta.model_dump())

    def _vid_row(
        self,
        header: List[str],
        row: List[str],
        sp: str, page: int, fn: str,
        raw_table: str,
    ) -> Optional[Document]:
        r = _row_dict(header, row)
        vid_val = (
            r.get("svid") or r.get("ecid") or r.get("dvvalid")
            or r.get("variable id") or r.get("variableid")
        )
        if not vid_val:
            return None
        meta = VariableDefinitionMeta(
            var_id      = vid_val,
            var_type    = _infer_var_type(r),
            var_name    = r.get("name") or r.get("variable name") or r.get("variablename"),
            data_format = r.get("format") or r.get("type") or r.get("dataformat"),
            section_path = sp, page=page, file_name=fn,
        )
        text = _entity_text("Variable", vid_val, meta.var_name, r)
        return Document(page_content=text, metadata=meta.model_dump())

    def _alid_row(
        self,
        header: List[str],
        row: List[str],
        sp: str, page: int, fn: str,
        raw_table: str,
    ) -> Optional[Document]:
        r = _row_dict(header, row)
        alid_val = r.get("alid") or r.get("alarm id") or r.get("alarmid")
        if not alid_val:
            return None
        meta = AlarmDefinitionMeta(
            alarm_id   = alid_val,
            alarm_name = r.get("name") or r.get("alarm name") or r.get("description"),
            category   = r.get("category") or r.get("type"),
            section_path = sp, page=page, file_name=fn,
        )
        text = _entity_text("Alarm", alid_val, meta.alarm_name, r)
        return Document(page_content=text, metadata=meta.model_dump())

    def _state_table(
        self,
        header: List[str],
        data_rows: List[List[str]],
        sp: str, page: int, fn: str,
        raw_table: str,
    ) -> Optional[Document]:
        # Extract unique state names from "From State" and "To State" columns
        from_idx = _col_index(header, ("from state", "fromstate", "from"))
        to_idx   = _col_index(header, ("to state",   "tostate",   "to"))
        states: List[str] = []
        for row in data_rows:
            if from_idx is not None and from_idx < len(row) and row[from_idx]:
                states.append(row[from_idx].strip())
            if to_idx is not None and to_idx < len(row) and row[to_idx]:
                states.append(row[to_idx].strip())
        unique_states = list(dict.fromkeys(s for s in states if s))

        meta = StateModelMeta(
            model_name   = _first_section(sp),
            states       = unique_states,
            transitions  = len(data_rows),
            section_path = sp, page=page, file_name=fn,
        )
        return Document(page_content=raw_table, metadata=meta.model_dump())

    def _error_row(
        self,
        header: List[str],
        row: List[str],
        sp: str, page: int, fn: str,
        raw_table: str,
    ) -> Optional[Document]:
        r = _row_dict(header, row)
        code_val = (
            r.get("error code") or r.get("errorcode")
            or r.get("ecode") or r.get("code")
        )
        if not code_val:
            return None
        meta = ErrorCodeMeta(
            code         = code_val,
            category     = r.get("category") or r.get("type"),
            description  = r.get("description") or r.get("meaning"),
            section_path = sp, page=page, file_name=fn,
        )
        text = _entity_text("Error", code_val, meta.description, r)
        return Document(page_content=text, metadata=meta.model_dump())

    # ── SECS header parser ─────────────────────────────────────────────────────

    @staticmethod
    def _parse_secs_header(text: str) -> Dict:
        info: Dict = {
            "stream": None, "function": None,
            "message_id": None, "direction": None,
            "raw_name": None, "related_messages": [],
        }
        m = _SECS_MSG_RE.search(text)
        if m:
            info["stream"]     = int(m.group(1))
            info["function"]   = int(m.group(2))
            info["message_id"] = f"S{m.group(1)}F{m.group(2)}"

        dir_m = _SECS_DIR_RE.search(text)
        if dir_m:
            raw = dir_m.group(0).lower()
            info["direction"] = (
                "host_to_eq"
                if ("host" in raw or raw.lstrip().startswith("h"))
                else "eq_to_host"
            )

        name_m = _SECS_NAME_RE.search(text)
        if name_m:
            info["raw_name"] = name_m.group(1)

        info["related_messages"] = list({
            f"S{rm.group(1)}F{rm.group(2)}"
            for rm in _SECS_MSG_RE.finditer(text)
        })
        return info


# ── Module-level helpers (pure functions, no state) ───────────────────────────

def _slice_next_gfm_table(content: str, start: int) -> str:
    """Return the first GFM table block (|…| lines) found after position start."""
    segment = content[start: start + 8000]
    lines: List[str] = []
    in_table = False
    for line in segment.splitlines():
        if line.startswith("|"):
            in_table = True
            lines.append(line)
        elif in_table:
            break
    return "\n".join(lines)


def _parse_gfm_table(text: str) -> List[List[str]]:
    """Parse a GFM table string into list-of-lists (skips separator rows)."""
    rows: List[List[str]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        if re.match(r"^\|[-| :]+\|$", line):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        rows.append(cells)
    return rows


def _row_dict(header: List[str], row: List[str]) -> Dict[str, str]:
    """Zip header and row into a dict with lowercase normalised keys."""
    padded = list(row) + [""] * max(0, len(header) - len(row))
    return {
        re.sub(r"[\s\-_#]", " ", h.lower()).strip(): (padded[i] or "").strip()
        for i, h in enumerate(header)
    }


def _col_index(header: List[str], candidates: Tuple[str, ...]) -> Optional[int]:
    """Return the index of the first header cell matching any candidate (normalised)."""
    for i, h in enumerate(header):
        norm = re.sub(r"[\s\-_#]", "", h.lower())
        if norm in candidates:
            return i
    return None


def _entity_text(label: str, id_val: str, name: Optional[str], row: Dict) -> str:
    """Build a short human-readable content string for an entity chunk."""
    parts = [f"{label} {id_val}"]
    if name:
        parts.append(f": {name}")
    desc = row.get("description") or row.get("meaning") or row.get("comments")
    if desc:
        parts.append(f"\n{desc}")
    return "".join(parts)


def _first_section(section_path: str) -> Optional[str]:
    """Extract the top-level section from a '>' separated path string."""
    if not section_path:
        return None
    return section_path.split(" > ")[0].strip() or None


def _infer_var_type(row: Dict) -> Optional[str]:
    keys = " ".join(row.keys())
    if "svid" in keys:
        return "SVID"
    if "ecid" in keys:
        return "ECID"
    if "dvval" in keys:
        return "DVVAL"
    return None

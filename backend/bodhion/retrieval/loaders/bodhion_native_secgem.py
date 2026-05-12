# =============================================================================
# Bodhion SecGEM PDF Loader — Specialized for SEMI/GEM/SECS Technical Documents
# =============================================================================
#
# Extends BodhionNativeLoader with domain intelligence for semiconductor
# automation standards: SEMI E87, E90, E40, E94, E116, E30/GEM.
#
# Extra capabilities vs bodhion_native.py:
#   - SECS message blocks (S#F# + <L[n]> / <U4[1]> structures)
#         → wrapped in fenced ```secs code blocks
#   - SEMI attribute table typing
#         → ObjType / AccessType / Description tables annotated
#   - State machine transition table detection
#         → From State / To State / Event tables annotated
#   - CEID / VID / ALID table typing
#         → chunk_anchor metadata injected for semantic RAG chunking
#   - Section hierarchy tracking (rolling across pages)
#         → section_path metadata on every Document
#   - Extended page classification
#         → secs_message | ceid_table | vid_table | alid_table |
#            state_table | attribute_table | error_table | cover | toc | content
#
# Phase 1 fixes applied:
#   Fix-A: _SECS_DATA_RE tightened — requires digit after type letter + closing >
#   Fix-B: _continues_secs_block — requires confirmed SECS token, not just < or {
#   Fix-C: _parse_secs_header — extracts stream/function/direction/name into block
#   Fix-D: _update_section_path — also scans "text" blocks for section numbers
#   Fix-E: _VID_HEADERS / _ATTR_HEADERS — removed short/ambiguous tokens
#
# Installation requirements: same as bodhion_native.py
#   pip install pymupdf pdfplumber
#   (pytesseract optional, for OCR on raster images)
#
# Engine key:    "bodhion-secgem-extractor"
# Config prefix: BODHION_SECGEM_*
# =============================================================================

import re
import logging
from typing import Dict, List, Optional, Set, Tuple

from langchain_core.documents import Document

from bodhion.retrieval.loaders.bodhion_native import BodhionNativeLoader

log = logging.getLogger(__name__)


class BodhionSecGemLoader(BodhionNativeLoader):
    """
    SEMI/GEM/SECS-aware PDF extractor — extends BodhionNativeLoader with
    domain-specific intelligence for semiconductor automation standards.

    Returns one Document per page, preserving reading order, with enriched
    metadata including section_path, semi_table_types, has_secs_blocks,
    chunk_anchor, secs_messages, and page_type (SEMI-specific categories).
    """

    # ── SECS pattern matchers ─────────────────────────────────────────────────

    # Message identifier: S3F17, S14F1, S16F27 …
    _SECS_MSG_RE = re.compile(r"\bS(\d{1,2})F(\d{1,3})\b")

    # Fix-A: data item notation — requires ≥1 digit after type letter + closing >.
    # Valid:   <U4[1]>, <L [3]>, <A 40>, <I1>, <F8>
    # Rejected: <U>, <B>, <I>, <A>  (bare HTML tags)
    _SECS_DATA_RE = re.compile(r"<[UIABLFTR]\d+(?:\s*\[\d*\])?(?:\s+[^<>]*)?>")

    # Direction arrows in SECS message headers
    _SECS_DIR_RE = re.compile(
        r"(host\s*[-→>]+\s*eq|eq\s*[-→>]+\s*host"
        r"|h\s*[-→>]+\s*e|e\s*[-→>]+\s*h)",
        re.IGNORECASE,
    )

    # Message name: TitleCase word(s) immediately after S#F#
    _SECS_NAME_RE = re.compile(r"\bS\d{1,2}F\d{1,3}\s+([A-Z][A-Za-z][A-Za-z0-9]+)")

    # ── Section number matchers ───────────────────────────────────────────────

    # Numeric: "7.1.2 Something"
    _SECTION_NUM_RE = re.compile(r"^(\d+(?:\.\d+){0,4})\s+\S")

    # Appendix: "A.1", "B.2.3" …
    _APPENDIX_NUM_RE = re.compile(r"^([A-Z](?:\.\d+)+)\s+\S")

    # ── SEMI table header keyword sets (normalised: lowercase, no spaces/hyphens) ─

    _CEID_HEADERS  = frozenset({"ceid", "ceids", "collectioneventid", "collectionevent"})
    # Fix-E: removed bare "vid" (3 chars, too ambiguous); kept strong SEMI-specific IDs
    _VID_HEADERS   = frozenset({"svid", "ecid", "dvvalid", "variableid", "ecname"})
    _ALID_HEADERS  = frozenset({"alid", "alarmid"})
    _STATE_HEADERS = frozenset({"transition", "trans#", "fromstate", "tostate", "eventname"})
    # Fix-E: removed "format" and "access" (too common); kept ObjType-specific tokens
    _ATTR_HEADERS  = frozenset({"objtype", "attributename", "accesstype", "objid"})
    _ERROR_HEADERS = frozenset({"errorcode", "ecode", "errcode", "rptid", "reportid"})

    # ─────────────────────────────────────────────────────────────────────────

    def __init__(
        self,
        file_path: str,
        extract_images: bool = True,
        ocr_images: bool = True,
        extract_tables: bool = True,
        image_min_width: int = 50,
        image_min_height: int = 50,
        detect_secs_blocks: bool = True,
        annotate_semi_tables: bool = True,
        preserve_section_context: bool = True,
    ):
        super().__init__(
            file_path=file_path,
            extract_images=extract_images,
            ocr_images=ocr_images,
            extract_tables=extract_tables,
            image_min_width=image_min_width,
            image_min_height=image_min_height,
        )
        self.detect_secs_blocks       = detect_secs_blocks
        self.annotate_semi_tables     = annotate_semi_tables
        self.preserve_section_context = preserve_section_context

        # Rolling section path updated page-by-page: [(section_num, full_heading), …]
        self._section_path: List[Tuple[str, str]] = []

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    def load(self) -> List[Document]:
        """Parse PDF and return one Document per page with SEMI-aware metadata."""
        try:
            import fitz
            import pdfplumber
        except ImportError as exc:
            raise ImportError(
                "bodhion-secgem-extractor requires pymupdf and pdfplumber. "
                "Install with: pip install pymupdf pdfplumber"
            ) from exc

        documents: List[Document] = []

        try:
            fitz_doc = fitz.open(self.file_path)
            repeating_texts = self._find_repeating_margins(fitz_doc)
            with pdfplumber.open(self.file_path) as plumber_doc:
                total_pages = len(fitz_doc)
                for page_num in range(total_pages):
                    fitz_page    = fitz_doc[page_num]
                    plumber_page = (
                        plumber_doc.pages[page_num]
                        if page_num < len(plumber_doc.pages)
                        else None
                    )
                    try:
                        doc = self._process_page_secgem(
                            fitz_page, fitz_doc, plumber_page,
                            page_num, total_pages, repeating_texts,
                        )
                    except Exception as page_exc:
                        log.warning(
                            f"bodhion-secgem-extractor: page {page_num + 1} of "
                            f"{self.file_name} failed: {page_exc}"
                        )
                        doc = Document(
                            page_content=(
                                f"[Page {page_num + 1} could not be extracted: {page_exc}]"
                            ),
                            metadata={
                                "page":              page_num,
                                "page_label":        page_num + 1,
                                "total_pages":       total_pages,
                                "file_name":         self.file_name,
                                "processing_engine": "bodhion-secgem-extractor",
                                "extraction_error":  str(page_exc),
                            },
                        )
                    documents.append(doc)
            fitz_doc.close()
        except Exception as exc:
            log.exception(
                f"bodhion-secgem-extractor: failed to parse {self.file_name}: {exc}"
            )
            raise

        if self._write_output:
            self._write_extraction_output(documents)

        return documents

    # ─────────────────────────────────────────────────────────────────────────
    # Per-page orchestrator
    # ─────────────────────────────────────────────────────────────────────────

    def _process_page_secgem(
        self,
        fitz_page,
        fitz_doc,
        plumber_page,
        page_num: int,
        total_pages: int,
        repeating_texts: Set[str],
    ) -> Document:
        # ── 1. Base extraction (inherited) ────────────────────────────────────
        text_blocks  = self._extract_text_blocks(fitz_page)
        table_blocks = (
            self._extract_tables_with_rows(plumber_page)
            if self.extract_tables and plumber_page
            else []
        )
        image_blocks = (
            self._extract_images(fitz_page, fitz_doc, page_num)
            if self.extract_images
            else []
        )

        # Drop running headers / footers
        if repeating_texts:
            text_blocks = [b for b in text_blocks if b["text"] not in repeating_texts]

        # Remove text that spatially overlaps with a detected table
        if table_blocks:
            text_blocks = self._remove_overlapping_text(text_blocks, table_blocks)

        # ── 2. SEMI-specific enrichment ───────────────────────────────────────
        if self.detect_secs_blocks:
            text_blocks = self._reclassify_secs_blocks(text_blocks)

        if self.annotate_semi_tables:
            for tb in table_blocks:
                tb["semi_table_type"] = self._classify_semi_table(
                    tb.get("raw_rows", [])
                )

        # Fix-D: section path scans both heading and text blocks
        if self.preserve_section_context:
            self._update_section_path(text_blocks)

        # ── 3. Markdown rendering ─────────────────────────────────────────────
        markdown = self._reconstruct_markdown_secgem(text_blocks, table_blocks, image_blocks)

        # ── 4. Metadata assembly ──────────────────────────────────────────────
        semi_table_types = list({
            tb.get("semi_table_type", "generic")
            for tb in table_blocks
            if tb.get("semi_table_type", "generic") != "generic"
        })
        has_secs = any(b.get("block_type") == "secs_block" for b in text_blocks)

        # Collect per-message headers for downstream entity splitter (Fix-C)
        secs_messages = [
            b["secs_header"]
            for b in text_blocks
            if b.get("block_type") == "secs_block" and b.get("secs_header")
        ]

        # First CEID/VID/ALID table on this page becomes the chunk anchor
        chunk_anchor = ""
        for tb in table_blocks:
            ttype = tb.get("semi_table_type", "generic")
            if ttype in ("ceid", "vid", "alid"):
                chunk_anchor = ttype
                break

        metadata = {
            "page":              page_num,
            "page_label":        page_num + 1,
            "total_pages":       total_pages,
            "file_name":         self.file_name,
            "processing_engine": "bodhion-secgem-extractor",
            "has_tables":        bool(table_blocks),
            "has_images":        bool(image_blocks),
            "has_secs_blocks":   has_secs,
            "secs_messages":     secs_messages,
            "semi_table_types":  semi_table_types,
            "section_path":      self._format_section_path(),
            "chunk_anchor":      chunk_anchor,
        }

        page_type = self._classify_page_secgem(markdown, metadata)
        metadata["page_type"] = page_type
        log.debug(
            f"bodhion-secgem-extractor: page {page_num + 1} → '{page_type}', "
            f"secs={len(secs_messages)}, section={metadata['section_path']!r}"
        )

        return Document(page_content=markdown or "[Empty page]", metadata=metadata)

    # ─────────────────────────────────────────────────────────────────────────
    # Table extraction (override stores raw_rows for SEMI classification)
    # ─────────────────────────────────────────────────────────────────────────

    def _extract_tables_with_rows(self, plumber_page) -> List[dict]:
        """
        Like the parent _extract_tables() but stores raw_rows in each block
        so that _classify_semi_table() can inspect headers without re-parsing.
        """
        if plumber_page is None:
            return []
        try:
            tables = plumber_page.find_tables()
            if not tables:
                try:
                    tables = plumber_page.find_tables(
                        table_settings={
                            "vertical_strategy": "text",
                            "horizontal_strategy": "text",
                        }
                    )
                except Exception:
                    tables = []
            if not tables:
                return []

            result = []
            for table in tables:
                try:
                    rows = table.extract()
                    if not rows:
                        continue
                    if not self._is_real_table(rows):
                        continue

                    bbox = table.bbox
                    populated_cells = sum(
                        1 for row in rows for cell in row
                        if cell and str(cell).strip()
                    )
                    if populated_cells < 6:
                        continue

                    if self._is_prose_table(rows):
                        prose_text = self._collapse_prose_table(rows)
                        result.append({
                            "bbox":       bbox,
                            "text":       prose_text,
                            "block_type": "text",
                        })
                        continue

                    md = self._rows_to_markdown(rows)
                    if not md:
                        continue

                    result.append({
                        "bbox":       bbox,
                        "text":       md,
                        "block_type": "table",
                        "raw_rows":   rows,
                    })
                except Exception as exc:
                    log.warning(
                        f"bodhion-secgem-extractor: skipping malformed table: {exc}"
                    )
                    continue

            return result

        except Exception as exc:
            log.warning(
                f"bodhion-secgem-extractor: pdfplumber table extraction failed: {exc}"
            )
            return []

    # ─────────────────────────────────────────────────────────────────────────
    # SECS message block detection
    # ─────────────────────────────────────────────────────────────────────────

    def _reclassify_secs_blocks(self, text_blocks: List[dict]) -> List[dict]:
        """
        Walk text blocks and reclassify as 'secs_block' any block that contains
        SECS message patterns (S#F# identifier and/or ≥2 confirmed data items).

        Adjacent blocks that continue the SECS structure are merged so the
        fenced code block is contiguous in Markdown output.

        Fix-C: parsed stream/function/direction/name stored in secs_header.
        """
        result: List[dict] = []
        i = 0
        while i < len(text_blocks):
            block = text_blocks[i]
            text  = block.get("text", "")

            if self._is_secs_block_text(text):
                merged_text = text
                j = i + 1
                while j < len(text_blocks):
                    next_text = text_blocks[j].get("text", "")
                    if self._continues_secs_block(next_text):
                        merged_text += "\n" + next_text
                        j += 1
                    else:
                        break

                result.append({
                    "bbox":        block["bbox"],
                    "text":        merged_text,
                    "block_type":  "secs_block",
                    "secs_header": self._parse_secs_header(merged_text),  # Fix-C
                })
                i = j
            else:
                result.append(block)
                i += 1

        return result

    def _is_secs_block_text(self, text: str) -> bool:
        """
        Return True if the text looks like a SECS message definition.
        Signals: an S#F# token, OR ≥ 2 confirmed SECS data item tokens.
        """
        if self._SECS_MSG_RE.search(text):
            return True
        return len(self._SECS_DATA_RE.findall(text)) >= 2

    def _continues_secs_block(self, text: str) -> bool:
        """
        Fix-B: require at least one confirmed SECS data item token before
        absorbing. Bare < / { / } / [ alone are not enough — they appear in
        bullet lists, JSON blocks, and HTML fragments.
        """
        stripped = text.strip()
        # Must contain a proper SECS typed data item
        if self._SECS_DATA_RE.search(stripped):
            return True
        # SECS field-label lines (max 12 chars before delimiter to avoid prose)
        if re.match(r"^[A-Z][A-Z0-9]{1,11}\s*[:=]\s*\S", stripped):
            return True
        # Closing braces of a nested structure — only when short (structural, not prose)
        if stripped in ("{", "}") or (stripped.startswith(("{", "}")) and len(stripped) < 8):
            return True
        return False

    # Fix-C ───────────────────────────────────────────────────────────────────

    def _parse_secs_header(self, text: str) -> Dict:
        """
        Extract structured metadata from a confirmed SECS block text:
          stream, function, message_id, direction, raw_name, related_messages.
        All fields are best-effort; missing values are None / [].
        """
        info: Dict = {
            "stream":           None,
            "function":         None,
            "message_id":       None,
            "direction":        None,
            "raw_name":         None,
            "related_messages": [],
        }

        m = self._SECS_MSG_RE.search(text)
        if m:
            info["stream"]     = int(m.group(1))
            info["function"]   = int(m.group(2))
            info["message_id"] = f"S{m.group(1)}F{m.group(2)}"

        dir_m = self._SECS_DIR_RE.search(text)
        if dir_m:
            raw = dir_m.group(0).lower()
            info["direction"] = (
                "host_to_eq" if ("host" in raw or raw.lstrip().startswith("h"))
                else "eq_to_host"
            )

        name_m = self._SECS_NAME_RE.search(text)
        if name_m:
            info["raw_name"] = name_m.group(1)

        # Collect all S#F# references in the block as related messages
        info["related_messages"] = list({
            f"S{rm.group(1)}F{rm.group(2)}"
            for rm in self._SECS_MSG_RE.finditer(text)
        })

        return info

    # ─────────────────────────────────────────────────────────────────────────
    # SEMI table type classification
    # ─────────────────────────────────────────────────────────────────────────

    def _classify_semi_table(self, rows: List[List[Optional[str]]]) -> str:
        """
        Inspect the header row (rows[0]) to classify the SEMI data table type.

        Returns one of:
          'ceid' | 'vid' | 'alid' | 'state' | 'attribute' | 'error' | 'generic'

        Fix-E: short/ambiguous tokens removed from _VID_HEADERS / _ATTR_HEADERS.
        """
        if not rows:
            return "generic"

        # Normalise: lowercase, strip spaces, hyphens, underscores, #
        norm = {
            re.sub(r"[\s\-_#]", "", (cell or "").lower())
            for cell in rows[0]
            if cell
        }

        if norm & self._CEID_HEADERS:
            return "ceid"
        if norm & self._VID_HEADERS:
            return "vid"
        if norm & self._ALID_HEADERS:
            return "alid"
        if norm & self._STATE_HEADERS:
            return "state"
        if norm & self._ATTR_HEADERS:
            return "attribute"
        if norm & self._ERROR_HEADERS:
            return "error"
        return "generic"

    # ─────────────────────────────────────────────────────────────────────────
    # Section hierarchy tracking
    # ─────────────────────────────────────────────────────────────────────────

    def _update_section_path(self, text_blocks: List[dict]) -> None:
        """
        Fix-D: scan both 'heading' AND 'text' blocks for section numbers.

        The parent loader only classifies bold+large-font blocks as headings.
        SEMI standards section numbers often appear in regular-weight text at
        body size (especially numbered sub-sections like 7.1.2). Scanning text
        blocks for the section-number pattern catches these cases.
        """
        for block in text_blocks:
            btype = block.get("block_type", "text")
            if btype not in ("heading", "text"):
                continue
            text = block.get("text", "").strip()
            m = self._SECTION_NUM_RE.match(text) or self._APPENDIX_NUM_RE.match(text)
            if not m:
                continue
            sec_num = m.group(1)
            depth   = sec_num.count(".") + 1
            self._section_path = self._section_path[: depth - 1]
            self._section_path.append((sec_num, text))

    def _format_section_path(self) -> str:
        """Return human-readable section path string for Document metadata."""
        if not self._section_path:
            return ""
        parts = []
        for sec_num, heading in self._section_path:
            title = heading.split(None, 1)[1] if " " in heading else heading
            parts.append(f"{sec_num} {title}")
        return " > ".join(parts)

    # ─────────────────────────────────────────────────────────────────────────
    # Markdown reconstruction (SEMI-aware)
    # ─────────────────────────────────────────────────────────────────────────

    def _reconstruct_markdown_secgem(
        self,
        text_blocks: List[dict],
        table_blocks: List[dict],
        image_blocks: List[dict],
    ) -> str:
        """
        Merge all blocks by Y-coordinate and render to Markdown.

        Rendering rules:
          heading           → #/##/### depth derived from section number
          secs_block        → fenced ```secs code block
          code              → fenced ``` code block
          table (SEMI type) → <!-- semi-table: <type> --> then GFM table
          image_ocr         → > [OCR Image] blockquote
          image_placeholder → italic caption
          text              → plain paragraph
        """
        all_blocks = text_blocks + table_blocks + image_blocks

        def sort_key(block: dict) -> float:
            bbox = block.get("bbox", (0, 0, 0, 0))
            try:
                return float(bbox[1])
            except (TypeError, IndexError):
                return 0.0

        all_blocks.sort(key=sort_key)

        parts: List[str] = []
        for block in all_blocks:
            btype = block.get("block_type", "text")
            text  = block.get("text", "").strip()
            if not text:
                continue

            if btype == "heading":
                depth  = self._heading_depth(text)
                prefix = "#" * depth
                parts.append(f"{prefix} {text}")

            elif btype == "secs_block":
                parts.append(f"```secs\n{text}\n```")

            elif btype == "code":
                parts.append(f"```\n{text}\n```")

            elif btype == "table":
                ttype = block.get("semi_table_type", "generic")
                if ttype != "generic":
                    parts.append(f"<!-- semi-table: {ttype} -->")
                parts.append(text)

            elif btype == "image_ocr":
                parts.append(f"> **[OCR Image]**\n> {text}")

            elif btype == "image_placeholder":
                parts.append(f"*{text}*")

            else:
                parts.append(text)

        return "\n\n".join(parts)

    def _heading_depth(self, text: str) -> int:
        """
        Derive heading level from the section number prefix.
          "7"     → 1   (top-level section)
          "7.1"   → 2
          "7.1.2" → 3   (capped at 6)
          no number → 2 (fallback)
        """
        m = self._SECTION_NUM_RE.match(text) or self._APPENDIX_NUM_RE.match(text)
        if m:
            return min(m.group(1).count(".") + 1, 6)
        return 2

    # ─────────────────────────────────────────────────────────────────────────
    # Extended page classification
    # ─────────────────────────────────────────────────────────────────────────

    def _classify_page_secgem(self, markdown: str, metadata: dict) -> str:
        """
        Return a SEMI-aware page type label, checked before the parent fallback:
          secs_message | ceid_table | vid_table | alid_table |
          state_table  | attribute_table | error_table |
          cover | toc | doc_metadata | content
        """
        semi_types = set(metadata.get("semi_table_types", []))
        has_secs   = metadata.get("has_secs_blocks", False)

        if has_secs:
            return "secs_message"
        if "ceid" in semi_types:
            return "ceid_table"
        if "vid" in semi_types:
            return "vid_table"
        if "alid" in semi_types:
            return "alid_table"
        if "state" in semi_types:
            return "state_table"
        if "attribute" in semi_types:
            return "attribute_table"
        if "error" in semi_types:
            return "error_table"

        # Fall back to parent rules (cover / toc / doc_metadata / content)
        return self._classify_page(markdown, metadata)

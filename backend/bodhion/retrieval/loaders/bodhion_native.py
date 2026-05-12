# =============================================================================
# Bodhion Native PDF Loader — Tesseract OCR Installation Guide
# =============================================================================
#
# This loader uses Tesseract for OCR on raster images embedded in PDFs.
# Tesseract must be installed as a system binary BEFORE running this loader.
#
# ── Step 1: Install the Tesseract binary ─────────────────────────────────────
#
#   Ubuntu 22.04 / 24.04 (ships Tesseract 4.x):
#       apt-get update && apt-get install -y tesseract-ocr
#
#   Ubuntu 20.04 (optional upgrade to 5.x via PPA):
#       apt-get install -y tesseract-ocr
#       add-apt-repository ppa:alex-p/tesseract-ocr5
#       apt-get update && apt-get install -y tesseract-ocr
#
#   macOS:
#       brew install tesseract          # installs 5.x
#
#   Windows:
#       1. Download the 5.x installer from:
#          https://github.com/UB-Mannheim/tesseract/wiki
#          (e.g. tesseract-ocr-w64-setup-5.x.x.exe)
#       2. Run the installer.
#       3. Add the install directory to your system PATH:
#          C:\Program Files\Tesseract-OCR
#
#   Docker / Dockerfile (recommended for production):
#       RUN apt-get update && apt-get install -y \
#               tesseract-ocr \
#               tesseract-ocr-eng \
#           && rm -rf /var/lib/apt/lists/*
#
# ── Step 2: Verify installation ───────────────────────────────────────────────
#
#       tesseract --version
#   Expected output:  tesseract 5.x.x  (or 4.x.x on older distros)
#
# ── Step 3: Install the Python binding ───────────────────────────────────────
#
#       pip install pytesseract
#   (already listed in backend/requirements.txt)
#
# ── Step 4: (Optional) Add extra language packs ──────────────────────────────
#
#   By default only English (eng) is included. To add more languages:
#
#       apt-get install -y tesseract-ocr-hin tesseract-ocr-fra tesseract-ocr-deu
#
#   Then update the _ocr_image_bytes() call in this file:
#       pytesseract.image_to_string(image, lang='eng+fra')
#
# =============================================================================

import os
import re
import pathlib
import datetime
import logging
from typing import List, Optional, Set

from langchain_core.documents import Document

log = logging.getLogger(__name__)


class BodhionNativeLoader:
    """
    Bodhion Native PDF Extractor.

    A fully local, zero-API-dependency PDF loader that properly handles:
      - Complex tables  → converted to GitHub-Flavored Markdown tables (pdfplumber)
      - Raster images   → OCR'd with Tesseract and embedded as quoted text (pytesseract)
      - Code blocks     → detected by monospace font, wrapped in fenced ``` blocks (pymupdf)
      - Headings        → detected by bold + large font size, rendered as ## headings
      - Body text       → plain paragraphs

    Returns one Document per page, preserving reading order via Y-coordinate sort.
    """

    # Font name substrings that indicate monospace / code fonts
    _CODE_FONT_HINTS = (
        "courier",
        "consolas",
        "monaco",
        "monospace",
        "inconsolata",
        "sourcecodepro",
        "dejavumono",
        "liberationmono",
        "robotomono",
        "firacode",
        "ubuntumono",
        "code",
        "mono",
        "fixed",
    )

    def __init__(
        self,
        file_path: str,
        extract_images: bool = True,
        ocr_images: bool = True,
        extract_tables: bool = True,
        image_min_width: int = 50,
        image_min_height: int = 50,
    ):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        self.file_path = file_path
        self.file_name = os.path.basename(file_path)
        self.extract_images = extract_images
        self.ocr_images = ocr_images
        self.extract_tables = extract_tables
        self.image_min_width = image_min_width
        self.image_min_height = image_min_height

        # Check pytesseract availability once at construction time
        self._tesseract_available = False
        if self.ocr_images and self.extract_images:
            try:
                import pytesseract  # noqa: F401
                self._tesseract_available = True
            except ImportError:
                log.warning(
                    "pytesseract is not installed. OCR on images will be disabled. "
                    "Install with: pip install pytesseract  (also requires Tesseract binary)"
                )

        # Env flag: set BODHION_EXTRACTOR_WRITE_OUTPUT=true to dump extracted Markdown to disk
        _flag = os.environ.get("BODHION_EXTRACTOR_WRITE_OUTPUT", "").strip().lower()
        self._write_output: bool = _flag in ("1", "true", "yes")

        # Set by _write_extraction_output(); used by write_postprocessed_output()
        self._last_output_dir: Optional[pathlib.Path] = None

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    def load(self) -> List[Document]:
        """
        Parse the PDF and return one Document per page.
        Falls back to an error Document if the file cannot be parsed at all.
        """
        try:
            import fitz  # pymupdf
            import pdfplumber
        except ImportError as exc:
            raise ImportError(
                "bodhion-native-extractor requires pymupdf and pdfplumber. "
                "Install with: pip install pymupdf pdfplumber"
            ) from exc

        documents: List[Document] = []

        try:
            fitz_doc = fitz.open(self.file_path)
            repeating_texts = self._find_repeating_margins(fitz_doc)
            with pdfplumber.open(self.file_path) as plumber_doc:
                total_pages = len(fitz_doc)
                for page_num in range(total_pages):
                    fitz_page = fitz_doc[page_num]
                    plumber_page = plumber_doc.pages[page_num] if page_num < len(plumber_doc.pages) else None
                    try:
                        doc = self._process_page(
                            fitz_page, fitz_doc, plumber_page, page_num, total_pages, repeating_texts
                        )
                    except Exception as page_exc:
                        log.warning(
                            f"bodhion-native-extractor: page {page_num + 1} of {self.file_name} "
                            f"failed, substituting error placeholder: {page_exc}"
                        )
                        doc = Document(
                            page_content=f"[Page {page_num + 1} could not be extracted: {page_exc}]",
                            metadata={
                                "page": page_num,
                                "page_label": page_num + 1,
                                "total_pages": total_pages,
                                "file_name": self.file_name,
                                "processing_engine": "bodhion-native-extractor",
                                "extraction_error": str(page_exc),
                            },
                        )
                    documents.append(doc)
            fitz_doc.close()
        except Exception as exc:
            log.exception(f"bodhion-native-extractor: failed to parse {self.file_name}: {exc}")
            raise

        if self._write_output:
            self._write_extraction_output(documents)

        return documents

    # ─────────────────────────────────────────────────────────────────────────
    # Per-page orchestrator
    # ─────────────────────────────────────────────────────────────────────────

    def _process_page(
        self,
        fitz_page,
        fitz_doc,
        plumber_page,
        page_num: int,
        total_pages: int,
        repeating_texts: Set[str],
    ) -> Document:
        text_blocks = self._extract_text_blocks(fitz_page)
        table_blocks = self._extract_tables(plumber_page) if self.extract_tables and plumber_page else []
        image_blocks = self._extract_images(fitz_page, fitz_doc, page_num) if self.extract_images else []

        # Drop header/footer blocks whose text repeats across most pages (Q7)
        if repeating_texts:
            text_blocks = [b for b in text_blocks if b["text"] not in repeating_texts]

        # Remove text that spatially overlaps with a detected table bbox
        # to avoid duplication (pdfplumber and fitz both read the same cells)
        if table_blocks:
            text_blocks = self._remove_overlapping_text(text_blocks, table_blocks)

        markdown = self._reconstruct_markdown(text_blocks, table_blocks, image_blocks)

        metadata = {
            "page": page_num,
            "page_label": page_num + 1,
            "total_pages": total_pages,
            "file_name": self.file_name,
            "processing_engine": "bodhion-native-extractor",
            "has_tables": bool(table_blocks),
            "has_images": bool(image_blocks),
        }

        page_type = self._classify_page(markdown, metadata)
        metadata["page_type"] = page_type
        log.debug(
            f"bodhion-native-extractor: page {page_num + 1} classified as '{page_type}'"
        )

        return Document(page_content=markdown or "[Empty page]", metadata=metadata)

    # ─────────────────────────────────────────────────────────────────────────
    # Text extraction
    # ─────────────────────────────────────────────────────────────────────────

    def _extract_text_blocks(self, fitz_page) -> List[dict]:
        """
        Use pymupdf get_text("dict") to extract text with full font metadata.
        Returns list of dicts: {bbox, text, block_type}
        block_type: "heading" | "code" | "text"
        """
        raw = fitz_page.get_text("dict")
        blocks_raw = raw.get("blocks", [])

        # Collect all font sizes to compute body average (for heading detection)
        all_sizes = []
        for block in blocks_raw:
            if block.get("type") != 0:  # 0 = text block
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    sz = span.get("size", 0)
                    if sz > 0:
                        all_sizes.append(sz)

        body_avg = (sum(all_sizes) / len(all_sizes)) if all_sizes else 12.0

        result = []
        for block in blocks_raw:
            if block.get("type") != 0:
                continue

            bbox = block.get("bbox", (0, 0, 0, 0))
            lines_text = []
            dominant_type = "text"

            for line in block.get("lines", []):
                line_parts = []
                for span in line.get("spans", []):
                    span_text = span.get("text", "").strip()
                    if not span_text:
                        continue

                    font_name = (span.get("font") or "").lower()
                    font_size = span.get("size", 0)
                    flags = span.get("flags", 0)
                    is_bold = bool(flags & 2**4)  # bit 4 = bold in pymupdf

                    # Classify span
                    if self._is_code_font(font_name):
                        dominant_type = "code"
                    elif is_bold and font_size > body_avg * 1.2 and dominant_type != "code":
                        dominant_type = "heading"

                    line_parts.append(span_text)

                if line_parts:
                    lines_text.append(" ".join(line_parts))

            full_text = "\n".join(lines_text).strip()
            if not full_text:
                continue

            # Repair hyphenated line-breaks: "impor-\ntant" → "important" (Q5)
            full_text = re.sub(r"(\w)-\n(\w)", r"\1\2", full_text)

            result.append({
                "bbox": bbox,
                "text": full_text,
                "block_type": dominant_type,
            })

        return result

    def _is_code_font(self, font_name: str) -> bool:
        """Return True if the font name suggests a monospace / code font."""
        fn = font_name.lower().replace("-", "").replace(" ", "").replace("_", "")
        return any(hint in fn for hint in self._CODE_FONT_HINTS)

    # ─────────────────────────────────────────────────────────────────────────
    # Table extraction
    # ─────────────────────────────────────────────────────────────────────────

    def _extract_tables(self, plumber_page) -> List[dict]:
        """
        Use pdfplumber to detect tables and convert them to GFM Markdown.
        Returns list of dicts: {bbox, text, block_type: "table"}
        """
        try:
            tables = plumber_page.find_tables()
            # Fallback for borderless tables: only use text strategy when the primary
            # line-based detection finds nothing. We then require >= 2 populated columns
            # to reject false positives (aligned bullet lists look like 2-col tables to
            # pdfplumber's text strategy — sections 3.0–3.4 in policy-style PDFs).
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
                        log.debug(
                            "bodhion-native-extractor: skipping degenerate table "
                            f"(fewer than 2 populated columns) at bbox {table.bbox}"
                        )
                        continue

                    # pdfplumber bbox is (x0, top, x1, bottom)
                    bbox = table.bbox

                    # Guard: skip near-empty borderless detections (single-row false positives)
                    populated_cells = sum(
                        1 for row in rows for cell in row if cell and str(cell).strip()
                    )
                    if populated_cells < 6:
                        log.debug(
                            f"bodhion-native-extractor: skipping sparse table "
                            f"({populated_cells} populated cells) at bbox {bbox}"
                        )
                        continue

                    # Prose table: 2-col layout that is actually flowing paragraph text
                    if self._is_prose_table(rows):
                        prose_text = self._collapse_prose_table(rows)
                        log.debug(
                            f"bodhion-native-extractor: collapsing prose table "
                            f"({len(rows)} rows) at bbox {bbox}"
                        )
                        result.append({
                            "bbox": bbox,
                            "text": prose_text,
                            "block_type": "text",
                        })
                        continue

                    md = self._rows_to_markdown(rows)
                    if not md:
                        continue

                    result.append({
                        "bbox": bbox,
                        "text": md,
                        "block_type": "table",
                    })
                except Exception as exc:
                    log.warning(f"bodhion-native-extractor: skipping malformed table: {exc}")
                    continue

            return result

        except Exception as exc:
            log.warning(f"bodhion-native-extractor: pdfplumber table extraction failed: {exc}")
            return []

    def _is_real_table(self, rows: List[List[Optional[str]]]) -> bool:
        """
        Return True only if the extracted rows look like a genuine table.

        A genuine table has at least 2 rows (header + 1 data row) AND at least 2
        columns that each contain non-empty values somewhere in the table.  Bullet
        lists detected by pdfplumber's text strategy produce either a single populated
        column or very sparse secondary columns — those are rejected here.
        """
        if not rows or len(rows) < 2:
            return False
        col_count = max(len(row) for row in rows)
        populated_cols = sum(
            1
            for col_idx in range(col_count)
            if any(
                rows[row_idx][col_idx]
                for row_idx in range(len(rows))
                if col_idx < len(rows[row_idx])
            )
        )
        return populated_cols >= 2

    def _measure_prose_density(self, rows: List[List[Optional[str]]]) -> float:
        """
        Fraction of rows where the cell boundary looks like flowing prose:
          - col2 starts with a lowercase letter, OR
          - col1 ends without terminal punctuation AND col2 is non-empty
        """
        if not rows:
            return 0.0
        continuation_count = 0
        for row in rows:
            col1 = (row[0] or "").strip() if len(row) > 0 else ""
            col2 = (row[1] or "").strip() if len(row) > 1 else ""
            if not col2:
                continue
            col2_lower = col2[0].islower() if col2 else False
            col1_no_punct = bool(col1) and col1[-1] not in (".", "?", "!", ":")
            if col2_lower or col1_no_punct:
                continuation_count += 1
        return continuation_count / len(rows)

    def _is_prose_table(self, rows: List[List[Optional[str]]]) -> bool:
        """
        Return True when a 2-column table is actually flowing prose shredded into
        cells by pdfplumber's borderless-table fallback.

        Conditions (all must hold):
          1. Exactly 2 populated columns
          2. ≥ 4 rows (short 2-col tables like rate tables are genuine)
          3. ≥ 60% of rows have continuation-style cell boundaries
        """
        if not rows or len(rows) < 4:
            return False
        col_count = max(len(row) for row in rows)
        populated_cols = sum(
            1
            for col_idx in range(col_count)
            if any(
                (rows[row_idx][col_idx] or "").strip()
                for row_idx in range(len(rows))
                if col_idx < len(rows[row_idx])
            )
        )
        if populated_cols != 2:
            return False
        return self._measure_prose_density(rows) >= 0.60

    def _collapse_prose_table(self, rows: List[List[Optional[str]]]) -> str:
        """
        Reconstruct flowing paragraph text from a 2-column prose table.
        Each row's cells are joined with a space; all rows joined with a space.
        """
        parts = []
        for row in rows:
            col1 = (row[0] or "").strip() if len(row) > 0 else ""
            col2 = (row[1] or "").strip() if len(row) > 1 else ""
            joined = (col1 + " " + col2).strip()
            if joined:
                parts.append(joined)
        return " ".join(parts)

    def _rows_to_markdown(self, rows: List[List[Optional[str]]]) -> str:
        """Convert a 2-D list of cell strings to a GFM Markdown table."""
        if not rows:
            return ""

        def clean(cell) -> str:
            if cell is None:
                return ""
            return str(cell).replace("\n", " ").replace("|", "\\|").strip()

        header = rows[0]
        md_rows = []

        # Header row
        md_rows.append("| " + " | ".join(clean(c) for c in header) + " |")
        # Separator
        md_rows.append("| " + " | ".join("---" for _ in header) + " |")
        # Data rows
        for row in rows[1:]:
            # Pad or trim row to match header width
            padded = list(row) + [""] * max(0, len(header) - len(row))
            md_rows.append("| " + " | ".join(clean(c) for c in padded[: len(header)]) + " |")

        return "\n".join(md_rows)

    # ─────────────────────────────────────────────────────────────────────────
    # Image extraction + OCR
    # ─────────────────────────────────────────────────────────────────────────

    def _extract_images(self, fitz_page, fitz_doc, page_num: int) -> List[dict]:
        """
        Extract raster images from the page using pymupdf.
        If OCR is enabled and pytesseract is available, run OCR on each image.
        Returns list of dicts: {bbox, text, block_type: "image"}
        """
        result = []
        image_list = fitz_page.get_images(full=True)

        for img_info in image_list:
            xref = img_info[0]
            try:
                img_data = fitz_doc.extract_image(xref)
                width = img_data.get("width", 0)
                height = img_data.get("height", 0)

                # Skip tiny images (bullets, decorations, icons)
                if width < self.image_min_width or height < self.image_min_height:
                    continue

                # Get bounding box of this image on the page
                rects = fitz_page.get_image_rects(xref)
                bbox = rects[0] if rects else (0, 0, width, height)

                # Suppress decorative horizontal banners (wide but very short strips)
                page_width = fitz_page.rect.width
                is_decorative_banner = (
                    width > page_width * 0.75
                    and height < 200
                )
                if is_decorative_banner:
                    log.debug(
                        f"bodhion-native-extractor: suppressing decorative banner "
                        f"({width}×{height}px) on page {page_num}"
                    )
                    continue

                # Suppress images that repeat at the same Y-coordinate on most pages
                if hasattr(self, "_repeating_image_ys") and rects:
                    y_bucket = round(float(rects[0][1]) / 5) * 5
                    if y_bucket in self._repeating_image_ys:
                        log.debug(
                            f"bodhion-native-extractor: suppressing repeating image "
                            f"at y≈{y_bucket} on page {page_num}"
                        )
                        continue

                ocr_text = ""
                if self._tesseract_available:
                    ocr_text = self._ocr_image_bytes(img_data["image"], img_data.get("ext", "png"))

                if ocr_text:
                    result.append({
                        "bbox": bbox,
                        "text": ocr_text,
                        "block_type": "image_ocr",
                    })
                else:
                    result.append({
                        "bbox": bbox,
                        "text": f"[Image: {width}×{height}px]",
                        "block_type": "image_placeholder",
                    })

            except Exception as exc:
                log.warning(f"bodhion-native-extractor: skipping image xref={xref} on page {page_num}: {exc}")
                continue

        return result

    def _ocr_image_bytes(self, image_bytes: bytes, ext: str) -> str:
        """
        Run Tesseract OCR on raw image bytes.
        Returns extracted text, or empty string if OCR yields nothing useful.
        """
        try:
            from PIL import Image, ImageOps
            import pytesseract
            import io

            pil_image = Image.open(io.BytesIO(image_bytes))

            # Convert to grayscale — reduces noise and improves Tesseract accuracy (Q4)
            pil_image = pil_image.convert("L")

            # Upscale images smaller than 1000px on either axis to ~300 DPI equivalent (Q4)
            w, h = pil_image.size
            if w < 1000 or h < 1000:
                scale = max(1000 / w, 1000 / h)
                pil_image = pil_image.resize(
                    (int(w * scale), int(h * scale)), Image.LANCZOS
                )

            # Stretch contrast to handle low-contrast scans (Q4)
            pil_image = ImageOps.autocontrast(pil_image, cutoff=2)

            # psm 6: assume a uniform block of text — best default for embedded image regions (Q4)
            text = pytesseract.image_to_string(
                pil_image, lang="eng", config="--psm 6", timeout=30
            )
            text = text.strip()

            # Reject if too short or mostly non-alphanumeric (diagram/photo noise)
            alphanumeric = sum(1 for c in text if c.isalnum())
            if len(text) < 20 or alphanumeric < len(text) * 0.4:
                return ""

            return text

        except Exception as exc:
            log.debug(f"bodhion-native-extractor: OCR failed: {exc}")
            return ""

    # ─────────────────────────────────────────────────────────────────────────
    # Header / footer suppression  (Q7)
    # ─────────────────────────────────────────────────────────────────────────

    def _find_repeating_margins(self, fitz_doc) -> Set[str]:
        """
        Single pre-pass over all pages to identify text that lives in the top or
        bottom 8% of the page and appears on more than 50% of pages.  These are
        running headers, footers, and page numbers — noise for RAG embeddings.

        Also populates self._repeating_image_ys: a set of Y-coordinate buckets
        (rounded to nearest 5px) where an image appears on ≥ 70% of pages.
        """
        from collections import Counter

        total_pages = len(fitz_doc)
        candidate_counts: Counter = Counter()
        image_y_counts: Counter = Counter()

        for page_num in range(total_pages):
            page = fitz_doc[page_num]
            page_height = page.rect.height
            top_threshold = page_height * 0.08
            bottom_threshold = page_height * 0.92

            for block in page.get_text("dict").get("blocks", []):
                if block.get("type") != 0:
                    continue
                _, y0, _, y1 = block.get("bbox", (0, 0, 0, 0))
                if y1 > top_threshold and y0 < bottom_threshold:
                    continue  # block is in the body area, skip
                text = "".join(
                    span.get("text", "")
                    for line in block.get("lines", [])
                    for span in line.get("spans", [])
                ).strip()
                if text:
                    candidate_counts[text] += 1

            # Track image Y-coordinates for repeating decoration detection
            for img_info in page.get_images(full=True):
                xref = img_info[0]
                try:
                    rects = page.get_image_rects(xref)
                    if rects:
                        y_bucket = round(float(rects[0][1]) / 5) * 5
                        image_y_counts[y_bucket] += 1
                except Exception:
                    pass

        min_occurrences = max(2, total_pages * 0.5)
        min_img_occurrences = max(2, total_pages * 0.70)
        self._repeating_image_ys: Set[float] = {
            y for y, count in image_y_counts.items() if count >= min_img_occurrences
        }
        return {text for text, count in candidate_counts.items() if count >= min_occurrences}

    # ─────────────────────────────────────────────────────────────────────────
    # Overlap removal (table vs text deduplication)
    # ─────────────────────────────────────────────────────────────────────────

    def _remove_overlapping_text(self, text_blocks: List[dict], table_blocks: List[dict]) -> List[dict]:
        """
        Drop text blocks whose bounding box overlaps significantly with any table bbox.
        pdfplumber uses (x0, top, x1, bottom); fitz uses (x0, y0, x1, y1) — both are
        top-left origin so the comparison is direct.
        """
        def overlaps(tb_bbox, tbl_bbox, threshold: float = 0.5) -> bool:
            ax0, ay0, ax1, ay1 = tb_bbox
            bx0, by0, bx1, by1 = tbl_bbox

            inter_x0 = max(ax0, bx0)
            inter_y0 = max(ay0, by0)
            inter_x1 = min(ax1, bx1)
            inter_y1 = min(ay1, by1)

            if inter_x1 <= inter_x0 or inter_y1 <= inter_y0:
                return False

            inter_area = (inter_x1 - inter_x0) * (inter_y1 - inter_y0)
            text_area = max((ax1 - ax0) * (ay1 - ay0), 1)
            return (inter_area / text_area) >= threshold

        table_bboxes = [tb["bbox"] for tb in table_blocks]
        filtered = []
        for tb in text_blocks:
            if not any(overlaps(tb["bbox"], tbl_bbox) for tbl_bbox in table_bboxes):
                filtered.append(tb)
        return filtered

    # ─────────────────────────────────────────────────────────────────────────
    # Markdown reconstruction
    # ─────────────────────────────────────────────────────────────────────────

    def _reconstruct_markdown(
        self,
        text_blocks: List[dict],
        table_blocks: List[dict],
        image_blocks: List[dict],
    ) -> str:
        """
        Merge all blocks, sort by Y coordinate (reading order), render each to Markdown.
        """
        all_blocks = text_blocks + table_blocks + image_blocks

        # Sort by the top-Y of the bbox.
        # fitz bbox: (x0, y0, x1, y1) — y0 is index 1
        # pdfplumber bbox: (x0, top, x1, bottom) — top is index 1
        # image rects from fitz: fitz.Rect — has .y0 attribute or is indexable
        def sort_key(block):
            bbox = block["bbox"]
            try:
                return float(bbox[1])  # y0 / top
            except (TypeError, IndexError):
                return 0.0

        all_blocks.sort(key=sort_key)

        parts = []
        for block in all_blocks:
            btype = block.get("block_type", "text")
            text = block.get("text", "").strip()

            if not text:
                continue

            if btype == "heading":
                parts.append(f"## {text}")
            elif btype == "code":
                parts.append(f"```\n{text}\n```")
            elif btype == "table":
                parts.append(text)
            elif btype == "image_ocr":
                parts.append(f"> **[Image text]:** {text}")
            elif btype == "image_placeholder":
                parts.append(text)
            else:
                parts.append(text)

        return "\n\n".join(parts)

    # ─────────────────────────────────────────────────────────────────────────
    # Page classification  (Session 4)
    # ─────────────────────────────────────────────────────────────────────────

    _IMAGE_LINE_RE = re.compile(r"^\[Image: \d+×\d+px\]$", re.MULTILINE)
    _DOT_LEADER_RE = re.compile(r"\.{4,}")

    def _classify_page(self, content: str, metadata: dict) -> str:
        """
        Classify the page as one of: "cover", "toc", "doc_metadata", "content".
        Rules are checked in order; first match wins.
        """
        text_only = self._IMAGE_LINE_RE.sub("", content).strip()
        if len(text_only) < 100:
            return "cover"
        if len(self._DOT_LEADER_RE.findall(content)) >= 3:
            return "toc"
        if all(s in content for s in ("Prepared By", "Reviewed By", "Approved By")):
            return "doc_metadata"
        return "content"

    # ─────────────────────────────────────────────────────────────────────────
    # Optional file output  (Part 2 — BODHION_EXTRACTOR_WRITE_OUTPUT)
    # ─────────────────────────────────────────────────────────────────────────

    def _write_extraction_output(self, documents: List[Document]) -> None:
        """
        Write extracted Markdown to disk when BODHION_EXTRACTOR_WRITE_OUTPUT=true.

        Layout:
            backend/data/bodhion-extractor/<MMDDYYYYHHMMSS>/<stem>/
                page_001.md
                page_002.md
                ...
                _full.md
        """
        try:
            # Resolve backend/data/ relative to this source file
            # __file__: backend/bodhion/retrieval/loaders/bodhion_native.py
            # parents[3]: backend/
            backend_dir = pathlib.Path(__file__).resolve().parents[3]
            timestamp = datetime.datetime.now().strftime("%m%d%Y%H%M%S")
            stem = pathlib.Path(self.file_path).stem
            out_dir = backend_dir / "data" / "bodhion-extractor" / timestamp / stem
            out_dir.mkdir(parents=True, exist_ok=True)

            full_parts: List[str] = []
            for doc in documents:
                page_label = doc.metadata.get("page_label", doc.metadata.get("page", 0) + 1)
                page_file = out_dir / f"page_{page_label:03d}.md"
                page_file.write_text(doc.page_content, encoding="utf-8")
                full_parts.append(f"<!-- Page {page_label} -->\n\n{doc.page_content}")

            full_file = out_dir / "_full.md"
            full_file.write_text("\n\n---\n\n".join(full_parts), encoding="utf-8")

            self._last_output_dir = out_dir
            log.info(f"bodhion-native-extractor: extraction written to {out_dir}")
        except Exception as exc:
            log.warning(f"bodhion-native-extractor: could not write extraction output: {exc}")

    def write_postprocessed_output(self, docs: List[Document]) -> None:
        """
        Write post-processed (chunked) documents to the same folder created by
        _write_extraction_output(), enabling a side-by-side comparison with the
        raw per-page extraction.

        Files written:
            chunk_001.md, chunk_002.md, …  — one file per chunk
            _full_postprocessed.md         — all chunks joined with ---
        """
        if not self._last_output_dir:
            log.warning(
                "bodhion-native-extractor: write_postprocessed_output called but "
                "_last_output_dir is not set (was _write_extraction_output run?)"
            )
            return
        try:
            out_dir = self._last_output_dir
            full_parts: List[str] = []
            for idx, doc in enumerate(docs, start=1):
                meta_lines = [
                    f"<!-- chunk {idx} of {len(docs)} -->",
                    f"<!-- page: {doc.metadata.get('page_label', doc.metadata.get('page', '?'))} -->",
                ]
                page_type = doc.metadata.get("page_type")
                if page_type:
                    meta_lines.append(f"<!-- page_type: {page_type} -->")
                header = "\n".join(meta_lines)
                body = f"{header}\n\n{doc.page_content}"

                chunk_file = out_dir / f"chunk_{idx:03d}.md"
                chunk_file.write_text(body, encoding="utf-8")
                full_parts.append(body)

            full_file = out_dir / "_full_postprocessed.md"
            full_file.write_text("\n\n---\n\n".join(full_parts), encoding="utf-8")

            log.info(
                f"bodhion-native-extractor: {len(docs)} post-processed chunks written to {out_dir}"
            )
        except Exception as exc:
            log.warning(f"bodhion-native-extractor: could not write post-processed output: {exc}")

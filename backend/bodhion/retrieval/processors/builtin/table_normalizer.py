"""
Processor that detects and collapses PDF-fragmented markdown tables into
readable plain text.

PDF extractors sometimes misread bordered bullet-point boxes or single-column
layouts as wide tables where each word or syllable lands in its own cell, e.g.:

    | ardi | ng the | spot awa | rd to the te | am member |

This processor detects such "fragmented" tables (many columns, mostly short or
empty cells) and joins the non-empty cell values back into a readable sentence.
Well-structured data tables (e.g. award comparison grids) are left untouched.
"""

import logging
import re
from typing import List, Tuple

from langchain_core.documents import Document

from bodhion.retrieval.processors.base import BaseDocumentProcessor
from bodhion.retrieval.processors.registry import register

log = logging.getLogger(__name__)

_TABLE_ROW_RE = re.compile(r"^\|.*\|$")
# A real separator row must contain at least one dash: | --- | :---: | --- |
# Empty rows like |  |  |  | match the same character set but have no dash.
_SEPARATOR_ROW_RE = re.compile(r"^\|[-| :]+\|$")


def _is_separator_row(line: str) -> bool:
    return bool(_SEPARATOR_ROW_RE.match(line.strip())) and "-" in line


def _is_empty_row(line: str) -> bool:
    """True when every cell in the row is blank (pure whitespace)."""
    return all(c == "" for c in _parse_cells(line))


def _parse_cells(line: str) -> List[str]:
    """Return all cell values (stripped) for a markdown table row."""
    return [c.strip() for c in line.strip("|").split("|")]


def _count_columns(table_lines: List[str]) -> int:
    """Return the maximum column count seen across non-separator data rows."""
    max_cols = 0
    for line in table_lines:
        if _is_separator_row(line):
            continue
        max_cols = max(max_cols, len(_parse_cells(line)))
    return max_cols


def _fragmentation_ratio(table_lines: List[str]) -> float:
    """
    Fraction of non-separator cells that are either empty or very short (<= 6 chars).
    Only counts rows that have at least one non-empty cell (skips all-blank rows —
    those are handled separately by _empty_row_ratio).
    """
    total = 0
    short = 0
    for line in table_lines:
        if _is_separator_row(line) or _is_empty_row(line):
            continue
        cells = _parse_cells(line)
        for c in cells:
            total += 1
            if len(c) <= 6:
                short += 1
    if total == 0:
        return 0.0
    return short / total


def _empty_row_ratio(table_lines: List[str]) -> float:
    """
    Fraction of non-separator rows that are entirely blank.
    PDF-fragmented tables interleave content rows with fully-empty spacer rows
    (e.g. |  |  |  |  |). Legitimate data tables almost never do this.
    """
    data_rows = [l for l in table_lines if not _is_separator_row(l)]
    if not data_rows:
        return 0.0
    empty = sum(1 for l in data_rows if _is_empty_row(l))
    return empty / len(data_rows)


def _is_fragmented(table_lines: List[str], min_columns: int, frag_threshold: float) -> bool:
    """
    True when the table looks like broken PDF text rather than real tabular data.
    Triggers when EITHER condition holds (union, not intersection):
      - cell fragmentation ratio is high (many short/empty cells), OR
      - empty row ratio is high (alternating blank spacer rows typical of PDF extraction)
    Both signals must also meet the minimum column count.
    """
    if _count_columns(table_lines) < min_columns:
        return False
    return (
        _fragmentation_ratio(table_lines) >= frag_threshold
        or _empty_row_ratio(table_lines) >= 0.40
    )


def _collapse_table(table_lines: List[str]) -> str:
    """Join all non-empty cell values from a fragmented table into a single paragraph."""
    tokens: List[str] = []
    for line in table_lines:
        if _is_separator_row(line) or _is_empty_row(line):
            continue
        cells = _parse_cells(line)
        tokens.extend(c for c in cells if c)
    text = " ".join(tokens)
    text = re.sub(r"  +", " ", text).strip()
    return text


def _normalize_block(
    content: str,
    min_columns: int,
    frag_threshold: float,
) -> Tuple[str, int]:
    """
    Scan content line-by-line, detect fragmented table blocks, and replace them
    with plain-text paragraphs. Returns (new_content, tables_collapsed).
    """
    lines = content.splitlines()
    result: List[str] = []
    collapsed = 0
    i = 0

    while i < len(lines):
        if _TABLE_ROW_RE.match(lines[i].strip()):
            # Collect the full table block
            table_start = i
            while i < len(lines) and _TABLE_ROW_RE.match(lines[i].strip()):
                i += 1
            table_lines = lines[table_start:i]

            if _is_fragmented(table_lines, min_columns, frag_threshold):
                plain = _collapse_table(table_lines)
                if plain:
                    result.append(plain)
                collapsed += 1
            else:
                result.extend(table_lines)
        else:
            result.append(lines[i])
            i += 1

    return "\n".join(result), collapsed


@register
class TableNormalizer(BaseDocumentProcessor):
    """
    Collapses PDF-fragmented markdown tables into readable plain text.

    Parameters
    ----------
    min_columns : int
        Minimum number of columns before a table is even considered fragmented.
        Keeps narrow legitimate tables (2–5 cols) untouched. Default: 7.
    frag_threshold : float
        Fraction of cells that must be short/empty to classify a table as
        fragmented. Default: 0.55 (55 %).
    """

    name = "normalize_tables"

    def __init__(
        self,
        min_columns: int = 7,
        frag_threshold: float = 0.55,
    ) -> None:
        self.min_columns = min_columns
        self.frag_threshold = frag_threshold

    def process(self, docs: List[Document]) -> List[Document]:
        total_collapsed = 0
        result = []
        for doc in docs:
            cleaned, collapsed = _normalize_block(
                doc.page_content,
                self.min_columns,
                self.frag_threshold,
            )
            total_collapsed += collapsed
            result.append(Document(page_content=cleaned, metadata=doc.metadata))
        if total_collapsed:
            log.info(
                f"normalize_tables: collapsed {total_collapsed} fragmented "
                f"table(s) into plain text "
                f"(min_columns={self.min_columns}, frag_threshold={self.frag_threshold})"
            )
        return result

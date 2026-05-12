import logging
import re
from typing import List

from langchain_core.documents import Document

from bodhion.retrieval.processors.base import BaseDocumentProcessor
from bodhion.retrieval.processors.registry import register

log = logging.getLogger(__name__)

_TABLE_ROW_RE = re.compile(r"^\|.*\|$")


def _extract_cell_values(table_lines: List[str]) -> List[str]:
    values = []
    for line in table_lines:
        if re.match(r"^\|[-| :]+\|$", line):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        values.extend(c for c in cells if c)
    return values


def _deduplicate_block(content: str) -> tuple[str, int]:
    lines = content.splitlines()
    result = []
    removed = 0
    i = 0
    while i < len(lines):
        if _TABLE_ROW_RE.match(lines[i].strip()):
            table_start = i
            while i < len(lines) and _TABLE_ROW_RE.match(lines[i].strip()):
                i += 1
            table_lines = lines[table_start:i]
            result.extend(table_lines)
            cell_values = _extract_cell_values(table_lines)
            if not cell_values:
                continue
            # Collect following non-empty lines and check overlap
            j = i
            candidate = []
            while j < len(lines) and lines[j].strip():
                candidate.append(lines[j])
                j += 1
            if candidate:
                matches = sum(
                    1 for cv in cell_values
                    if any(cv in cl for cl in candidate)
                )
                if matches / len(cell_values) >= 0.70:
                    removed += len(candidate)
                    i = j
            continue
        result.append(lines[i])
        i += 1
    return "\n".join(result), removed


@register
class TableDeduplicator(BaseDocumentProcessor):
    name = "deduplicate_tables"

    def process(self, docs: List[Document]) -> List[Document]:
        total_removed = 0
        result = []
        for doc in docs:
            cleaned, removed = _deduplicate_block(doc.page_content)
            total_removed += removed
            result.append(Document(page_content=cleaned, metadata=doc.metadata))
        if total_removed:
            log.debug(f"deduplicate_tables: removed {total_removed} duplicate plain-text lines")
        return result

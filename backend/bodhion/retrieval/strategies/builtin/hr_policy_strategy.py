import copy
import logging
import re
from typing import List

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from bodhion.retrieval.strategies.base import BaseChunkingStrategy
from bodhion.retrieval.strategies.registry import register

log = logging.getLogger(__name__)

# Matches "## 1.0 Section Title" (markdown H1-H3 with decimal numbering)
# and legacy "01. SECTION NAME" (all-caps, no markdown prefix)
_SECTION_HEADER_RE = re.compile(
    r"(?m)^(?:#{1,3}\s+)?(\d{1,3}(?:\.\d+)*\.?\s+[A-Z][A-Za-z &:()\-/]+)"
)


@register
class HRPolicySectionStrategy(BaseChunkingStrategy):
    name = "hr_policy_section"

    def __init__(
        self,
        chunk_size: int = 800,
        chunk_overlap: int = 150,
        min_chunk_chars: int = 150,
    ) -> None:
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_chars = min_chunk_chars

    def split(self, docs: List[Document]) -> List[Document]:
        if not docs:
            return docs

        base_metadata = copy.deepcopy(docs[0].metadata)
        combined = "\n\n".join(d.page_content for d in docs)

        segments = self._split_on_headers(combined, base_metadata)

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
        )

        result: List[Document] = []
        for seg in segments:
            if len(seg.page_content) > self.chunk_size:
                sub_chunks = splitter.split_documents([seg])
                result.extend(sub_chunks)
            else:
                result.append(seg)

        result = self._merge_small_chunks(result)

        log.debug(
            f"hr_policy_section: {len(docs)} pages → {len(segments)} sections → {len(result)} chunks"
        )
        return result

    def _split_on_headers(self, text: str, base_metadata: dict) -> List[Document]:
        parts = _SECTION_HEADER_RE.split(text)
        # parts: [pre_text, heading1, body1, heading2, body2, ...]
        segments: List[Document] = []

        if parts[0].strip():
            segments.append(Document(
                page_content=parts[0].strip(),
                metadata=copy.deepcopy(base_metadata),
            ))

        i = 1
        while i + 1 < len(parts):
            heading = parts[i].strip()
            body = parts[i + 1].strip()
            content = f"{heading}\n\n{body}" if body else heading
            meta = copy.deepcopy(base_metadata)
            meta["section"] = heading
            segments.append(Document(page_content=content, metadata=meta))
            i += 2

        return segments

    def _merge_small_chunks(self, docs: List[Document]) -> List[Document]:
        if not docs:
            return docs
        merged: List[Document] = []
        pending_content = docs[0].page_content
        pending_meta = docs[0].metadata

        for nxt in docs[1:]:
            if len(pending_content) < self.min_chunk_chars:
                pending_content = pending_content + "\n\n" + nxt.page_content
            else:
                merged.append(Document(page_content=pending_content, metadata=pending_meta))
                pending_content = nxt.page_content
                pending_meta = nxt.metadata

        merged.append(Document(page_content=pending_content, metadata=pending_meta))
        return merged

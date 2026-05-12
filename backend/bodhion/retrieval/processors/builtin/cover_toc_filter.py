import logging
import re
from typing import List

from langchain_core.documents import Document

from bodhion.retrieval.processors.base import BaseDocumentProcessor
from bodhion.retrieval.processors.registry import register

log = logging.getLogger(__name__)

_IMAGE_LINE_RE = re.compile(r"^\[Image: \d+×\d+px\]$", re.MULTILINE)
_DOT_LEADER_RE = re.compile(r"\.{4,}")


@register
class CoverTocFilter(BaseDocumentProcessor):
    name = "filter_cover_toc"

    def process(self, docs: List[Document]) -> List[Document]:
        kept, dropped = [], 0
        for doc in docs:
            page_type = doc.metadata.get("page_type")
            if page_type in ("cover", "toc", "doc_metadata"):
                dropped += 1
                continue
            if page_type is None:
                detected = self._detect_type(doc.page_content)
                if detected in ("cover", "toc", "doc_metadata"):
                    dropped += 1
                    continue
            kept.append(doc)
        if dropped:
            log.debug(f"filter_cover_toc: dropped {dropped} pages")
        return kept

    def _detect_type(self, content: str) -> str:
        text_only = _IMAGE_LINE_RE.sub("", content).strip()
        if len(text_only) < 100:
            return "cover"
        if len(_DOT_LEADER_RE.findall(content)) >= 3:
            return "toc"
        if all(s in content for s in ("Prepared By", "Reviewed By", "Approved By")):
            return "doc_metadata"
        return "content"

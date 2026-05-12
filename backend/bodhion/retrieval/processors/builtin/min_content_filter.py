import logging
from typing import List

from langchain_core.documents import Document

from bodhion.retrieval.processors.base import BaseDocumentProcessor
from bodhion.retrieval.processors.registry import register

log = logging.getLogger(__name__)


@register
class MinContentFilter(BaseDocumentProcessor):
    name = "filter_min_content"

    def __init__(self, min_chars: int = 100) -> None:
        self.min_chars = min_chars

    def process(self, docs: List[Document]) -> List[Document]:
        kept = [d for d in docs if len(d.page_content.strip()) >= self.min_chars]
        dropped = len(docs) - len(kept)
        if dropped:
            log.debug(f"filter_min_content: dropped {dropped} docs (min_chars={self.min_chars})")
        return kept

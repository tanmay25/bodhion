import logging
import re
from typing import List

from langchain_core.documents import Document

from bodhion.retrieval.processors.base import BaseDocumentProcessor
from bodhion.retrieval.processors.registry import register

log = logging.getLogger(__name__)

_IMAGE_LINE_RE = re.compile(r"^\[Image: \d+×\d+px\]$", re.MULTILINE)


@register
class ImagePlaceholderStrip(BaseDocumentProcessor):
    name = "strip_image_placeholders"

    def process(self, docs: List[Document]) -> List[Document]:
        result = []
        for doc in docs:
            cleaned = _IMAGE_LINE_RE.sub("", doc.page_content).strip()
            if not cleaned:
                continue
            result.append(Document(page_content=cleaned, metadata=doc.metadata))
        return result

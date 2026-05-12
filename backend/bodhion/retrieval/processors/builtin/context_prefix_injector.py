import logging
from typing import List

from langchain_core.documents import Document

from bodhion.retrieval.processors.base import BaseDocumentProcessor
from bodhion.retrieval.processors.registry import register

log = logging.getLogger(__name__)


@register
class ContextPrefixInjector(BaseDocumentProcessor):
    name = "inject_context_prefix"

    def __init__(self, include_section: bool = True) -> None:
        self.include_section = include_section

    def process(self, docs: List[Document]) -> List[Document]:
        result = []
        for doc in docs:
            meta = doc.metadata
            name = meta.get("name", "")
            section = meta.get("section", "")
            page_label = meta.get("page_label", "")

            lines = []
            if name:
                lines.append(f"Document: {name}")
            if self.include_section and section:
                lines.append(f"Section: {section}")
            if page_label:
                lines.append(f"Page: {page_label}")

            if lines:
                prefix = "\n".join(lines) + "\n\n"
                new_content = prefix + doc.page_content
            else:
                new_content = doc.page_content

            result.append(Document(page_content=new_content, metadata=meta))
        return result

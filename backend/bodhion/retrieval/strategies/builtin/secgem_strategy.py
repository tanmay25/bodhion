"""
SecGEM chunking strategy — registered as "secgem".

Splitting rules:
  - Entity chunks (secs_message, variable_definition, event_definition,
    alarm_definition, state_model, error_code) → passed through whole.
    These are already the correct retrieval unit. Splitting them would break
    structured S#F# code blocks and detach metadata from content.

  - Narrative chunks → split with RecursiveCharacterTextSplitter so that
    long prose sections are searchable at paragraph granularity.
"""

import logging
from typing import List

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from bodhion.retrieval.loaders.secgem_schemas import ENTITY_CHUNK_TYPES
from bodhion.retrieval.strategies.base import BaseChunkingStrategy
from bodhion.retrieval.strategies.registry import register

log = logging.getLogger(__name__)


@register
class SecGemStrategy(BaseChunkingStrategy):
    """
    Registered as: "secgem"

    Entity chunks bypass the text splitter entirely.
    Narrative chunks are split with RecursiveCharacterTextSplitter.
    """

    name = "secgem"

    def __init__(
        self,
        chunk_size: int = 800,
        chunk_overlap: int = 100,
        add_start_index: bool = True,
    ) -> None:
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            add_start_index=add_start_index,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    def split(self, docs: List[Document]) -> List[Document]:
        out: List[Document] = []
        entity_count  = 0
        narrative_in  = 0
        narrative_out = 0

        for doc in docs:
            ctype = doc.metadata.get("chunk_type", "narrative")
            if ctype in ENTITY_CHUNK_TYPES:
                out.append(doc)
                entity_count += 1
            else:
                split_docs = self._splitter.split_documents([doc])
                out.extend(split_docs)
                narrative_in  += 1
                narrative_out += len(split_docs)

        log.debug(
            "secgem strategy: %d entity chunks passed through, "
            "%d narrative docs → %d chunks",
            entity_count, narrative_in, narrative_out,
        )
        return out

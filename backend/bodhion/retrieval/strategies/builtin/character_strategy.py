from typing import List

from langchain_core.documents import Document

from bodhion.retrieval.chunking import ChunkingConfig, ChunkingStrategy
from bodhion.retrieval.strategies.base import BaseChunkingStrategy
from bodhion.retrieval.strategies.registry import register


@register
class CharacterStrategy(BaseChunkingStrategy):
    name = "character"

    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        add_start_index: bool = True,
        min_chunk_size_target: int = 0,
        enable_markdown_headers: bool = False,
    ) -> None:
        self.cfg = ChunkingConfig(
            splitter="character",
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            add_start_index=add_start_index,
            min_chunk_size_target=min_chunk_size_target,
            enable_markdown_headers=enable_markdown_headers,
        )

    def split(self, docs: List[Document]) -> List[Document]:
        return ChunkingStrategy(self.cfg).split(docs)

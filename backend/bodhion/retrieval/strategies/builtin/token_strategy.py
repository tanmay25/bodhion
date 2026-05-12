from typing import List

from langchain_core.documents import Document

from bodhion.retrieval.chunking import ChunkingConfig, ChunkingStrategy
from bodhion.retrieval.strategies.base import BaseChunkingStrategy
from bodhion.retrieval.strategies.registry import register


@register
class TokenStrategy(BaseChunkingStrategy):
    name = "token"

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
        tiktoken_encoding: str = "cl100k_base",
        min_chunk_size_target: int = 0,
        enable_markdown_headers: bool = False,
    ) -> None:
        self.cfg = ChunkingConfig(
            splitter="token",
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            tiktoken_encoding=tiktoken_encoding,
            min_chunk_size_target=min_chunk_size_target,
            enable_markdown_headers=enable_markdown_headers,
        )

    def split(self, docs: List[Document]) -> List[Document]:
        return ChunkingStrategy(self.cfg).split(docs)

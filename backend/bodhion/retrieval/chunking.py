"""
Unified chunking layer for Bodhion RAG pipeline.

All document splitting goes through ChunkingStrategy so that chunk size,
overlap, and splitter selection are configured in exactly one place and
applied consistently across every loader.
"""

import logging
from dataclasses import dataclass, field
from typing import List, Optional

from langchain_core.documents import Document
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
    TokenTextSplitter,
)

log = logging.getLogger(__name__)

_MARKDOWN_HEADERS = [
    ("#", "Header 1"),
    ("##", "Header 2"),
    ("###", "Header 3"),
    ("####", "Header 4"),
    ("#####", "Header 5"),
    ("######", "Header 6"),
]


@dataclass
class ChunkingConfig:
    """
    All knobs that control how documents are split.

    Mirrors the config fields consumed inline in retrieval.py so they live in
    one place rather than being spread across every call site.
    """

    splitter: str = "character"          # "character" | "token"
    chunk_size: int = 1000
    chunk_overlap: int = 200
    add_start_index: bool = True
    enable_markdown_headers: bool = False
    min_chunk_size_target: int = 0       # 0 = disabled
    tiktoken_encoding: str = "cl100k_base"

    # Populated automatically — callers should not set this directly.
    _tiktoken_encoding_obj: Optional[object] = field(default=None, init=False, repr=False)


class ChunkingStrategy:
    """
    Stateless helper that splits a list of Documents according to a
    ChunkingConfig.  Construct once per ingestion request; call split().

    Usage::

        cfg = ChunkingConfig(
            splitter=request.app.state.config.TEXT_SPLITTER,
            chunk_size=request.app.state.config.CHUNK_SIZE,
            chunk_overlap=request.app.state.config.CHUNK_OVERLAP,
            enable_markdown_headers=request.app.state.config.ENABLE_MARKDOWN_HEADER_TEXT_SPLITTER,
            min_chunk_size_target=request.app.state.config.CHUNK_MIN_SIZE_TARGET,
            tiktoken_encoding=request.app.state.config.TIKTOKEN_ENCODING_NAME,
        )
        docs = ChunkingStrategy(cfg).split(docs)
    """

    def __init__(self, config: ChunkingConfig) -> None:
        self.config = config

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def split(self, docs: List[Document]) -> List[Document]:
        cfg = self.config

        if cfg.enable_markdown_headers:
            docs = self._split_by_markdown_headers(docs)
            if cfg.min_chunk_size_target > 0:
                docs = self._merge_small_chunks(docs)

        if cfg.splitter in ("", "character"):
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=cfg.chunk_size,
                chunk_overlap=cfg.chunk_overlap,
                add_start_index=cfg.add_start_index,
            )
        elif cfg.splitter == "token":
            import tiktoken

            tiktoken.get_encoding(str(cfg.tiktoken_encoding))  # validate early
            splitter = TokenTextSplitter(
                encoding_name=str(cfg.tiktoken_encoding),
                chunk_size=cfg.chunk_size,
                chunk_overlap=cfg.chunk_overlap,
                add_start_index=cfg.add_start_index,
            )
        else:
            raise ValueError(f"Unknown text splitter: {cfg.splitter!r}. Expected 'character' or 'token'.")

        result = splitter.split_documents(docs)
        log.debug(
            f"ChunkingStrategy: {len(docs)} docs → {len(result)} chunks "
            f"(splitter={cfg.splitter!r}, size={cfg.chunk_size}, overlap={cfg.chunk_overlap})"
        )
        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _split_by_markdown_headers(self, docs: List[Document]) -> List[Document]:
        md_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=_MARKDOWN_HEADERS,
            strip_headers=False,
        )
        split_docs: List[Document] = []
        for doc in docs:
            for chunk in md_splitter.split_text(doc.page_content):
                split_docs.append(Document(
                    page_content=chunk.page_content,
                    metadata={**doc.metadata},
                ))
        return split_docs

    def _merge_small_chunks(self, docs: List[Document]) -> List[Document]:
        """
        Merge consecutive chunks from the same source that are smaller than
        min_chunk_size_target, up to chunk_size.  Preserves source boundaries.
        """
        cfg = self.config
        measure = self._measure_fn()

        merged: List[Document] = []
        current: Optional[Document] = None
        current_content = ""

        for nxt in docs:
            if current is None:
                current = nxt
                current_content = nxt.page_content
                continue

            same_source = (
                current.metadata.get("source") == nxt.metadata.get("source")
                and current.metadata.get("file_id") == nxt.metadata.get("file_id")
            )
            proposed = current_content + "\n\n" + nxt.page_content

            if (
                same_source
                and measure(current_content) < cfg.min_chunk_size_target
                and measure(proposed) <= cfg.chunk_size
            ):
                current_content = proposed
            else:
                merged.append(Document(page_content=current_content, metadata=current.metadata))
                current = nxt
                current_content = nxt.page_content

        if current is not None:
            merged.append(Document(page_content=current_content, metadata=current.metadata))

        return merged

    def _measure_fn(self):
        cfg = self.config
        if cfg.splitter == "token":
            import tiktoken
            enc = tiktoken.get_encoding(str(cfg.tiktoken_encoding))
            return lambda text: len(enc.encode(text))
        return len

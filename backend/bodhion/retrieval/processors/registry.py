import logging
from typing import Dict, List, Optional, Type

from langchain_core.documents import Document

from bodhion.retrieval.processors.base import BaseDocumentProcessor

log = logging.getLogger(__name__)

_REGISTRY: Dict[str, Type[BaseDocumentProcessor]] = {}


def register(cls: Type[BaseDocumentProcessor]) -> Type[BaseDocumentProcessor]:
    if not cls.name:
        raise ValueError(f"Processor class {cls.__name__} must define a non-empty 'name' attribute.")
    _REGISTRY[cls.name] = cls
    return cls


def get(name: str) -> Type[BaseDocumentProcessor]:
    if name not in _REGISTRY:
        raise KeyError(f"Processor {name!r} not found. Available: {available()}")
    return _REGISTRY[name]


def available() -> List[str]:
    return sorted(_REGISTRY.keys())


class ProcessorChain:
    def __init__(self, processors: List[BaseDocumentProcessor]) -> None:
        self.processors = processors

    @classmethod
    def from_names(
        cls,
        names: List[str],
        processor_kwargs: Optional[Dict[str, dict]] = None,
    ) -> "ProcessorChain":
        processor_kwargs = processor_kwargs or {}
        processors = [
            get(name)(**(processor_kwargs.get(name) or {}))
            for name in names
        ]
        return cls(processors)

    @classmethod
    def empty(cls) -> "ProcessorChain":
        return cls([])

    def run(self, docs: List[Document]) -> List[Document]:
        for processor in self.processors:
            before = len(docs)
            docs = processor.process(docs)
            after = len(docs)
            log.debug(
                f"ProcessorChain: [{processor.name}] {before} docs → {after} docs"
            )
        return docs


def resolve_chain_for_docs(
    docs: List[Document],
    profiles: Dict[str, List[str]],
    processor_kwargs: Optional[Dict[str, dict]] = None,
) -> ProcessorChain:
    engine = ""
    if docs:
        engine = docs[0].metadata.get("processing_engine", "")

    names = profiles.get(engine) if engine else None
    if names is None:
        names = profiles.get("default", [])

    if not names:
        return ProcessorChain.empty()

    return ProcessorChain.from_names(names, processor_kwargs)

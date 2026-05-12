import logging
from typing import Dict, List, Optional, Type

from langchain_core.documents import Document

from bodhion.retrieval.strategies.base import BaseChunkingStrategy

log = logging.getLogger(__name__)

_REGISTRY: Dict[str, Type[BaseChunkingStrategy]] = {}


def register(cls: Type[BaseChunkingStrategy]) -> Type[BaseChunkingStrategy]:
    if not cls.name:
        raise ValueError(f"Strategy class {cls.__name__} must define a non-empty 'name' attribute.")
    _REGISTRY[cls.name] = cls
    return cls


def get(name: str) -> Type[BaseChunkingStrategy]:
    if name not in _REGISTRY:
        raise KeyError(f"Strategy {name!r} not found. Available: {available()}")
    return _REGISTRY[name]


def available() -> List[str]:
    return sorted(_REGISTRY.keys())


def resolve_strategy_for_docs(
    docs: List[Document],
    strategy_map: Dict[str, str],
    strategy_kwargs: Optional[Dict[str, dict]] = None,
) -> BaseChunkingStrategy:
    strategy_kwargs = strategy_kwargs or {}

    engine = ""
    if docs:
        engine = docs[0].metadata.get("processing_engine", "")

    strategy_name = strategy_map.get(engine) if engine else None
    if not strategy_name:
        strategy_name = strategy_map.get("default", "character")

    cls = get(strategy_name)
    kwargs = strategy_kwargs.get(strategy_name) or {}
    log.debug(f"resolve_strategy_for_docs: engine={engine!r} → strategy={strategy_name!r}")
    return cls(**kwargs)

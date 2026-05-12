from abc import ABC, abstractmethod
from typing import List

from langchain_core.documents import Document


class BaseChunkingStrategy(ABC):
    name: str = ""

    @abstractmethod
    def split(self, docs: List[Document]) -> List[Document]:
        ...

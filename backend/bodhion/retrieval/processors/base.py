from abc import ABC, abstractmethod
from typing import List

from langchain_core.documents import Document


class BaseDocumentProcessor(ABC):
    name: str = ""

    @abstractmethod
    def process(self, docs: List[Document]) -> List[Document]:
        ...

"""Readers that turn a document's PDF into facts beyond its text (ADR 0019).

Other apps register here (``AppConfig.ready``) so the paddock import stays unaware of
them: a reader names the title fragments it handles and receives the PDF bytes once they are
fetched. Documents a reader handles are read right after the stewards' documents.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass
from functools import reduce

from django.db.models import Q

from stintline.paddock.models import FiaDocument


@dataclass(frozen=True)
class DocumentReader:
    name: str
    keywords: tuple[str, ...]
    """Lower-case fragments of the titles this reader handles."""
    read: Callable[[FiaDocument, bytes], None]

    def handles(self, document: FiaDocument) -> bool:
        title = document.title.lower()
        return any(keyword in title for keyword in self.keywords)


_READERS: dict[str, DocumentReader] = {}


def register(readers: Iterable[DocumentReader]) -> None:
    for reader in readers:
        _READERS[reader.name] = reader


def readers_for(document: FiaDocument) -> list[DocumentReader]:
    return [reader for reader in _READERS.values() if reader.handles(document)]


def handled_titles() -> Q:
    """Documents some reader handles (``Q()`` matching nothing when none is registered)."""
    keywords = [k for reader in _READERS.values() for k in reader.keywords]
    if not keywords:
        return Q(pk__in=[])
    return reduce(lambda acc, k: acc | Q(title__icontains=k), keywords, Q(pk__in=[]))

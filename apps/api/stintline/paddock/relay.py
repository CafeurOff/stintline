"""The PDF of an FIA document, relayed on demand (ADR 0018).

The only place where a request can lead to an upstream call: browsers cannot read fia.com
PDFs directly (no CORS) and we do not store them. Each PDF is fetched at most once per
``CACHE_SECONDS`` and only in its turn for the shared fia.com slot (a reader goes before the
background imports and waits at most about one interval).
"""

from __future__ import annotations

from django.core.cache import cache

from stintline.ingestion.sources import open_sources
from stintline.paddock import throttle
from stintline.paddock.models import FiaDocument
from stintline.paddock.services import ThrottleBusyError

CACHE_SECONDS = 7 * 24 * 3600
"""Published documents do not change; a week keeps popular PDFs off fia.com."""


def pdf_bytes(document: FiaDocument) -> bytes:
    """Raises:
    ThrottleBusyError: another request to fia.com was made less than 10 s ago.
    ProviderError: fia.com failed or the URL is not a document.
    """
    key = f"fia:pdf:{document.pk}"
    cached: bytes | None = cache.get(key)
    if cached is not None:
        return cached
    if not throttle.wait_turn(reader=True, max_wait_s=throttle.READER_MAX_WAIT_S):
        raise ThrottleBusyError("fia", "request slot busy")
    with open_sources() as sources:
        if sources.fia is None:
            raise ThrottleBusyError("fia", "no FIA source configured")
        data = sources.fia.document_pdf(document.url)
    cache.set(key, data, CACHE_SECONDS)
    return data

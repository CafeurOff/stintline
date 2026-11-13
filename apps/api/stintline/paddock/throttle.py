"""One request to fia.com per ``FIA_REQUEST_INTERVAL_S`` across every process (ADR 0018).

robots.txt asks for 10 s between requests. The worker (imports) and the API (PDF relay) run
in different processes, so the in-process limiter of ``racedata`` is not enough: a slot is
taken in the shared cache (Redis) with an atomic ``add`` that expires after the interval.
"""

from __future__ import annotations

import time
from collections.abc import Callable

from django.conf import settings
from django.core.cache import cache

SLOT_KEY = "fia:request-slot"
PRIORITY_KEY = "fia:reader-waiting"
"""Set while someone waits for a PDF: background imports step aside for them."""
PRIORITY_TTL_S = 15
READER_MAX_WAIT_S = 12.0
"""A reader waits at most one interval (plus margin) before getting a 429."""
MAX_WAIT_S = 120.0
"""A worker gives up waiting for a slot after this long (another process is busy)."""
POLL_S = 0.5


def _interval() -> float:
    return float(getattr(settings, "FIA_REQUEST_INTERVAL_S", 10.0))


def try_turn() -> bool:
    """Take the slot if free. Always true when the interval is 0 (tests, fixtures)."""
    interval = _interval()
    if interval <= 0:
        return True
    return bool(cache.add(SLOT_KEY, 1, timeout=max(1, round(interval))))


def wait_turn(
    sleep: Callable[[float], None] | None = None,
    *,
    reader: bool = False,
    max_wait_s: float = MAX_WAIT_S,
) -> bool:
    """Block until the slot is free (at most ``max_wait_s``). False when it never was.

    A ``reader`` (someone opening a PDF) flags itself first; background imports do not
    take the slot while that flag is set, so the reader gets the next one.
    """
    pause = sleep or time.sleep
    if reader and _interval() > 0:
        cache.set(PRIORITY_KEY, 1, timeout=PRIORITY_TTL_S)
    waited = 0.0
    try:
        while (not reader and cache.get(PRIORITY_KEY)) or not try_turn():
            if waited >= max_wait_s:
                return False
            pause(POLL_S)
            waited += POLL_S
        return True
    finally:
        if reader:
            cache.delete(PRIORITY_KEY)

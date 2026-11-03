"""Build provider sources from Django settings (``RACEDATA``)."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from django.conf import settings

from racedata.sources import Sources, build_fixture_sources, build_http_sources

MODE_HTTP = "http"
MODE_FIXTURES = "fixtures"


def build_sources(mode: str | None = None) -> Sources:
    cfg = settings.RACEDATA
    mode = mode or cfg["MODE"]
    if mode == MODE_FIXTURES:
        return build_fixture_sources()
    if mode == MODE_HTTP:
        cache_dir = cfg.get("CACHE_DIR")
        return build_http_sources(
            openf1_base_url=cfg.get("OPENF1_BASE_URL"),
            jolpica_base_url=cfg.get("JOLPICA_BASE_URL"),
            cache_dir=Path(cache_dir) if cache_dir else None,
        )
    raise ValueError(f"Unknown RACEDATA mode: {mode!r}")


@contextmanager
def open_sources(mode: str | None = None) -> Iterator[Sources]:
    sources = build_sources(mode)
    try:
        yield sources
    finally:
        sources.close()

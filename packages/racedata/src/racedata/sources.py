"""Build provider sources, either live over HTTP or replaying recorded fixtures."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from racedata.cache import FileCache, ResponseCache
from racedata.config import JOLPICA, OPENF1, WIKIPEDIA, ProviderConfig
from racedata.fixtures import FIXTURES_ROOT, FixtureTransport
from racedata.http import HttpClient
from racedata.providers.base import (
    HistorySource,
    PortraitSource,
    ResultsSource,
    ScheduleSource,
    TimingSource,
)
from racedata.providers.jolpica import JolpicaSource
from racedata.providers.openf1 import OpenF1Source
from racedata.providers.wikipedia import WikipediaSource


@dataclass(frozen=True)
class Sources:
    schedule: ScheduleSource
    results: ResultsSource
    timing: TimingSource
    clients: tuple[HttpClient, ...]
    history: HistorySource | None = None
    """Season-wide results and reference data. ``None`` in minimal test doubles."""
    portraits: PortraitSource | None = None
    """Wikipedia portraits (ADR 0009). ``None`` in minimal test doubles."""

    def close(self) -> None:
        for client in self.clients:
            client.close()


def _http_client(
    cfg: ProviderConfig, base_url: str | None, cache: ResponseCache | None
) -> HttpClient:
    return HttpClient(cfg.name, base_url or cfg.base_url, limits=cfg.limits, cache=cache)


def _fixture_client(cfg: ProviderConfig, root: Path) -> HttpClient:
    transport = FixtureTransport(cfg.name, urlparse(cfg.base_url).path, root)
    return HttpClient(cfg.name, cfg.base_url, transport=transport)


def build_http_sources(
    *,
    openf1_base_url: str | None = None,
    jolpica_base_url: str | None = None,
    cache_dir: Path | None = None,
) -> Sources:
    """Live sources. With ``cache_dir``, responses are cached on disk (historical data is
    immutable once published)."""
    cache = FileCache(cache_dir) if cache_dir else None
    openf1 = _http_client(OPENF1, openf1_base_url, cache)
    jolpica = _http_client(JOLPICA, jolpica_base_url, cache)
    wikipedia = _http_client(WIKIPEDIA, None, None)
    return _sources(openf1, jolpica, wikipedia)


def build_fixture_sources(root: Path = FIXTURES_ROOT) -> Sources:
    """Offline sources backed by recorded fixtures. Unknown requests raise instead of
    reaching the network."""
    openf1 = _fixture_client(OPENF1, root)
    jolpica = _fixture_client(JOLPICA, root)
    wikipedia = _fixture_client(WIKIPEDIA, root)
    return _sources(openf1, jolpica, wikipedia)


def _sources(openf1: HttpClient, jolpica: HttpClient, wikipedia: HttpClient) -> Sources:
    jolpica_source = JolpicaSource(jolpica)
    return Sources(
        schedule=jolpica_source,
        results=jolpica_source,
        timing=OpenF1Source(openf1),
        clients=(openf1, jolpica, wikipedia),
        history=jolpica_source,
        portraits=WikipediaSource(wikipedia),
    )

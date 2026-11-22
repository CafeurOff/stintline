"""Build provider sources, either live over HTTP or replaying recorded fixtures."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from racedata.cache import FileCache, ResponseCache
from racedata.config import (
    FEED_LIMITS,
    FEEDS,
    FIA,
    JOLPICA,
    LIVETIMING_STATIC,
    OPEN_METEO,
    OPENF1,
    WIKIMEDIA_UPLOAD,
    WIKIPEDIA,
    FeedConfig,
    ProviderConfig,
)
from racedata.fixtures import FIXTURES_ROOT, FiaFixtureTransport, FixtureTransport
from racedata.http import HttpClient
from racedata.providers.base import (
    HistorySource,
    PortraitSource,
    ResultsSource,
    ScheduleSource,
    TimingSource,
)
from racedata.providers.feeds import FeedSource
from racedata.providers.fia import FiaSource
from racedata.providers.jolpica import JolpicaSource
from racedata.providers.jolpica import is_final as jolpica_is_final
from racedata.providers.openf1 import OpenF1Source
from racedata.providers.openmeteo import OpenMeteoSource
from racedata.providers.wikipedia import IMAGE_HOSTS, WikimediaImageSource, WikipediaSource
from racedata.radio import RadioClipSource


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
    news: FeedSource | None = None
    """News feed headlines (ADR 0012). ``None`` in minimal test doubles."""
    fia: FiaSource | None = None
    """FIA event documents and stewards' decisions (ADR 0018). ``None`` in test doubles."""
    weather: OpenMeteoSource | None = None
    """Open-Meteo forecasts at the circuits (ADR 0020). ``None`` in test doubles."""
    images: WikimediaImageSource | None = None
    """Portrait thumbnails relayed by the API (ADR 0024). ``None`` offline (fixtures)."""
    radio: RadioClipSource | None = None
    """Team radio clips, fetched to be transcribed (ADR 0029). ``None`` offline (fixtures)."""

    def close(self) -> None:
        for client in self.clients:
            client.close()


FIA_TIMEOUT_S = 40.0
"""Some FIA PDFs weigh several megabytes: a longer read timeout than the JSON APIs."""


def _http_client(
    cfg: ProviderConfig,
    base_url: str | None,
    cache: ResponseCache | None,
    cache_if: Callable[[Any], bool] | None = None,
) -> HttpClient:
    return HttpClient(
        cfg.name, base_url or cfg.base_url, limits=cfg.limits, cache=cache, cache_if=cache_if
    )


def _fixture_client(cfg: ProviderConfig, root: Path) -> HttpClient:
    transport = FixtureTransport(cfg.name, urlparse(cfg.base_url).path, root)
    return HttpClient(cfg.name, cfg.base_url, transport=transport)


def build_http_sources(
    *,
    openf1_base_url: str | None = None,
    jolpica_base_url: str | None = None,
    cache_dir: Path | None = None,
    radio_relay_url: str | None = None,
    radio_relay_token: str | None = None,
) -> Sources:
    """Live sources. With ``cache_dir``, responses are cached on disk (historical data is
    immutable once published; Jolpica's empty tables, filled later, are never cached). With
    ``radio_relay_url``, team radio clips are fetched through that relay (same paths, bearer
    ``radio_relay_token``): the live timing CDN refuses some datacenter addresses (ADR 0029)."""
    cache = FileCache(cache_dir) if cache_dir else None
    openf1 = _http_client(OPENF1, openf1_base_url, cache)
    jolpica = _http_client(JOLPICA, jolpica_base_url, cache, jolpica_is_final)
    wikipedia = _http_client(WIKIPEDIA, None, None)
    feeds = FeedSource(
        [(feed, HttpClient(feed.key, feed.base_url, limits=FEED_LIMITS)) for feed in FEEDS]
    )
    fia = HttpClient(FIA.name, FIA.base_url, limits=FIA.limits, timeout_s=FIA_TIMEOUT_S)
    weather = _http_client(OPEN_METEO, None, None)
    images = {
        host: HttpClient(WIKIMEDIA_UPLOAD.name, f"https://{host}", limits=WIKIMEDIA_UPLOAD.limits)
        for host in IMAGE_HOSTS
    }
    radio = HttpClient(
        LIVETIMING_STATIC.name,
        radio_relay_url or LIVETIMING_STATIC.base_url,
        limits=LIVETIMING_STATIC.limits,
        headers=(
            {"Authorization": f"Bearer {radio_relay_token}"}
            if radio_relay_url and radio_relay_token
            else None
        ),
    )
    sources = _sources(openf1, jolpica, wikipedia, feeds, fia, weather)
    return replace(
        sources,
        clients=(*sources.clients, *images.values(), radio),
        images=WikimediaImageSource(images),
        radio=RadioClipSource(radio),
    )


def build_fixture_sources(root: Path = FIXTURES_ROOT) -> Sources:
    """Offline sources backed by recorded fixtures. Unknown requests raise instead of
    reaching the network."""
    openf1 = _fixture_client(OPENF1, root)
    jolpica = _fixture_client(JOLPICA, root)
    wikipedia = _fixture_client(WIKIPEDIA, root)
    feeds = FeedSource([(feed, _fixture_feed_client(feed, root)) for feed in FEEDS])
    fia = HttpClient(FIA.name, FIA.base_url, transport=FiaFixtureTransport(root))
    weather = _fixture_client(OPEN_METEO, root)
    return _sources(openf1, jolpica, wikipedia, feeds, fia, weather)


def _fixture_feed_client(feed: FeedConfig, root: Path) -> HttpClient:
    transport = FixtureTransport(
        f"feeds/{feed.key}", urlparse(feed.base_url).path, root, suffix=".xml"
    )
    return HttpClient(feed.key, feed.base_url, transport=transport)


def _sources(  # noqa: PLR0917 - one client per provider
    openf1: HttpClient,
    jolpica: HttpClient,
    wikipedia: HttpClient,
    feeds: FeedSource,
    fia: HttpClient,
    weather: HttpClient,
) -> Sources:
    jolpica_source = JolpicaSource(jolpica)
    return Sources(
        schedule=jolpica_source,
        results=jolpica_source,
        timing=OpenF1Source(openf1),
        clients=(openf1, jolpica, wikipedia, fia, weather, *feeds.clients),
        history=jolpica_source,
        portraits=WikipediaSource(wikipedia),
        news=feeds,
        fia=FiaSource(fia),
        weather=OpenMeteoSource(weather),
    )

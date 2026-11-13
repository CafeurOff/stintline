"""Upstream endpoints and their documented limits (see docs/data-sources.md)."""

from __future__ import annotations

from dataclasses import dataclass

from racedata.http import RateLimit


@dataclass(frozen=True, slots=True)
class ProviderConfig:
    name: str
    base_url: str
    limits: tuple[RateLimit, ...]
    """Kept slightly below the published limits to leave headroom for clock skew."""


OPENF1 = ProviderConfig(
    name="openf1",
    base_url="https://api.openf1.org/v1",
    # Free tier: 3 req/s and 30 req/min.
    limits=(RateLimit(max_calls=2, period_s=1.0), RateLimit(max_calls=27, period_s=60.0)),
)

JOLPICA = ProviderConfig(
    name="jolpica",
    base_url="https://api.jolpi.ca/ergast/f1",
    # ~4 req/s burst and ~500 req/hour sustained.
    limits=(RateLimit(max_calls=3, period_s=1.0), RateLimit(max_calls=450, period_s=3600.0)),
)

WIKIPEDIA = ProviderConfig(
    name="wikipedia",
    base_url="https://en.wikipedia.org/w",
    # No published limit for serial API calls; Wikimedia asks for a descriptive User-Agent
    # and modest pace. One call per second is far below anything they throttle.
    limits=(RateLimit(max_calls=1, period_s=1.0),),
)

FIA = ProviderConfig(
    name="fia",
    base_url="https://www.fia.com",
    # robots.txt asks every crawler for a 10 s delay between requests (checked 2026-11-13).
    limits=(RateLimit(max_calls=1, period_s=10.0),),
)

FIA_SEASON_PAGES = {
    2025: "documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071",
    2026: "documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072",
}
"""Season pages of the Formula One documents (the trailing number is fia.com's own id)."""

PROVIDERS = {cfg.name: cfg for cfg in (OPENF1, JOLPICA, WIKIPEDIA, FIA)}


@dataclass(frozen=True, slots=True)
class FeedConfig:
    """A public news feed (RSS 2.0 or Atom). Only headlines and links are kept (ADR 0012)."""

    key: str
    """Stable identifier, stored with every headline."""
    name: str
    """Publication name shown next to its headlines."""
    base_url: str
    path: str
    language: str
    """ISO 639-1 code of the feed's articles."""


FEED_LIMITS = (RateLimit(max_calls=1, period_s=1.0),)
"""Feeds are read once every 30 minutes: one request per second per site is plenty."""

FEEDS = (
    FeedConfig("autosport", "Autosport", "https://www.autosport.com", "rss/f1/news/", "en"),
    FeedConfig("racefans", "RaceFans", "https://www.racefans.net", "feed/", "en"),
    FeedConfig("f1i", "F1i", "https://f1i.com", "feed/", "en"),
    FeedConfig(
        "motorsport-fr", "Motorsport.com France", "https://fr.motorsport.com", "rss/f1/news/", "fr"
    ),
)
"""Checked on 2026-11-11. Each feed is read on its own: one failing never blocks the rest."""

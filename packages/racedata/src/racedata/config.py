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

PROVIDERS = {cfg.name: cfg for cfg in (OPENF1, JOLPICA)}

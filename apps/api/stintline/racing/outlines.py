"""Small circuit outlines for cards, keyed by circuit (read-only, cached).

Each circuit uses the newest stored reference lap, so a Grand Prix still to come shows the
layout from its last timed visit. Circuits never timed (before 2023) have no outline.
"""

from __future__ import annotations

from django.core.cache import cache
from django.db.models import Count, Max

from stintline.racing.geometry import card_path
from stintline.racing.models import TrackOutline

CACHE_SECONDS = 24 * 3600


def circuit_outlines() -> dict[int, str]:
    """``{circuit_id: svg path}``. The cache key changes whenever an outline is stored."""
    stamp = TrackOutline.objects.aggregate(n=Count("id"), last=Max("id"))
    key = f"circuit-outlines:{stamp['n']}:{stamp['last']}"
    cached: dict[int, str] | None = cache.get(key)
    if cached is not None:
        return cached
    out: dict[int, str] = {}
    rows = TrackOutline.objects.order_by(
        "session__event__circuit_id", "-session__event__race_date"
    ).values_list("session__event__circuit_id", "points")
    for circuit_id, points in rows:
        if circuit_id not in out and len(points) >= 2:
            out[circuit_id] = card_path(points)
    cache.set(key, out, CACHE_SECONDS)
    return out

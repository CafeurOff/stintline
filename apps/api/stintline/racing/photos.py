"""The photo to show for a driver: the latest official portrait when official media are on
(ADR 0006), otherwise the Wikipedia portrait (ADR 0009).

A driver still racing keeps their current official portrait everywhere, including on old
results that predate OpenF1 media ids.
"""

from __future__ import annotations

from django.conf import settings
from django.core.cache import cache
from django.db.models import Max

from stintline.racing.media import media_for
from stintline.racing.models import Driver, Session, SessionEntry

CACHE_SECONDS = 24 * 3600


def official_photos() -> dict[int, str]:
    """Latest official portrait URL per driver id (empty when media are off).

    Cached; the key changes whenever a session is imported."""
    if not settings.OFFICIAL_MEDIA_ENABLED:
        return {}
    stamp = Session.objects.aggregate(last=Max("ingested_at"))["last"]
    key = f"official-photos:{stamp.timestamp() if stamp else 0}"
    cached: dict[int, str] | None = cache.get(key)
    if cached is not None:
        return cached
    rows = (
        SessionEntry.objects.exclude(media_id="")
        .exclude(team_display_name="")
        .order_by("-session__event__race_date")
        .values_list("driver_id", "session__event__season__year", "team_display_name", "media_id")
    )
    out: dict[int, str] = {}
    for driver_id, season, team, media_id in rows:
        if driver_id in out:
            continue  # newest first: the first row of a driver is their latest portrait
        media = media_for(season, team, media_id)
        if media and media.driver_image_url:
            out[driver_id] = media.driver_image_url
    cache.set(key, out, CACHE_SECONDS)
    return out


class PhotoBook:
    """Loads :func:`official_photos` once, on first use, for one serializer instance."""

    def __init__(self) -> None:
        self._photos: dict[int, str] | None = None

    def photo_of(self, driver: Driver, wikipedia_url: str | None) -> str | None:
        if self._photos is None:
            self._photos = official_photos()
        return self._photos.get(driver.pk, wikipedia_url)

"""Official media references (driver portraits, car renders).

Decision and risk are recorded in ADR 0006. Images are never downloaded or stored: the
API only returns URLs, and ``OFFICIAL_MEDIA_ENABLED`` turns them off at once (the UI then
falls back to original illustrations).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from django.conf import settings

MEDIA_BASE = "https://media.formula1.com/image/upload"
MEDIA_VERSION = "v1740000001"
CAR_HEIGHT_PX = 224
DRIVER_WIDTH_PX = 320
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def team_media_slug(team_display_name: str) -> str:
    """``"Red Bull Racing"`` -> ``"redbullracing"``, ``"Haas F1 Team"`` -> ``"haasf1team"``."""
    return _NON_ALNUM.sub("", team_display_name.lower())


def car_image_url(season: int, team_slug: str) -> str:
    return (
        f"{MEDIA_BASE}/c_lfill,h_{CAR_HEIGHT_PX}/q_auto/{MEDIA_VERSION}/common/f1/"
        f"{season}/{team_slug}/{season}{team_slug}carright.webp"
    )


def driver_image_url(season: int, team_slug: str, media_id: str) -> str:
    return (
        f"{MEDIA_BASE}/c_lfill,w_{DRIVER_WIDTH_PX}/q_auto/{MEDIA_VERSION}/common/f1/"
        f"{season}/{team_slug}/{media_id}/{season}{team_slug}{media_id}right.webp"
    )


@dataclass(frozen=True, slots=True)
class EntryMedia:
    driver_image_url: str | None
    car_image_url: str | None


def media_for(season: int, team_display_name: str, media_id: str) -> EntryMedia | None:
    if not settings.OFFICIAL_MEDIA_ENABLED or not team_display_name:
        return None
    slug = team_media_slug(team_display_name)
    return EntryMedia(
        driver_image_url=driver_image_url(season, slug, media_id) if media_id else None,
        car_image_url=car_image_url(season, slug),
    )

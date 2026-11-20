"""Wikipedia portraits served from our origin (ADR 0024, amending ADR 0009).

Browsers that load thumbnails straight from upload.wikimedia.org receive Wikimedia's
third-party cookies. The API relays each thumbnail instead: fetched at most once per
``CACHE_SECONDS`` and kept only in the cache (never on disk or in the database), and only
for the image URL stored with a driver, so the relay is not an open proxy.
"""

from __future__ import annotations

from hashlib import sha256

from django.core.cache import cache
from django.urls import reverse

from racedata import UpstreamUnavailableError
from racedata.models import WikiImage
from stintline.ingestion.sources import open_sources
from stintline.racing.models import DriverPortrait

CACHE_SECONDS = 7 * 24 * 3600
"""A Commons file rarely changes; when it does, the stored URL changes and so does the key."""


def _version(image_url: str) -> str:
    return sha256(image_url.encode()).hexdigest()[:12]


def relay_url(portrait: DriverPortrait) -> str:
    """Our URL for the portrait. The version changes with the stored image URL, so browsers
    can keep a copy for as long as the cache does."""
    path = reverse("racing:driver-portrait", kwargs={"ref": portrait.driver.ref})
    return f"{path}?v={_version(portrait.image_url)}"


def portrait_image(portrait: DriverPortrait) -> WikiImage:
    """Raises:
    ProviderError: Wikimedia failed, or the stored URL is not a Wikimedia image.
    """
    key = f"portrait:{_version(portrait.image_url)}"
    cached: WikiImage | None = cache.get(key)
    if cached is not None:
        return cached
    with open_sources() as sources:
        if sources.images is None:
            raise UpstreamUnavailableError("wikimedia", "no image source configured")
        image = sources.images.thumbnail(portrait.image_url)
    cache.set(key, image, CACHE_SECONDS)
    return image

"""sitemap.xml: every page worth finding, in English and French (ADR 0025)."""

from __future__ import annotations

from collections.abc import Iterator
from xml.sax.saxutils import escape

from django.core.cache import cache
from django.db.models import Max

from stintline.racing.models import Circuit, Driver, Event, Season, Session, Team
from stintline.seo.document import page_url
from stintline.seo.pages import STATIC, Locale

CACHE_SECONDS = 6 * 3600


def paths() -> Iterator[str]:
    """Page paths without the language prefix."""
    yield from STATIC
    for year in Season.objects.order_by("-year").values_list("year", flat=True):
        yield f"calendar/{year}"
        yield f"standings/{year}"
    for event_id in Event.objects.order_by("-race_date").values_list("pk", flat=True):
        yield f"events/{event_id}"
    for ref in Driver.objects.order_by("ref").values_list("ref", flat=True):
        yield f"drivers/{ref}"
    for ref in Team.objects.order_by("ref").values_list("ref", flat=True):
        yield f"teams/{ref}"
    for ref in Circuit.objects.order_by("ref").values_list("ref", flat=True):
        yield f"circuits/{ref}"


LOCALES: tuple[Locale, ...] = ("en", "fr")


def _entry(origin: str, bare: str) -> str:
    urls = {locale: escape(page_url(origin, bare, locale)) for locale in LOCALES}
    links = "".join(
        f'<xhtml:link rel="alternate" hreflang="{locale}" href="{url}"/>'
        for locale, url in urls.items()
    )
    return "".join(f"<url><loc>{url}</loc>{links}</url>" for url in urls.values())


def sitemap_xml(origin: str) -> str:
    """Cached; the key changes with each import, so new races appear within the hour."""
    stamp = Session.objects.aggregate(last=Max("ingested_at"))["last"]
    key = f"sitemap:{origin}:{stamp.timestamp() if stamp else 0}"
    cached: str | None = cache.get(key)
    if cached is not None:
        return cached
    body = "".join(_entry(origin, bare) for bare in paths())
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">'
        f"{body}</urlset>\n"
    )
    cache.set(key, xml, CACHE_SECONDS)
    return xml

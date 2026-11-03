"""Wikipedia adapter: freely licensed lead images of driver articles (ADR 0009).

Two MediaWiki API calls per batch of 50 articles:

1. ``prop=pageimages`` with ``pilicense=free`` gives the lead image and a thumbnail URL.
   Non-free (fair use) images are never returned.
2. ``prop=imageinfo`` with ``extmetadata`` gives the author and licence of those files,
   which must be shown next to the image.

Only URLs and credits are kept. Images are never downloaded or re-hosted.
"""

from __future__ import annotations

import html
import re
from collections.abc import Iterator, Sequence
from typing import Any
from urllib.parse import unquote, urlparse

import structlog

from racedata.errors import InvalidPayloadError
from racedata.http import HttpClient
from racedata.models import WikiPortrait

PROVIDER = "wikipedia"
BATCH_SIZE = 50
"""MediaWiki's maximum number of titles per query for regular clients."""
THUMBNAIL_PX = 500
"""Longest side of the thumbnail. 500 is one of Wikimedia's standard thumbnail sizes,
served from cache instead of being rendered on demand."""
MAX_CREDIT_CHARS = 200
WIKIPEDIA_HOST = "en.wikipedia.org"
_TAG = re.compile(r"<[^>]+>")
_SPACES = re.compile(r"\s+")

log = structlog.get_logger(__name__)


def article_title(url: str) -> str | None:
    """``http://en.wikipedia.org/wiki/Lewis_Hamilton`` -> ``Lewis Hamilton``.

    Only English Wikipedia article URLs are accepted.
    """
    parsed = urlparse(url)
    if parsed.hostname != WIKIPEDIA_HOST or not parsed.path.startswith("/wiki/"):
        return None
    title = unquote(parsed.path.removeprefix("/wiki/")).replace("_", " ").strip()
    return title or None


def plain_text(markup: str) -> str:
    """Credit text from the HTML that Commons stores in ``extmetadata``."""
    text = _SPACES.sub(" ", html.unescape(_TAG.sub(" ", markup))).strip()
    return text[:MAX_CREDIT_CHARS]


class WikipediaSource:
    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def portraits(self, titles: Sequence[str]) -> dict[str, WikiPortrait]:
        """Portraits keyed by the requested title. Articles without a free lead image are
        absent from the result."""
        out: dict[str, WikiPortrait] = {}
        for batch in _batches(sorted(set(titles)), BATCH_SIZE):
            out.update(self._batch(batch))
        return out

    def _query(self, params: dict[str, str | int]) -> dict[str, Any]:
        data = self._client.get_json(
            "api.php",
            {"action": "query", "format": "json", "formatversion": 2, **params},
        )
        query = data.get("query") if isinstance(data, dict) else None
        if not isinstance(query, dict):
            raise InvalidPayloadError(PROVIDER, "query without a 'query' object")
        return query

    def _batch(self, titles: list[str]) -> dict[str, WikiPortrait]:
        query = self._query(
            {
                "prop": "pageimages",
                "piprop": "thumbnail|name",
                "pithumbsize": THUMBNAIL_PX,
                "pilicense": "free",
                "redirects": 1,
                "titles": "|".join(titles),
            }
        )
        resolved = _resolved_titles(query, titles)
        thumbnails: dict[str, tuple[str, str]] = {}
        for page in query.get("pages", []):
            thumb = page.get("thumbnail") or {}
            source = thumb.get("source")
            name = page.get("pageimage")
            if isinstance(source, str) and source.startswith("https://") and name:
                # Drop the analytics query string the API appends to thumbnail URLs.
                thumbnails[page["title"]] = (source.split("?", 1)[0], f"File:{name}")
        if not thumbnails:
            return {}

        credits = self._credits(sorted({file for _, file in thumbnails.values()}))
        out: dict[str, WikiPortrait] = {}
        for requested, final in resolved.items():
            if final not in thumbnails:
                continue
            source, file = thumbnails[final]
            credit = credits.get(file)
            if credit is None:
                log.warning("wikipedia_portrait_without_credit", title=requested, file=file)
                continue
            out[requested] = WikiPortrait(title=requested, image_url=source, **credit)
        return out

    def _credits(self, files: list[str]) -> dict[str, dict[str, str]]:
        query = self._query(
            {
                "prop": "imageinfo",
                "iiprop": "url|extmetadata",
                "iiextmetadatafilter": "Artist|LicenseShortName|LicenseUrl",
                "titles": "|".join(files),
            }
        )
        names = {n["to"]: n["from"] for n in query.get("normalized", [])}
        out: dict[str, dict[str, str]] = {}
        for page in query.get("pages", []):
            info = (page.get("imageinfo") or [{}])[0]
            meta = info.get("extmetadata") or {}
            license_name = _meta(meta, "LicenseShortName")
            page_url = info.get("descriptionurl")
            if not license_name or not isinstance(page_url, str):
                continue
            title = page.get("title", "")
            out[names.get(title, title)] = {
                "file_page_url": page_url,
                "artist": plain_text(_meta(meta, "Artist")) or "Unknown author",
                "license": plain_text(license_name),
                "license_url": _meta(meta, "LicenseUrl"),
            }
        return out


def _meta(meta: dict[str, Any], key: str) -> str:
    value = (meta.get(key) or {}).get("value")
    return value if isinstance(value, str) else ""


def _resolved_titles(query: dict[str, Any], titles: list[str]) -> dict[str, str]:
    """Requested title -> final article title, following normalisation then redirects."""
    normalized = {n["from"]: n["to"] for n in query.get("normalized", [])}
    redirects = {r["from"]: r["to"] for r in query.get("redirects", [])}
    out: dict[str, str] = {}
    for title in titles:
        name = normalized.get(title, title)
        out[title] = redirects.get(name, name)
    return out


def _batches(items: list[str], size: int) -> Iterator[list[str]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]

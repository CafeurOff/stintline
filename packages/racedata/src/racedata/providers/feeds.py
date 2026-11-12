"""News feeds: headlines and links from public RSS 2.0 and Atom feeds (ADR 0012).

Only the title, the link, the date, the feed's language and the URL of the image the
publisher attaches to the item (RSS ``enclosure``, Media RSS ``content``/``thumbnail``) are
kept. Summaries and article bodies are dropped while parsing, and images are never
downloaded: StintLine links to articles, it never republishes them (ADR 0012, ADR 0015).
XML is parsed with ``defusedxml`` (no entity expansion, no external entities), since feeds
come from third-party servers.
"""

from __future__ import annotations

import html
import re
from collections.abc import Callable, Iterable, Sequence
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from xml.etree.ElementTree import Element

import structlog
from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException
from pydantic import ValidationError

from racedata.config import FeedConfig
from racedata.errors import InvalidPayloadError, ProviderError
from racedata.http import HttpClient
from racedata.models import Headline

ATOM = "{http://www.w3.org/2005/Atom}"
MEDIA = "{http://search.yahoo.com/mrss/}"
ACCEPT = "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8"
MAX_TITLE_CHARS = 300
MAX_ITEMS_PER_FEED = 50
FUTURE_TOLERANCE = timedelta(hours=1)
"""Items dated further in the future than this are dropped (bad clocks, scheduled posts)."""
TRACKING_PREFIXES = ("utm_",)
"""Query parameters removed from article links: campaign tracking only."""
_TAG = re.compile(r"<[^>]+>")
_SPACES = re.compile(r"\s+")
_SECTION_SUFFIX = re.compile(r"\s+\|\s+[^|]{1,24}$")
"""Trailing section labels some publishers append to titles ("… | Formula 1")."""

log = structlog.get_logger(__name__)


def clean_title(raw: str | None) -> str:
    text = _SPACES.sub(" ", html.unescape(_TAG.sub(" ", raw or ""))).strip()
    return _SECTION_SUFFIX.sub("", text)[:MAX_TITLE_CHARS]


def clean_url(raw: str | None) -> str | None:
    """Article link without tracking parameters; ``None`` unless it is http(s)."""
    url = (raw or "").strip()
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return None
    query = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not k.lower().startswith(TRACKING_PREFIXES)
    ]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))


def parse_date(raw: str | None) -> datetime | None:
    """RFC 822 (RSS) or ISO 8601 (Atom) date in UTC; ``None`` when absent or unreadable."""
    text = (raw or "").strip()
    if not text:
        return None
    try:
        value = parsedate_to_datetime(text)
    except (TypeError, ValueError):
        try:
            value = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    if value.tzinfo is None:
        return None
    return value.astimezone(UTC)


def _text(element: Element | None) -> str | None:
    return element.text if element is not None else None


def clean_image(raw: str | None) -> str | None:
    """Image URL kept only over HTTPS (the site is served over HTTPS), without tracking."""
    url = clean_url(raw)
    return url if url is not None and url.startswith("https://") else None


def _is_image(element: Element) -> bool:
    kind = element.get("type", "")
    return kind.startswith("image/") or element.get("medium") == "image" or not kind


def _item_image(item: Element) -> str | None:
    """The publisher's picture for an item: enclosure, then Media RSS content or thumbnail."""
    candidates = [
        *item.findall("enclosure"),
        *item.findall(f"{MEDIA}content"),
        *item.findall(f"{MEDIA}thumbnail"),
        *(link for link in item.findall(f"{ATOM}link") if link.get("rel") == "enclosure"),
    ]
    for element in candidates:
        if element.tag.endswith("thumbnail") or _is_image(element):
            url = clean_image(element.get("url") or element.get("href"))
            if url is not None:
                return url
    return None


Item = tuple[str | None, str | None, str | None, str | None]


def _rss_items(root: Element) -> Iterable[Item]:
    for item in root.iter("item"):
        yield (
            _text(item.find("title")),
            _text(item.find("link")),
            _text(item.find("pubDate")),
            _item_image(item),
        )


def _atom_link(entry: Element) -> str | None:
    for link in entry.findall(f"{ATOM}link"):
        if link.get("rel", "alternate") == "alternate":
            return link.get("href")
    return None


def _atom_items(root: Element) -> Iterable[Item]:
    for entry in root.iter(f"{ATOM}entry"):
        date = _text(entry.find(f"{ATOM}published")) or _text(entry.find(f"{ATOM}updated"))
        yield _text(entry.find(f"{ATOM}title")), _atom_link(entry), date, _item_image(entry)


def parse_feed(body: str, feed: FeedConfig, now: datetime) -> list[Headline]:
    """Headlines of one feed, newest first, without duplicates.

    Items missing a title, an http(s) link or a date are skipped.

    Raises:
        InvalidPayloadError: the body is not RSS 2.0 or Atom XML.
    """
    try:
        root = ElementTree.fromstring(body)
    except (ElementTree.ParseError, DefusedXmlException) as exc:
        raise InvalidPayloadError(feed.key, "feed is not well-formed XML") from exc
    if root.tag == "rss":
        items = _rss_items(root)
    elif root.tag == f"{ATOM}feed":
        items = _atom_items(root)
    else:
        raise InvalidPayloadError(feed.key, f"unknown feed root <{root.tag}>")

    seen: set[str] = set()
    out: list[Headline] = []
    for raw_title, raw_link, raw_date, image_url in items:
        title, url, published = clean_title(raw_title), clean_url(raw_link), parse_date(raw_date)
        if not title or url is None or published is None or url in seen:
            continue
        if published > now + FUTURE_TOLERANCE:
            continue
        seen.add(url)
        try:
            out.append(
                Headline(
                    source=feed.key,
                    language=feed.language,
                    title=title,
                    url=url,
                    published_at=published,
                    image_url=image_url,
                )
            )
        except ValidationError:
            continue
    out.sort(key=lambda h: h.published_at, reverse=True)
    return out[:MAX_ITEMS_PER_FEED]


class FeedSource:
    """Reads every configured feed. One client per feed, since every feed has its own host."""

    def __init__(
        self,
        feeds: Sequence[tuple[FeedConfig, HttpClient]],
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._feeds = feeds
        self._clock = clock

    @property
    def feeds(self) -> list[FeedConfig]:
        return [feed for feed, _ in self._feeds]

    @property
    def clients(self) -> tuple[HttpClient, ...]:
        return tuple(client for _, client in self._feeds)

    def headlines(self) -> dict[str, list[Headline]]:
        """Headlines per feed key. A feed that fails is logged and left out."""
        out: dict[str, list[Headline]] = {}
        for feed, client in self._feeds:
            try:
                body = client.get_text(feed.path, accept=ACCEPT)
                out[feed.key] = parse_feed(body, feed, self._clock())
            except ProviderError as exc:
                log.warning("feed_unavailable", feed=feed.key, error=type(exc).__name__)
        return out

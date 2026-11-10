"""News feeds: recorded RSS payloads, Atom, and malformed or hostile input."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest

from racedata import InvalidPayloadError
from racedata.config import FEEDS, FeedConfig
from racedata.http import HttpClient
from racedata.providers.feeds import (
    FeedSource,
    clean_title,
    clean_url,
    parse_date,
    parse_feed,
)
from racedata.sources import Sources
from racedata.tools.record_fixture import trim_feed

FEED = FeedConfig("test", "Test", "https://example.org", "feed/", "en")
NOW = datetime(2026, 11, 11, tzinfo=UTC)


def _rss(*items: str) -> str:
    return f'<?xml version="1.0"?><rss version="2.0"><channel>{"".join(items)}</channel></rss>'


def _item(title: str, link: str, date: str = "Tue, 10 Nov 2026 14:52:26 +0000") -> str:
    return f"<item><title>{title}</title><link>{link}</link><pubDate>{date}</pubDate></item>"


def test_recorded_feeds_give_headlines_in_their_language(sources: Sources) -> None:
    assert sources.news is not None

    headlines = sources.news.headlines()

    assert set(headlines) == {feed.key for feed in FEEDS}
    assert all(len(items) == 12 for items in headlines.values())
    assert {h.language for h in headlines["motorsport-fr"]} == {"fr"}
    first = headlines["autosport"][0]
    assert first.url.startswith("https://www.autosport.com/f1/news/")
    assert "utm_" not in first.url
    assert first.published_at.tzinfo is UTC


def test_recorded_headlines_are_sorted_newest_first(sources: Sources) -> None:
    assert sources.news is not None

    for items in sources.news.headlines().values():
        dates = [h.published_at for h in items]
        assert dates == sorted(dates, reverse=True)


def test_parse_feed_skips_incomplete_duplicate_and_future_items() -> None:
    body = _rss(
        _item("Kept", "https://example.org/a"),
        _item("Duplicate", "https://example.org/a"),
        _item("", "https://example.org/b"),
        _item("No http", "javascript:alert(1)"),
        _item("No date", "https://example.org/c", date=""),
        _item("Future", "https://example.org/d", date="Fri, 20 Nov 2026 10:00:00 +0000"),
    )

    headlines = parse_feed(body, FEED, NOW)

    assert [h.title for h in headlines] == ["Kept"]


def test_parse_feed_reads_atom_entries() -> None:
    body = (
        '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom news</title>'
        '<link rel="enclosure" href="https://example.org/image.jpg"/>'
        '<link href="https://example.org/atom"/><updated>2026-11-10T08:00:00Z</updated>'
        "</entry></feed>"
    )

    [headline] = parse_feed(body, FEED, NOW)

    assert headline.url == "https://example.org/atom"
    assert headline.published_at == datetime(2026, 11, 10, 8, tzinfo=UTC)


@pytest.mark.parametrize("body", ["not xml", "<html><body/></html>"])
def test_parse_feed_rejects_other_documents(body: str) -> None:
    with pytest.raises(InvalidPayloadError):
        parse_feed(body, FEED, NOW)


def test_parse_feed_refuses_entity_expansion() -> None:
    body = (
        '<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY a "aaaaaaaaaa">'
        '<!ENTITY b "&a;&a;&a;&a;&a;">]><rss><channel><item><title>&b;</title>'
        "</item></channel></rss>"
    )

    with pytest.raises(InvalidPayloadError):
        parse_feed(body, FEED, NOW)


@pytest.mark.parametrize(
    ("raw", "title"),
    [
        ("Hadjar kept asking Red Bull | Formula 1", "Hadjar kept asking Red Bull"),
        ("<b>Bold</b> &amp; plain", "Bold & plain"),
        (
            "A | B | C long section name that is too long to be one",
            "A | B | C long section name that is too long to be one",
        ),
        (None, ""),
    ],
)
def test_clean_title_strips_markup_and_section_suffix(raw: str | None, title: str) -> None:
    assert clean_title(raw) == title


@pytest.mark.parametrize(
    ("raw", "url"),
    [
        (
            "https://example.org/a/?utm_source=rss&utm_medium=x&id=3#top",
            "https://example.org/a/?id=3",
        ),
        ("ftp://example.org/a", None),
        ("/relative", None),
        (None, None),
    ],
)
def test_clean_url_keeps_http_links_without_tracking(raw: str | None, url: str | None) -> None:
    assert clean_url(raw) == url


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Tue, 10 Nov 2026 17:09:30 GMT", datetime(2026, 11, 10, 17, 9, 30, tzinfo=UTC)),
        ("2026-11-10T18:00:00+01:00", datetime(2026, 11, 10, 17, tzinfo=UTC)),
        ("2026-11-10T18:00:00", None),
        ("yesterday", None),
        (None, None),
    ],
)
def test_parse_date_accepts_rfc822_and_iso(raw: str | None, expected: datetime | None) -> None:
    assert parse_date(raw) == expected


def test_a_failing_feed_does_not_block_the_others() -> None:
    def ok(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=_rss(_item("Fine", "https://example.org/ok")))

    def down(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html/>")

    broken = FeedConfig("broken", "Broken", "https://broken.example", "feed/", "en")
    source = FeedSource(
        [
            (FEED, HttpClient("test", FEED.base_url, transport=httpx.MockTransport(ok))),
            (broken, HttpClient("broken", broken.base_url, transport=httpx.MockTransport(down))),
        ],
        clock=lambda: NOW,
    )

    headlines = source.headlines()

    assert list(headlines) == ["test"]
    assert source.feeds == [FEED, broken]


def test_trim_feed_keeps_headline_fields_only() -> None:
    body = _rss(
        "<title>Channel</title><description>About</description>",
        *(
            f"<item><title>T{i}</title><link>https://e.org/{i}</link>"
            "<description>Article text</description></item>"
            for i in range(3)
        ),
    )

    trimmed, dropped = trim_feed(body, keep=2)

    assert dropped == ["description"]
    assert "Article text" not in trimmed
    assert "About" not in trimmed
    assert trimmed.count("<item>") == 2


def test_recorded_feed_fixtures_hold_no_article_text() -> None:
    root = Path(__file__).resolve().parents[1] / "fixtures" / "feeds"

    for file in root.rglob("*.xml"):
        text = file.read_text(encoding="utf-8")
        assert "<description>" not in text, file
        assert "content:encoded" not in text, file

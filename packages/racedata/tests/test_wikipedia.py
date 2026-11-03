"""Wikipedia portraits: recorded payloads and malformed answers."""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from racedata import InvalidPayloadError
from racedata.http import HttpClient
from racedata.providers.wikipedia import WikipediaSource, article_title, plain_text
from racedata.sources import Sources

HISTORY = ["Juan Manuel Fangio", "Nino Farina", "Johnnie Parsons", "Stintline nonexistent driver"]


def test_portraits_follow_redirects_and_carry_the_licence(sources: Sources) -> None:
    assert sources.portraits is not None

    portraits = sources.portraits.portraits(HISTORY)

    fangio = portraits["Juan Manuel Fangio"]
    assert fangio.license == "CC BY 4.0"
    assert fangio.artist == "Bjørn Fjørtoft"
    assert fangio.image_url.startswith("https://")
    assert "?" not in fangio.image_url
    assert fangio.file_page_url.startswith("https://commons.wikimedia.org/wiki/File:")
    assert portraits["Nino Farina"].license == "Public domain"


def test_articles_without_a_free_image_are_absent(sources: Sources) -> None:
    assert sources.portraits is not None

    portraits = sources.portraits.portraits(HISTORY)

    assert "Stintline nonexistent driver" not in portraits
    assert len(portraits) == 3


@pytest.mark.parametrize(
    ("url", "title"),
    [
        ("http://en.wikipedia.org/wiki/Lewis_Hamilton", "Lewis Hamilton"),
        ("https://en.wikipedia.org/wiki/Nico_H%C3%BClkenberg", "Nico Hülkenberg"),
        ("https://de.wikipedia.org/wiki/Michael_Schumacher", None),
        ("https://en.wikipedia.org/w/index.php?title=X", None),
        ("", None),
    ],
)
def test_article_title_accepts_english_article_urls_only(url: str, title: str | None) -> None:
    assert article_title(url) == title


def test_plain_text_strips_markup_and_entities() -> None:
    assert plain_text('<a href="//x">Yu&nbsp;Chu</a>\n <span>Chin</span>') == "Yu Chu Chin"


def _source(*bodies: Any) -> WikipediaSource:
    queue = list(bodies)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=queue.pop(0))

    return WikipediaSource(
        HttpClient("t", "https://wiki.test/w", transport=httpx.MockTransport(handler))
    )


def test_answer_without_query_object_is_rejected() -> None:
    with pytest.raises(InvalidPayloadError):
        _source({"batchcomplete": True}).portraits(["A"])


def test_file_without_licence_is_dropped() -> None:
    pages = {
        "query": {
            "pages": [
                {"title": "A", "pageimage": "a.jpg", "thumbnail": {"source": "https://x/a.jpg"}}
            ]
        }
    }
    files = {
        "query": {
            "pages": [
                {
                    "title": "File:A.jpg",
                    "imageinfo": [{"descriptionurl": "https://c/File:A.jpg", "extmetadata": {}}],
                }
            ],
            "normalized": [{"from": "File:a.jpg", "to": "File:A.jpg"}],
        }
    }

    assert _source(pages, files).portraits(["A"]) == {}


def test_page_without_a_thumbnail_needs_no_second_call() -> None:
    assert _source({"query": {"pages": [{"title": "A"}]}}).portraits(["A"]) == {}

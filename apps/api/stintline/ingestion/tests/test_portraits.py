"""Driver portraits from recorded Wikipedia answers (ADR 0009)."""

from __future__ import annotations

import datetime as dt

import pytest
from django.utils import timezone

from racedata.sources import Sources, build_fixture_sources
from stintline.ingestion.portraits import PortraitsUnavailableError, ingest_portraits
from stintline.racing.models import Driver, DriverPortrait
from stintline.racing.tests.factories import DriverFactory

pytestmark = pytest.mark.django_db

ARTICLES = {
    "fangio": "http://en.wikipedia.org/wiki/Juan_Manuel_Fangio",
    "farina": "http://en.wikipedia.org/wiki/Nino_Farina",
    "parsons": "http://en.wikipedia.org/wiki/Johnnie_Parsons",
    "ghost": "http://en.wikipedia.org/wiki/Stintline_nonexistent_driver",
}


@pytest.fixture
def sources() -> Sources:
    return build_fixture_sources()


@pytest.fixture
def drivers() -> dict[str, Driver]:
    return {ref: DriverFactory.create(ref=ref, wikipedia_url=url) for ref, url in ARTICLES.items()}


def test_portraits_are_stored_with_their_credit(
    sources: Sources, drivers: dict[str, Driver]
) -> None:
    report = ingest_portraits(sources)

    assert report.counts == {"portraits": 3, "without_portrait": 1}
    fangio = DriverPortrait.objects.get(driver=drivers["fangio"])
    assert fangio.license == "CC BY 4.0"
    assert fangio.artist == "Bjørn Fjørtoft"
    assert fangio.file_page_url.startswith("https://commons.wikimedia.org/")


def test_a_portrait_gone_from_wikipedia_is_removed(
    sources: Sources, drivers: dict[str, Driver]
) -> None:
    DriverPortrait.objects.create(
        driver=drivers["ghost"],
        image_url="https://example.org/old.jpg",
        file_page_url="https://example.org/File:old.jpg",
        artist="Someone",
        license="CC BY 4.0",
        fetched_at=timezone.now() - dt.timedelta(days=30),
    )

    ingest_portraits(sources)

    assert not DriverPortrait.objects.filter(driver=drivers["ghost"]).exists()


def test_drivers_without_an_english_article_are_not_requested(sources: Sources) -> None:
    DriverFactory.create(ref="nourl", wikipedia_url="")
    DriverFactory.create(ref="german", wikipedia_url="https://de.wikipedia.org/wiki/Test")

    report = ingest_portraits(sources)

    assert report.counts == {"portraits": 0, "without_portrait": 0}


def test_sources_without_portraits_are_rejected(sources: Sources) -> None:
    bare = Sources(
        schedule=sources.schedule, results=sources.results, timing=sources.timing, clients=()
    )

    with pytest.raises(PortraitsUnavailableError):
        ingest_portraits(bare)

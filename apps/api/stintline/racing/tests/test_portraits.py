"""Wikipedia portraits relayed from our origin (ADR 0024)."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from racedata import UpstreamUnavailableError
from racedata.models import WikiImage
from stintline.racing import portraits
from stintline.racing.models import Driver, DriverPortrait
from stintline.racing.tests.factories import DriverFactory

pytestmark = pytest.mark.django_db

THUMB = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/500px-X.jpg"


@dataclass
class FakeImages:
    fail: bool = False
    asked: list[str] = field(default_factory=list)

    def thumbnail(self, url: str) -> WikiImage:
        self.asked.append(url)
        if self.fail:
            raise UpstreamUnavailableError("wikimedia", "down")
        return WikiImage(content=b"jpeg-bytes", content_type="image/jpeg")


@dataclass
class FakeSources:
    images: FakeImages | None


@pytest.fixture(autouse=True)
def _clear_cache() -> Iterator[None]:
    cache.clear()
    yield
    cache.clear()


def _use(monkeypatch: pytest.MonkeyPatch, images: FakeImages | None) -> None:
    @contextmanager
    def fake_open_sources(*_: Any) -> Iterator[FakeSources]:
        yield FakeSources(images)

    monkeypatch.setattr(portraits, "open_sources", fake_open_sources)


def _portrait(driver: Driver, url: str = THUMB) -> DriverPortrait:
    return DriverPortrait.objects.create(
        driver=driver,
        image_url=url,
        file_page_url="https://commons.wikimedia.org/wiki/File:X.jpg",
        artist="A. Photographer",
        license="CC BY-SA 4.0",
        fetched_at=timezone.now(),
    )


def test_portrait_relay_serves_the_image_with_a_long_cache(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    images = FakeImages()
    _use(monkeypatch, images)
    driver = DriverFactory.create(ref="fangio")
    _portrait(driver)

    first = APIClient().get("/api/v1/drivers/fangio/portrait")
    second = APIClient().get("/api/v1/drivers/fangio/portrait")

    assert first.status_code == 200
    assert first.content == b"jpeg-bytes"
    assert first["Content-Type"] == "image/jpeg"
    assert "max-age=604800" in first["Cache-Control"]
    assert second.content == b"jpeg-bytes"
    assert images.asked == [THUMB]


def test_portrait_relay_answers_404_without_a_portrait(monkeypatch: pytest.MonkeyPatch) -> None:
    _use(monkeypatch, FakeImages())
    DriverFactory.create(ref="nobody")

    response = APIClient().get("/api/v1/drivers/nobody/portrait")

    assert response.status_code == 404


@pytest.mark.parametrize("images", [FakeImages(fail=True), None])
def test_portrait_relay_answers_502_when_wikimedia_fails(
    monkeypatch: pytest.MonkeyPatch, images: FakeImages | None
) -> None:
    _use(monkeypatch, images)
    _portrait(DriverFactory.create(ref="fangio"))

    response = APIClient().get("/api/v1/drivers/fangio/portrait")

    assert response.status_code == 502
    assert response.json()["code"] == "upstream_unavailable"
    assert "down" not in response.json()["detail"]


def test_relay_url_changes_with_the_stored_image() -> None:
    driver = DriverFactory.create(ref="fangio")
    portrait = _portrait(driver)
    before = portraits.relay_url(portrait)

    portrait.image_url = THUMB.replace("X.jpg", "Y.jpg")

    assert before.startswith("/api/v1/drivers/fangio/portrait?v=")
    assert portraits.relay_url(portrait) != before

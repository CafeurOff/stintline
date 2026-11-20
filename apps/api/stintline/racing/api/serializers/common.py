"""Serializers shared by every racing resource: seasons, circuits, drivers, teams and media."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from stintline.racing.models import (
    Circuit,
    Driver,
    DriverPortrait,
    Season,
    Team,
)
from stintline.racing.outlines import circuit_outlines
from stintline.racing.photos import PhotoBook
from stintline.racing.portraits import relay_url


class SeasonSerializer(serializers.ModelSerializer[Season]):
    events_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Season
        fields = ["year", "events_count"]


class CircuitSerializer(serializers.ModelSerializer[Circuit]):
    outline = serializers.SerializerMethodField(
        help_text="Small SVG path of the layout in a 100-unit box, from its newest timed race"
    )

    class Meta:
        model = Circuit
        fields = [
            "ref",
            "name",
            "locality",
            "country",
            "latitude",
            "longitude",
            "wikipedia_url",
            "outline",
        ]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._outlines: dict[int, str] | None = None

    def get_outline(self, circuit: Circuit) -> str | None:
        if self._outlines is None:
            self._outlines = circuit_outlines()
        return self._outlines.get(circuit.pk)


def portrait_of(driver: Driver) -> DriverPortrait | None:
    """The driver's Wikipedia portrait, if any (select ``driver__portrait`` to avoid N+1)."""
    try:
        return driver.portrait
    except DriverPortrait.DoesNotExist:
        return None


class PortraitSerializer(serializers.ModelSerializer[DriverPortrait]):
    """Freely licensed image with the credit its licence requires (ADR 0009)."""

    image_url = serializers.SerializerMethodField(
        help_text="The thumbnail, relayed from our origin (ADR 0024)"
    )

    class Meta:
        model = DriverPortrait
        fields = ["image_url", "artist", "license", "license_url", "file_page_url"]

    def get_image_url(self, portrait: DriverPortrait) -> str:
        return relay_url(portrait)


class DriverSerializer(serializers.ModelSerializer[Driver]):
    portrait_url = serializers.SerializerMethodField(
        help_text="Wikipedia portrait (ADR 0009); official media take precedence when present"
    )
    photo_url = serializers.SerializerMethodField(
        help_text="Photo to show: latest official portrait if enabled, else the Wikipedia one"
    )

    class Meta:
        model = Driver
        fields = ["ref", "code", "given_name", "family_name", "portrait_url", "photo_url"]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._photos = PhotoBook()

    def get_portrait_url(self, driver: Driver) -> str | None:
        portrait = portrait_of(driver)
        return relay_url(portrait) if portrait else None

    def get_photo_url(self, driver: Driver) -> str | None:
        return self._photos.photo_of(driver, self.get_portrait_url(driver))


class TeamSerializer(serializers.ModelSerializer[Team]):
    class Meta:
        model = Team
        fields = ["ref", "name"]


class MediaSerializer(serializers.Serializer[Any]):
    driver_image_url = serializers.URLField(allow_null=True)
    car_image_url = serializers.URLField(allow_null=True)

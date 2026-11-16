"""Open-Meteo forecasts: the documented payload and malformed answers."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

import httpx
import pytest

from racedata import InvalidPayloadError
from racedata.http import HttpClient
from racedata.providers.openmeteo import HOURLY, OpenMeteoSource
from racedata.sources import Sources
from racedata.testing import sequence_transport

YAS = (24.4672, 54.6031)
"""Rounded to 24.47 / 54.60 in the request, which matches the fixture."""


def test_hourly_gives_one_utc_point_per_hour(sources: Sources) -> None:
    assert sources.weather is not None

    hours = sources.weather.hourly(*YAS, date(2026, 12, 4), date(2026, 12, 6))

    assert len(hours) == 72
    assert hours[0].at == datetime(2026, 12, 4, tzinfo=UTC)
    assert hours[-1].at == datetime(2026, 12, 6, 23, tzinfo=UTC)


def test_hourly_reads_rain_wind_and_weather_code(sources: Sources) -> None:
    assert sources.weather is not None

    hours = sources.weather.hourly(*YAS, date(2026, 12, 4), date(2026, 12, 6))
    shower = next(h for h in hours if h.at == datetime(2026, 12, 5, 12, tzinfo=UTC))

    assert shower.rain_probability_pct == 55
    assert shower.precipitation_mm == pytest.approx(0.6)
    assert shower.weather_code == 61
    assert shower.wind_ms is not None
    assert shower.air_c is not None


def test_hourly_keeps_missing_values_as_none(sources: Sources) -> None:
    assert sources.weather is not None

    hours = sources.weather.hourly(*YAS, date(2026, 12, 4), date(2026, 12, 6))

    assert hours[-1].rain_probability_pct is None


def _source(body: Any) -> tuple[OpenMeteoSource, list[httpx.Request]]:
    transport, calls = sequence_transport(httpx.Response(200, json=body))
    return OpenMeteoSource(HttpClient("t", "https://meteo.test/v1", transport=transport)), calls


def test_hourly_asks_for_utc_times_and_metres_per_second() -> None:
    hourly: dict[str, list[float]] = {"time": [], **{name: [] for name in HOURLY}}
    source, calls = _source({"hourly": hourly})

    source.hourly(1.23456, -2.5, date(2026, 1, 1), date(2026, 1, 2))

    query = calls[0].url.params
    assert query["timezone"] == "GMT"
    assert query["wind_speed_unit"] == "ms"
    assert (query["latitude"], query["longitude"]) == ("1.23", "-2.50")


@pytest.mark.parametrize(
    "body",
    [
        {"error": True, "reason": "x"},
        {"hourly": {"time": "nope"}},
        {"hourly": {"time": ["2026-01-01T00:00"], "temperature_2m": [1.0]}},
        {"hourly": {"time": ["yesterday"], **{name: [1] for name in HOURLY}}},
    ],
)
def test_malformed_forecasts_are_rejected(body: dict[str, Any]) -> None:
    source, _ = _source(body)

    with pytest.raises(InvalidPayloadError):
        source.hourly(0.0, 0.0, date(2026, 1, 1), date(2026, 1, 1))

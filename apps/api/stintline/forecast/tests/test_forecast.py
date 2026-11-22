"""Forecasts: refresh from the recorded Open-Meteo payload, summaries and the endpoint."""

from __future__ import annotations

import datetime as dt
from io import StringIO
from typing import Any
from unittest import mock

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from racedata.errors import UpstreamUnavailableError
from racedata.models import HourlyForecast
from racedata.sources import Sources, build_fixture_sources
from stintline.forecast import services, tasks
from stintline.forecast.models import SessionForecast
from stintline.racing.models import Session, SessionKind
from stintline.racing.tests.factories import CircuitFactory, EventFactory, SessionFactory

pytestmark = pytest.mark.django_db
NOW = dt.datetime(2026, 11, 30, 12, tzinfo=dt.UTC)


def utc(day: int, hour: int, minute: int = 0) -> dt.datetime:
    return dt.datetime(2026, 12, day, hour, minute, tzinfo=dt.UTC)


@pytest.fixture
def weekend() -> dict[str, Session]:
    """Abu Dhabi coordinates, as in the recorded forecast (4 to 6 December 2026)."""
    circuit = CircuitFactory.create(ref="yas_marina", latitude=24.4672, longitude=54.6031)
    event = EventFactory.create(circuit=circuit, race_date=dt.date(2026, 12, 6))
    return {
        "fp1": SessionFactory.create(
            event=event, kind=SessionKind.PRACTICE_1, scheduled_start=utc(4, 9, 30)
        ),
        "q": SessionFactory.create(
            event=event, kind=SessionKind.QUALIFYING, scheduled_start=utc(5, 12)
        ),
        "race": SessionFactory.create(
            event=event, kind=SessionKind.RACE, scheduled_start=utc(6, 13)
        ),
    }


@pytest.fixture
def sources() -> Any:
    built = build_fixture_sources()
    yield built
    built.close()


def hour(at: dt.datetime, **values: Any) -> HourlyForecast:
    fields: dict[str, Any] = {
        "air_c": None,
        "rain_probability_pct": None,
        "precipitation_mm": None,
        "wind_ms": None,
        "weather_code": None,
    }
    return HourlyForecast(at=at, **{**fields, **values})


def test_summarise_counts_the_hour_holding_the_start() -> None:
    hours = [
        hour(utc(6, 12), air_c=20.0, rain_probability_pct=90),
        hour(utc(6, 13), air_c=22.0, rain_probability_pct=10, precipitation_mm=0.2),
        hour(utc(6, 14), air_c=24.0, rain_probability_pct=40, precipitation_mm=0.3),
        hour(utc(6, 15), air_c=30.0, rain_probability_pct=99),
    ]

    summary = services.summarise(hours, utc(6, 13, 30), utc(6, 15, 30))

    assert summary.air_c == 25.3
    assert (summary.air_min_c, summary.air_max_c) == (22.0, 30.0)
    assert summary.rain_probability_pct == 99
    assert summary.precipitation_mm == 0.5


def test_summarise_without_values_gives_nones() -> None:
    summary = services.summarise([hour(utc(6, 13))], utc(6, 13), utc(6, 14))

    assert summary.air_c is None
    assert summary.rain_probability_pct is None
    assert summary.weather_code is None
    assert len(summary.hours) == 1


def test_refresh_stores_one_forecast_per_session(
    weekend: dict[str, Session], sources: Sources
) -> None:
    stored = services.refresh_forecasts(sources, NOW)

    assert stored == 3
    race = SessionForecast.objects.get(session=weekend["race"])
    assert race.window_end - race.window_start == dt.timedelta(hours=2)
    assert race.air_c is not None
    assert len(race.hours) == 5


def test_refresh_finds_the_shower_during_qualifying(
    weekend: dict[str, Session], sources: Sources
) -> None:
    services.refresh_forecasts(sources, NOW)

    quali = SessionForecast.objects.get(session=weekend["q"])
    assert quali.rain_probability_pct == 55
    assert quali.weather_code == 61
    assert quali.precipitation_mm == 0.6


def test_refresh_replaces_the_previous_forecast(
    weekend: dict[str, Session], sources: Sources
) -> None:
    services.refresh_forecasts(sources, NOW)
    services.refresh_forecasts(sources, NOW + dt.timedelta(hours=3))

    assert SessionForecast.objects.count() == 3
    assert SessionForecast.objects.first().fetched_at == NOW + dt.timedelta(hours=3)  # type: ignore[union-attr]


def test_refresh_skips_sessions_out_of_range_or_without_coordinates() -> None:
    SessionFactory.create(scheduled_start=NOW + dt.timedelta(days=2))
    far = CircuitFactory.create(latitude=1.0, longitude=1.0)
    SessionFactory.create(
        event=EventFactory.create(circuit=far), scheduled_start=NOW + dt.timedelta(days=40)
    )
    weather = mock.Mock()

    stored = services.refresh_forecasts(mock.Mock(weather=weather), NOW)

    assert stored == 0
    weather.hourly.assert_not_called()


def test_refresh_skips_a_weekend_whose_forecast_fails(weekend: dict[str, Session]) -> None:
    weather = mock.Mock()
    weather.hourly.side_effect = UpstreamUnavailableError("openmeteo", "down")

    assert services.refresh_forecasts(mock.Mock(weather=weather), NOW) == 0


def test_refresh_without_a_weather_source_does_nothing() -> None:
    assert services.refresh_forecasts(mock.Mock(weather=None), NOW) == 0


def test_command_and_task_use_the_configured_sources(weekend: dict[str, Session]) -> None:
    out = StringIO()
    with mock.patch("django.utils.timezone.now", return_value=NOW):
        call_command("refresh_forecasts", stdout=out)
        assert tasks.refresh_forecasts() == 3

    assert "3 session forecasts stored" in out.getvalue()


def test_endpoint_lists_upcoming_forecasts_of_one_weekend(
    weekend: dict[str, Session], sources: Sources
) -> None:
    services.refresh_forecasts(sources, NOW)
    other = SessionFactory.create(scheduled_start=utc(5, 8))
    SessionForecast.objects.create(
        session=other, fetched_at=NOW, window_start=utc(5, 8), window_end=utc(5, 9)
    )

    with mock.patch("django.utils.timezone.now", return_value=NOW):
        response = APIClient().get("/api/v1/forecasts", {"event": weekend["race"].event_id})
        everything = APIClient().get("/api/v1/forecasts").json()

    assert response.status_code == 200
    body = response.json()
    assert [row["kind"] for row in body] == ["FP1", "Q", "R"]
    assert body[1]["rain_probability_pct"] == 55
    assert body[2]["hours"][0]["at"].endswith("Z")
    assert len(everything) == 4
    assert "max-age" in response["Cache-Control"]


def test_endpoint_rejects_a_bad_event() -> None:
    assert APIClient().get("/api/v1/forecasts", {"event": "x"}).status_code == 400


def test_worker_start_also_refreshes_forecasts() -> None:
    from config.celery import catch_up_on_start

    sender = mock.Mock(task_consumer=None)

    catch_up_on_start(sender)

    sent = [c.args[0] for c in sender.app.send_task.call_args_list]
    assert "stintline.forecast.tasks.refresh_forecasts" in sent

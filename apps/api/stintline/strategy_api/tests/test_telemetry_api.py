"""Fastest-lap telemetry: import from recorded fixtures, catch-up, and the endpoints."""

from __future__ import annotations

import datetime as dt
from io import StringIO
from typing import Any
from unittest.mock import patch

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from racedata.sources import build_fixture_sources
from stintline.ingestion import tasks, telemetry
from stintline.racing.models import Session, TelemetryLap

pytestmark = pytest.mark.django_db
NOW = dt.datetime(2026, 11, 11, tzinfo=dt.UTC)


def get(path: str, status: int = 200, **params: Any) -> Any:
    response = APIClient().get(f"/api/v1/{path}", params)
    assert response.status_code == status, response.content
    return response.json()


def hungary() -> Session:
    return Session.objects.get(event__season__year=2025, event__round=14, kind="R")


def test_seed_stores_the_hungarian_podium_fastest_laps(seeded: None) -> None:
    laps = TelemetryLap.objects.filter(entry__session=hungary())

    assert sorted(laps.values_list("entry__car_number", "lap_number")) == [
        (4, 57),
        (63, 45),
        (81, 56),
    ]
    norris = laps.get(entry__car_number=4)
    assert len(norris.samples["speed"]) == 294
    assert norris.samples["t"][0] >= 0
    assert norris.samples["t"][-1] <= norris.lap_time_s
    assert len(norris.positions["x"]) == len(norris.positions["t"])


def test_ingest_telemetry_skips_laps_already_stored(seeded: None) -> None:
    sources = build_fixture_sources()

    stored = telemetry.ingest_telemetry(hungary(), sources, NOW, cars={4, 81, 63})

    assert stored == 0


def test_ingest_telemetry_skips_cars_without_enough_samples(seeded: None) -> None:
    TelemetryLap.objects.all().delete()
    sources = build_fixture_sources()

    with patch.object(sources.timing, "car_data", return_value=[]):
        stored = telemetry.ingest_telemetry(hungary(), sources, NOW, cars={4})

    assert stored == 0


def test_ingest_telemetry_needs_an_openf1_session(seeded: None) -> None:
    session = hungary()
    session.openf1_session_key = None

    assert telemetry.ingest_telemetry(session, build_fixture_sources(), NOW) == 0


def test_fastest_clean_laps_ignore_pit_and_first_laps(seeded: None) -> None:
    laps = {lap.entry.car_number: lap for lap in telemetry.fastest_clean_laps(hungary())}

    assert laps[4].lap_number == 57
    assert all(not lap.is_pit_in_lap and not lap.is_pit_out_lap for lap in laps.values())
    assert all(lap.lap_number > 1 for lap in laps.values())


def test_missing_telemetry_lists_timed_races_without_it(seeded: None) -> None:
    missing = list(telemetry.missing_telemetry().values_list("event__round", flat=True))

    assert 14 not in missing
    assert set(missing) == {4, 16}


def test_refresh_recent_queues_a_few_telemetry_backfills(seeded: None) -> None:
    with (
        patch.object(tasks.ingest_session, "delay"),
        patch.object(tasks.ingest_season_results, "delay"),
        patch.object(tasks.ingest_telemetry, "delay") as telemetry_delay,
        patch.object(tasks, "_sync_calendar_if_stale"),
    ):
        tasks.refresh_recent(NOW.isoformat())

    queued = {c.args[0] for c in telemetry_delay.call_args_list}
    assert queued == set(telemetry.missing_telemetry().values_list("pk", flat=True))


def test_ingest_telemetry_task_and_command(seeded: None, settings: Any) -> None:
    settings.RACEDATA = {**settings.RACEDATA, "MODE": "fixtures"}
    out = StringIO()

    with patch.object(telemetry, "ingest_telemetry", return_value=3) as ingest:
        assert tasks.ingest_telemetry.delay(hungary().pk).get() == 3
        call_command("ingest_telemetry", "--session", str(hungary().pk), "--sync", stdout=out)
    with patch.object(tasks.ingest_telemetry, "delay") as delay:
        call_command("ingest_telemetry", stdout=out)
        call_command("ingest_telemetry", "--season", "2025", stdout=out)

    assert ingest.call_count == 2
    assert delay.call_count == 2 + 3
    assert "3 laps stored" in out.getvalue()


def test_telemetry_list_is_fastest_first(seeded: None) -> None:
    body = get(f"sessions/{hungary().pk}/telemetry")

    assert [lap["entry"]["driver"]["code"] for lap in body] == ["RUS", "PIA", "NOR"]
    assert body[0]["lap_time_s"] == pytest.approx(79.409)


def test_telemetry_compare_aligns_laps_and_finds_braking_zones(seeded: None) -> None:
    body = get(f"sessions/{hungary().pk}/telemetry/compare", cars="4,81")

    assert body["length_m"] == pytest.approx(4343, abs=5)
    norris, piastri = body["cars"]
    assert norris["car_number"] == 4
    assert len(norris["speed_kph"]) == body["points"] == len(piastri["delta_s"])
    assert norris["delta_s"][-1] == 0
    assert piastri["delta_s"][-1] == pytest.approx(79.412 - 79.918, abs=0.05)
    assert 8 <= len(norris["braking_zones"]) <= 12
    first = norris["braking_zones"][0]
    assert first["entry_kph"] > 250
    assert first["min_kph"] < 120
    assert norris["max_speed_kph"] > 280


def test_telemetry_compare_rejects_unknown_cars_and_bad_input(seeded: None) -> None:
    session = hungary().pk

    assert get(f"sessions/{session}/telemetry/compare", 404, cars="16")["status"] == 404
    assert get(f"sessions/{session}/telemetry/compare", 400, cars="4,x")["status"] == 400
    assert get(f"sessions/{session}/telemetry/compare", 400, cars="4,81,63,16")["status"] == 400


def test_telemetry_compare_refuses_a_broken_lap(seeded: None) -> None:
    lap = TelemetryLap.objects.get(entry__session=hungary(), entry__car_number=4)
    lap.samples = {**lap.samples, "t": lap.samples["t"][::-1]}
    lap.save()

    body = get(f"sessions/{hungary().pk}/telemetry/compare", 400, cars="4")

    assert "time order" in str(body)

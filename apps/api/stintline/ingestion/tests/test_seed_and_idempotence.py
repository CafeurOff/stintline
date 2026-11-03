"""End-to-end ingestion of the recorded 2025 reference races."""

from io import StringIO

import pytest
from django.core.management import call_command

from stintline.racing.models import (
    DriverPortrait,
    Event,
    Lap,
    PitStop,
    RaceControlMessage,
    Session,
    SessionEntry,
    SessionKind,
    Stint,
    TrackStatus,
    WeatherSample,
)

pytestmark = pytest.mark.django_db

TABLES = (
    DriverPortrait,
    Event,
    Session,
    SessionEntry,
    Lap,
    Stint,
    PitStop,
    RaceControlMessage,
    WeatherSample,
    TrackStatus,
)


def row_counts() -> dict[str, int]:
    return {model.__name__: model.objects.count() for model in TABLES}


def seed() -> str:
    out = StringIO()
    call_command("seed_demo", stdout=out)
    return out.getvalue()


def test_seed_demo_loads_three_reference_races() -> None:
    output = seed()

    assert "Demo data loaded (3 races)" in output
    races = Session.objects.filter(kind=SessionKind.RACE, ingested_at__isnull=False)
    assert sorted(races.values_list("event__name", flat=True)) == [
        "Bahrain Grand Prix",
        "Hungarian Grand Prix",
        "Italian Grand Prix",
    ]
    assert Event.objects.filter(season__year=2025).count() == 24  # full calendar
    timed = SessionEntry.objects.filter(laps__isnull=False).values("session").distinct()
    assert timed.count() == 3
    race_results = SessionEntry.objects.filter(session__kind=SessionKind.RACE)
    assert race_results.values("session").distinct().count() == 24  # every 2025 result
    assert Lap.objects.count() == 1129 + 1369 + 976
    assert PitStop.objects.count() == 42 + 29 + 19
    assert DriverPortrait.objects.count() == 21  # the whole 2025 grid


def test_seed_demo_is_idempotent() -> None:
    seed()
    first = row_counts()

    seed()

    assert row_counts() == first


def test_entries_join_timing_and_classification_on_car_number() -> None:
    seed()

    norris = SessionEntry.objects.get(
        session__event__round=14, session__kind=SessionKind.RACE, driver__ref="norris"
    )
    assert norris.car_number == 4
    assert norris.finish_position == 1
    assert norris.team.ref == "mclaren"
    assert len(norris.team_colour) == 6
    assert norris.laps.count() == 70


def test_pit_in_laps_and_pit_stop_enrichment() -> None:
    seed()

    stop = (
        PitStop.objects.select_related("entry__driver")
        .filter(entry__session__event__round=14)
        .order_by("occurred_at")
        .first()
    )
    assert stop is not None
    assert stop.reported_duration_s is not None
    assert stop.stop_number == 1
    lap = Lap.objects.get(entry=stop.entry, lap_number=stop.lap_number)
    assert lap.is_pit_in_lap
    assert Lap.objects.get(entry=stop.entry, lap_number=stop.lap_number + 1).is_pit_out_lap
    assert Lap.objects.filter(is_pit_in_lap=True).count() == PitStop.objects.count()


def test_bahrain_safety_car_is_stored_as_track_status() -> None:
    seed()

    statuses = TrackStatus.objects.filter(session__event__round=4)
    assert [(s.status, s.lap_start, s.lap_end) for s in statuses] == [("SC", 32, 35)]
    assert not TrackStatus.objects.filter(session__event__round=14).exists()


def test_stints_cover_compounds_and_new_tyres() -> None:
    seed()

    stints = Stint.objects.filter(entry__session__event__round=14)
    assert set(stints.values_list("compound", flat=True)) <= {"SOFT", "MEDIUM", "HARD"}
    assert stints.filter(tyre_age_at_start=0).exists()

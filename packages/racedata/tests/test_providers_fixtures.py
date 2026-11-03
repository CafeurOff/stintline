"""Parsing of real recorded payloads (2025 Bahrain, Hungary and Italy Grands Prix)."""

from datetime import UTC, datetime

import pytest

from racedata.matching import match_sessions
from racedata.models import Compound, EventFormat, SessionKind
from racedata.sources import Sources

BAHRAIN, HUNGARY, ITALY = 10014, 9928, 9912


def test_season_calendar_parses_rounds_and_utc_schedule(sources: Sources) -> None:
    events = {e.round: e for e in sources.schedule.season_events(2025)}

    bahrain = events[4]
    assert bahrain.name == "Bahrain Grand Prix"
    assert bahrain.circuit.circuit_id == "bahrain"
    assert bahrain.format is EventFormat.CONVENTIONAL
    race = next(s for s in bahrain.sessions if s.kind is SessionKind.RACE)
    assert race.starts_at == datetime(2025, 4, 13, 15, 0, tzinfo=UTC)
    assert {s.kind for s in bahrain.sessions} >= {SessionKind.PRACTICE_1, SessionKind.QUALIFYING}
    assert any(e.format is EventFormat.SPRINT for e in events.values())


def test_race_sessions_are_matched_to_the_calendar(sources: Sources) -> None:
    events = {e.round: e for e in sources.schedule.season_events(2025)}
    races = sources.timing.sessions(2025, SessionKind.RACE)

    keys = {r: match_sessions(events[r], races)[SessionKind.RACE].session_key for r in (4, 14, 16)}

    assert keys == {4: BAHRAIN, 14: HUNGARY, 16: ITALY}


def test_laps_are_parsed_with_null_durations_kept(sources: Sources) -> None:
    laps = sources.timing.laps(HUNGARY)

    assert len(laps) == 1369
    assert sum(lap.lap_time_s is None for lap in laps) == 1
    assert sum(lap.is_pit_out_lap for lap in laps) == 29
    first = next(lap for lap in laps if lap.driver_number == 16 and lap.lap_number == 1)
    assert first.lap_time_s == pytest.approx(87.745)
    assert first.started_at is not None
    assert first.started_at.tzinfo is UTC


def test_stints_compounds_and_ages(sources: Sources) -> None:
    stints = sources.timing.stints(HUNGARY)

    assert {s.compound for s in stints} <= {Compound.SOFT, Compound.MEDIUM, Compound.HARD}
    assert all(s.stint_number >= 1 for s in stints)
    assert any(s.tyre_age_at_start == 0 for s in stints)


def test_pit_lane_and_stationary_durations_are_separate(sources: Sources) -> None:
    pits = sources.timing.pit(HUNGARY)

    assert len(pits) == 29
    assert all(p.pit_lane_duration_s is None or p.pit_lane_duration_s > 15 for p in pits)


def test_drivers_team_colour_and_no_media_urls(sources: Sources) -> None:
    drivers = sources.timing.drivers(HUNGARY)

    verstappen = next(d for d in drivers if d.driver_number == 1)
    assert verstappen.acronym == "VER"
    assert verstappen.team_colour == "4781D7"
    assert not hasattr(verstappen, "headshot_url")


def test_weather_and_race_control(sources: Sources) -> None:
    weather = sources.timing.weather(HUNGARY)
    messages = sources.timing.race_control(BAHRAIN)

    assert len(weather) == 136
    assert weather[0].track_temperature_c == pytest.approx(35.9)
    assert any(m.category == "SafetyCar" for m in messages)


def test_results_use_the_car_number_raced_that_weekend(sources: Sources) -> None:
    results = sources.results.results(2025, 14, SessionKind.RACE)

    norris = next(r for r in results if r.driver_id == "norris")
    assert norris.car_number == 4  # permanentNumber in the payload reflects a later season
    assert norris.position == 1
    assert norris.points == 25.0
    assert len(results) == 20


def test_results_for_non_race_sessions_are_empty(sources: Sources) -> None:
    assert sources.results.results(2025, 14, SessionKind.QUALIFYING) == []


def test_jolpica_pit_stops(sources: Sources) -> None:
    stops = sources.results.pit_stops(2025, 14)

    assert len(stops) == 29
    first = stops[0]
    assert first.driver_id == "hulkenberg"
    assert first.duration_s == pytest.approx(21.594)
    assert first.local_time == "15:10:20"

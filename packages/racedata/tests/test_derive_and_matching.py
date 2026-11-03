from datetime import UTC, date, datetime, timedelta

import pytest

from racedata.derive import reference_lap, track_status_periods
from racedata.matching import match_sessions
from racedata.models import (
    CircuitInfo,
    EventFormat,
    EventInfo,
    LapRecord,
    PitRecord,
    RaceControlRecord,
    ScheduledSession,
    SessionKind,
    TimingSession,
    TrackStatusKind,
)
from racedata.providers.openf1 import _openf1_instant
from racedata.sources import Sources

T0 = datetime(2025, 1, 1, 14, 0, tzinfo=UTC)


def msg(
    minute: int,
    lap: int,
    category: str,
    message: str,
    *,
    flag: str | None = None,
    scope: str | None = None,
) -> RaceControlRecord:
    return RaceControlRecord(
        occurred_at=T0 + timedelta(minutes=minute),
        lap_number=lap,
        category=category,
        flag=flag,
        scope=scope,
        sector=None,
        driver_number=None,
        message=message,
    )


def test_bahrain_safety_car_is_reconstructed(sources: Sources) -> None:
    periods = track_status_periods(sources.timing.race_control(10014))

    assert len(periods) == 1
    sc = periods[0]
    assert sc.status is TrackStatusKind.SAFETY_CAR
    assert (sc.lap_start, sc.lap_end) == (32, 35)
    assert sc.ended_at is not None


def test_races_without_neutralisation_have_no_periods(sources: Sources) -> None:
    assert track_status_periods(sources.timing.race_control(9928)) == []


def test_vsc_upgraded_to_sc_then_red_flag_and_restart() -> None:
    periods = track_status_periods(
        [
            msg(0, 10, "SafetyCar", "VIRTUAL SAFETY CAR DEPLOYED"),
            msg(2, 11, "SafetyCar", "SAFETY CAR DEPLOYED"),
            msg(3, 11, "Flag", "YELLOW IN TRACK SECTOR 4", flag="CLEAR", scope="Sector"),
            msg(5, 12, "Flag", "RED FLAG", flag="RED", scope="Track"),
            msg(40, 12, "Flag", "GREEN LIGHT - PIT EXIT OPEN", flag="GREEN", scope="Track"),
        ]
    )

    assert [(p.status, p.lap_start, p.lap_end) for p in periods] == [
        (TrackStatusKind.VIRTUAL_SAFETY_CAR, 10, 11),
        (TrackStatusKind.SAFETY_CAR, 11, 12),
        (TrackStatusKind.RED_FLAG, 12, 12),
    ]


def test_vsc_ending_closes_only_a_vsc_and_open_periods_stay_open() -> None:
    periods = track_status_periods(
        [
            msg(0, 5, "SafetyCar", "VIRTUAL SAFETY CAR DEPLOYED"),
            msg(1, 5, "SafetyCar", "VIRTUAL SAFETY CAR ENDING"),
            msg(9, 20, "SafetyCar", "SAFETY CAR DEPLOYED"),
            msg(10, 20, "SafetyCar", "VIRTUAL SAFETY CAR ENDING"),
            msg(11, 21, "Flag", "BLUE FLAG", flag="BLUE", scope="Driver"),
        ]
    )

    assert periods[0].status is TrackStatusKind.VIRTUAL_SAFETY_CAR
    assert periods[0].lap_end == 5
    assert periods[1].status is TrackStatusKind.SAFETY_CAR
    assert periods[1].ended_at is None


def make_event(starts_at: datetime | None) -> EventInfo:
    return EventInfo(
        season=2025,
        round=1,
        name="Test Grand Prix",
        race_date=date(2025, 1, 1),
        format=EventFormat.CONVENTIONAL,
        circuit=CircuitInfo(circuit_id="c", name="C", locality="L", country="X"),
        sessions=(
            ScheduledSession(kind=SessionKind.RACE, starts_at=starts_at),
            ScheduledSession(kind=SessionKind.QUALIFYING, starts_at=None),
        ),
    )


def timing(key: int, kind: SessionKind, starts_at: datetime) -> TimingSession:
    return TimingSession(
        session_key=key,
        meeting_key=1,
        kind=kind,
        name=kind.value,
        starts_at=starts_at,
        ends_at=None,
        circuit_key=None,
        circuit_short_name=None,
        country_name=None,
        year=2025,
    )


def test_match_sessions_picks_closest_same_kind_within_tolerance() -> None:
    event = make_event(T0)
    candidates = [
        timing(1, SessionKind.RACE, T0 + timedelta(hours=5)),
        timing(2, SessionKind.RACE, T0 + timedelta(hours=1)),
        timing(3, SessionKind.QUALIFYING, T0),
        timing(4, SessionKind.RACE, T0 + timedelta(days=7)),
    ]

    matched = match_sessions(event, candidates)

    assert matched == {SessionKind.RACE: candidates[1]}


def test_match_sessions_ignores_unscheduled_and_distant_sessions() -> None:
    assert match_sessions(make_event(None), [timing(1, SessionKind.RACE, T0)]) == {}
    assert (
        match_sessions(make_event(T0), [timing(1, SessionKind.RACE, T0 + timedelta(days=3))]) == {}
    )


def timed_lap(car: int, number: int, seconds: float | None, *, pit_out: bool = False) -> LapRecord:
    return LapRecord(
        driver_number=car,
        lap_number=number,
        lap_time_s=seconds,
        sector_1_s=None,
        sector_2_s=None,
        sector_3_s=None,
        is_pit_out_lap=pit_out,
        started_at=datetime(2025, 6, 1, 13, number, tzinfo=UTC),
        speed_trap_kph=None,
    )


def test_reference_lap_skips_lap_one_and_pit_laps() -> None:
    laps = [
        timed_lap(1, 1, 70.0),
        timed_lap(1, 5, 80.5),
        timed_lap(1, 6, 79.0, pit_out=True),
        timed_lap(2, 7, 78.0),
        timed_lap(2, 8, 81.0),
        timed_lap(3, 9, None),
    ]
    pits = [
        PitRecord(
            driver_number=2,
            lap_number=7,
            occurred_at=datetime(2025, 6, 1, 13, 7, tzinfo=UTC),
            pit_lane_duration_s=None,
            stationary_duration_s=None,
        )
    ]

    chosen = reference_lap(laps, pits)

    assert chosen is not None
    assert (chosen.driver_number, chosen.lap_number) == (1, 5)


def test_reference_lap_is_none_without_candidates() -> None:
    assert reference_lap([timed_lap(1, 1, 70.0)], []) is None


def test_location_filter_rejects_naive_datetimes() -> None:
    with pytest.raises(ValueError, match="aware"):
        _openf1_instant(datetime(2025, 6, 1, 13, 0))  # noqa: DTZ001 (naive on purpose)

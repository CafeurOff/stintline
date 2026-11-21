"""The session clock of practice and qualifying replays (ADR 0028)."""

from __future__ import annotations

import datetime as dt
from typing import Any

import pytest
from rest_framework.test import APIClient

from stintline.racing.models import (
    Event,
    Lap,
    QualifyingSegment,
    Session,
    SessionEntry,
    SessionKind,
    Stint,
)
from stintline.racing.tests.factories import SessionEntryFactory, SessionFactory

pytestmark = pytest.mark.django_db

T0 = dt.datetime(2025, 6, 1, 13, tzinfo=dt.UTC)


def get(path: str, status: int = 200) -> Any:
    response = APIClient().get(f"/api/v1/{path}")
    assert response.status_code == status, response.content
    return response.json()


def lap(
    entry: SessionEntry, number: int, start_s: float, time_s: float | None, **flags: Any
) -> Lap:
    return Lap.objects.create(
        entry=entry,
        lap_number=number,
        started_at=T0 + dt.timedelta(seconds=start_s),
        lap_time_s=time_s,
        sector_1_s=None if time_s is None else time_s / 3,
        **flags,
    )


def qualifying(**entry: Any) -> tuple[Session, SessionEntry]:
    session = SessionFactory.create(
        kind=SessionKind.QUALIFYING, starts_at=T0, ends_at=T0 + dt.timedelta(hours=1)
    )
    return session, SessionEntryFactory.create(session=session, car_number=4, **entry)


def test_laps_are_placed_on_the_session_clock_with_their_tyres() -> None:
    session, entry = qualifying()
    Stint.objects.create(
        entry=entry, stint_number=1, compound="SOFT", lap_start=1, lap_end=3, tyre_age_at_start=2
    )
    lap(entry, 1, 300.0, None, is_pit_out_lap=True)
    lap(entry, 2, 395.0, 80.0)
    lap(entry, 3, 475.0, None, is_pit_in_lap=True)
    lap(entry, 5, 1200.0, 79.0, is_deleted=True)

    data = get(f"sessions/{session.pk}/timeline")

    assert data["starts_at"].startswith("2025-06-01T13:00:00")
    laps = data["cars"][0]["laps"]
    assert [(lp["lap"], lp["start_s"], lp["end_s"]) for lp in laps] == [
        (1, 300.0, 395.0),  # out lap without a time: ends when the next lap starts
        (2, 395.0, 475.0),
        (3, 475.0, None),  # in lap without a time, no next lap: unknown
        (5, 1200.0, 1279.0),
    ]
    assert (laps[1]["compound"], laps[1]["tyre_age"]) == ("SOFT", 3)
    assert laps[3]["compound"] is None
    assert laps[0]["pit_out"]
    assert laps[2]["pit_in"]
    assert laps[3]["deleted"]
    assert data["duration_s"] == 3600.0


def test_qualifying_segments_list_who_was_knocked_out() -> None:
    session, _ = qualifying(finish_position=1, q1_s=80.0, q2_s=79.5, q3_s=79.0)
    SessionEntryFactory.create(
        session=session, car_number=10, finish_position=12, q1_s=80.1, q2_s=79.9
    )
    SessionEntryFactory.create(session=session, car_number=11, finish_position=16, q1_s=80.6)
    SessionEntryFactory.create(session=session, car_number=12, finish_position=None)  # no time
    for entry in session.entries.all():
        lap(entry, 1, 60.0, 80.0)
    for number, start in ((1, 0), (2, 1500), (3, 2900)):
        QualifyingSegment.objects.create(
            session=session,
            number=number,
            started_at=T0 + dt.timedelta(seconds=start),
            ended_at=T0 + dt.timedelta(seconds=start + 1080),
        )

    segments = get(f"sessions/{session.pk}/timeline")["segments"]

    assert [(s["number"], s["start_s"], s["end_s"]) for s in segments] == [
        (1, 0.0, 1080.0),
        (2, 1500.0, 2580.0),
        (3, 2900.0, 3980.0),
    ]
    assert [s["eliminated"] for s in segments] == [[11, 12], [10], []]


def test_no_knock_outs_are_claimed_without_segment_times() -> None:
    session, entry = qualifying()
    lap(entry, 1, 60.0, 80.0)
    QualifyingSegment.objects.create(session=session, number=1, started_at=T0, ended_at=T0)

    segments = get(f"sessions/{session.pk}/timeline")["segments"]

    assert segments[0]["eliminated"] == []


def test_practice_has_no_segments_and_a_session_without_laps_is_404() -> None:
    practice = SessionFactory.create(kind=SessionKind.PRACTICE_1, starts_at=T0, ends_at=T0)
    entry = SessionEntryFactory.create(session=practice)

    get(f"sessions/{practice.pk}/timeline", status=404)
    lap(entry, 1, 10.0, 90.0)
    data = get(f"sessions/{practice.pk}/timeline")

    assert data["segments"] == []
    assert data["duration_s"] == 100.0  # the last lap ends after the scheduled end


def test_race_timeline_works_too(seeded: None) -> None:
    race = Event.objects.get(season__year=2025, round=14).sessions.get(kind="R")

    data = get(f"sessions/{race.pk}/timeline")

    assert len(data["cars"]) == 20
    assert data["segments"] == []


def test_strategy_endpoints_refuse_practice_with_a_clear_problem() -> None:
    practice = SessionFactory.create(kind=SessionKind.PRACTICE_2)

    problem = get(f"sessions/{practice.pk}/replay", status=400)

    assert "races and sprints" in str(problem)


def test_deleted_laps_never_count_as_a_best_lap() -> None:
    session, entry = qualifying()
    lap(entry, 2, 100.0, 78.0, is_deleted=True)
    lap(entry, 3, 200.0, 79.0)

    rows = get(f"sessions/{session.pk}/sectors")

    assert rows[0]["best_lap_s"] == 79.0


def test_flags_race_control_and_weather_share_the_session_clock() -> None:
    session, entry = qualifying()
    lap(entry, 1, 60.0, 80.0)
    session.track_statuses.create(
        status="RED", started_at=T0 + dt.timedelta(seconds=600), ended_at=None
    )
    session.race_control.create(
        occurred_at=T0 + dt.timedelta(seconds=600),
        category="Flag",
        flag="RED",
        message="RED FLAG",
        digest="a",
    )
    session.weather.create(
        sampled_at=T0 + dt.timedelta(seconds=30), air_temperature_c=21.5, rainfall=True
    )

    data = get(f"sessions/{session.pk}/timeline")

    assert data["flags"] == [{"status": "RED", "start_s": 600.0, "end_s": None}]
    assert data["race_control"][0]["at_s"] == 600.0
    assert data["race_control"][0]["message"] == "RED FLAG"
    assert data["weather"][0]["at_s"] == 30.0
    assert data["weather"][0]["rainfall"] is True


@pytest.mark.parametrize(
    ("year", "ends_in_h", "with_lap", "expected"),
    [
        (2025, -2, True, "ready"),
        (2025, -2, False, "pending"),
        (2025, 2, False, "upcoming"),
        (2019, -2, False, "none"),
    ],
)
def test_event_sessions_say_whether_their_replay_opens(
    year: int, ends_in_h: int, with_lap: bool, expected: str
) -> None:
    now = dt.datetime.now(dt.UTC)
    session = SessionFactory.create(
        kind=SessionKind.PRACTICE_1,
        event__season__year=year,
        starts_at=now + dt.timedelta(hours=ends_in_h - 1),
        ends_at=now + dt.timedelta(hours=ends_in_h),
    )
    if with_lap:
        lap(SessionEntryFactory.create(session=session), 1, 10.0, 90.0)

    event = get(f"events/{session.event_id}")

    assert event["sessions"][0]["replay"] == expected

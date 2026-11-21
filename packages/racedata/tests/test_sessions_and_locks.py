"""Practice and qualifying data (ADR 0028): session results, deleted laps, knock-out
segments, and OpenF1's live-session lock."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import pytest

from racedata import LiveSessionLockedError, UnauthorizedError
from racedata.derive import deleted_laps, qualifying_segments
from racedata.fixtures import FIXTURES_ROOT
from racedata.http import HttpClient
from racedata.models import RaceControlRecord
from racedata.providers.openf1 import OpenF1Source, is_live_session_lock
from racedata.testing import FakeClock, sequence_transport

LOCK_FIXTURE = FIXTURES_ROOT / "openf1" / "_errors" / "live_session_lock.json"
T0 = datetime(2025, 8, 2, 14, 0, tzinfo=UTC)


def openf1(*responses: httpx.Response) -> tuple[OpenF1Source, list[httpx.Request]]:
    transport, calls = sequence_transport(*responses)
    client = HttpClient("openf1", "https://api.test/v1", transport=transport, clock=FakeClock())
    return OpenF1Source(client), calls


def recorded_lock() -> httpx.Response:
    return httpx.Response(401, content=Path(LOCK_FIXTURE).read_bytes())


def rc(minute: int, message: str, *, phase: int | None = None, flag: str | None = None) -> Any:
    return RaceControlRecord(
        occurred_at=T0 + timedelta(minutes=minute),
        lap_number=None,
        category="Other",
        flag=flag,
        scope=None,
        sector=None,
        driver_number=None,
        message=message,
        qualifying_phase=phase,
    )


# --- live-session lock -------------------------------------------------------------------


def test_openf1_live_session_401_raises_live_session_locked() -> None:
    source, calls = openf1(recorded_lock())

    with pytest.raises(LiveSessionLockedError):
        source.laps(9928)
    assert len(calls) == 1  # never retried: the lock lasts until the session ends


def test_openf1_other_401_stays_unauthorized() -> None:
    source, _ = openf1(httpx.Response(401, json={"detail": "Invalid API key"}))

    with pytest.raises(UnauthorizedError) as caught:
        source.laps(9928)
    assert not isinstance(caught.value, LiveSessionLockedError)
    assert caught.value.detail == "Invalid API key"


def test_unauthorized_detail_falls_back_to_the_body_text() -> None:
    source, _ = openf1(httpx.Response(401, content=b"<html>login</html>"))

    with pytest.raises(UnauthorizedError) as caught:
        source.sessions(2026)
    assert caught.value.detail == "<html>login</html>"


@pytest.mark.parametrize(
    ("detail", "expected"),
    [
        (json.loads(LOCK_FIXTURE.read_text())["detail"], True),
        ("Live F1 session in progress", True),
        ("Not authenticated", False),
    ],
)
def test_is_live_session_lock(detail: str, expected: bool) -> None:
    assert is_live_session_lock(detail) is expected


# --- session results ---------------------------------------------------------------------


def test_session_result_practice_and_qualifying_shapes() -> None:
    rows = [
        {"driver_number": 4, "position": 1, "duration": 75.123, "number_of_laps": 24},
        {
            "driver_number": 1,
            "position": 2,
            "duration": [76.1, 75.5, 75.2],
            "number_of_laps": 18,
        },
        {"driver_number": 22, "position": 16, "duration": [77.0, None, None]},
        {"driver_number": 31, "position": None, "duration": None, "dns": True},
        {"position": 3},  # malformed: skipped
    ]
    source, calls = openf1(httpx.Response(200, json=rows))

    results = source.session_result(9999)

    assert calls[0].url.params["session_key"] == "9999"
    by_car = {r.driver_number: r for r in results}
    assert set(by_car) == {4, 1, 22, 31}
    assert by_car[4].best_lap_s == 75.123
    assert by_car[4].segment_times_s == ()
    assert by_car[4].laps == 24
    assert by_car[1].segment_times_s == (76.1, 75.5, 75.2)
    assert by_car[1].best_lap_s == 75.2
    assert by_car[22].segment_times_s == (77.0, None, None)
    assert by_car[31].best_lap_s is None
    assert by_car[31].dns is True


def test_race_control_keeps_the_qualifying_phase() -> None:
    row = {"date": "2025-08-02T14:00:00+00:00", "category": "Flag", "flag": "GREEN"}
    source, _ = openf1(httpx.Response(200, json=[{**row, "qualifying_phase": 2}, row]))

    phases = [m.qualifying_phase for m in source.race_control(1)]

    assert phases == [2, None]


# --- deleted laps ------------------------------------------------------------------------


def test_deleted_laps_reads_both_wordings() -> None:
    messages = [
        rc(1, "CAR 44 (HAM) TIME 1:29.374 DELETED - TRACK LIMITS AT TURN 4 LAP 2 15:08:15"),
        rc(2, "CAR 14 (ALO) LAP DELETED - TRACK LIMITS AT TURN 6 LAP 7 14:22:01"),
        rc(3, "TRACK LIMITS - CAR 1 (VER) WILL BE INVESTIGATED"),
    ]

    assert deleted_laps(messages) == {(44, 2), (14, 7)}


def test_deleted_lap_reinstated_later_counts_again() -> None:
    messages = [
        rc(5, "CAR 16 (LEC) TIME 1:18.900 REINSTATED LAP 9"),
        rc(1, "CAR 16 (LEC) TIME 1:18.900 DELETED - TRACK LIMITS AT TURN 4 LAP 9 15:08:15"),
    ]

    assert deleted_laps(messages) == set()


def test_unknown_deletion_wording_leaves_the_lap_counted() -> None:
    assert deleted_laps([rc(1, "LAP 4 OF CAR 4 CANCELLED")]) == set()


# --- qualifying segments -----------------------------------------------------------------


def test_qualifying_segments_run_to_their_chequered_flag() -> None:
    messages = [
        rc(0, "GREEN LIGHT - PIT EXIT OPEN", phase=1),
        rc(18, "CHEQUERED FLAG", phase=1, flag="CHEQUERED"),
        rc(19, "CAR 4 (NOR) TIME DELETED ... LAP 5", phase=1),
        rc(22, "START OF Q2 WILL BE DELAYED", phase=2),
        rc(26, "GREEN LIGHT - PIT EXIT OPEN", phase=2),
        rc(41, "CHEQUERED FLAG", phase=2, flag="CHEQUERED"),
        rc(49, "GREEN LIGHT - PIT EXIT OPEN", phase=3),
        rc(60, "DRS ENABLED", phase=3),
        rc(70, "RISK OF RAIN", phase=None),
    ]

    segments = qualifying_segments(messages)

    assert [s.number for s in segments] == [1, 2, 3]
    assert segments[0].started_at == T0
    assert segments[0].ended_at == T0 + timedelta(minutes=18)
    assert segments[1].started_at == T0 + timedelta(minutes=26)  # the green light, not the notice
    assert segments[2].ended_at == T0 + timedelta(minutes=60)  # no flag: last message


def test_practice_has_no_segments() -> None:
    assert qualifying_segments([rc(0, "GREEN LIGHT - PIT EXIT OPEN")]) == []

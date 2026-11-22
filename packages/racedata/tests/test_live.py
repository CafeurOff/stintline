"""Live timing: framing, merging, the derived view, the client loop and recordings.

The snapshot is a trimmed reply of the real hub (Mexico City 2026, after the race).
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from racedata.fixtures import FIXTURES_ROOT
from racedata.live import client, recording
from racedata.live.merge import LiveState, merge
from racedata.live.protocol import (
    Closed,
    Feed,
    Snapshot,
    classify,
    decode,
    encode,
    subscribe,
)
from racedata.live.snapshot import SessionHistory, gap, lap_seconds, session_start, view

SNAPSHOT = json.loads(
    (FIXTURES_ROOT / "livetiming" / "snapshot-mexico-2026.json").read_text(encoding="utf-8")
)


def state() -> LiveState:
    live = LiveState()
    live.apply_snapshot(SNAPSHOT)
    return live


# ------------------------------------------------------------------ protocol


def test_frames_carry_several_messages() -> None:
    frame = encode({"type": 6}) + encode({"type": 1, "target": "feed", "arguments": ["A", {}]})

    assert [m["type"] for m in decode(frame)] == [6, 1]


def test_hub_messages_become_events() -> None:
    snapshot = classify({"type": 3, "invocationId": "subscribe", "result": {"LapCount": {}}})
    feed = classify(
        {"type": 1, "target": "feed", "arguments": ["LapCount", {"CurrentLap": 3}, "t"]}
    )

    assert snapshot == Snapshot({"LapCount": {}})
    assert feed == Feed("LapCount", {"CurrentLap": 3}, "t")
    assert classify({"type": 7, "error": "bye"}) == Closed("bye")
    assert classify({"type": 6}) is None
    assert subscribe(("A",))["arguments"] == [["A"]]


# ------------------------------------------------------------------ merge


def test_nested_dicts_merge_and_index_keys_update_lists() -> None:
    target: dict[str, Any] = {"Lines": {"1": {"Sectors": [{"Value": "27.1"}, {"Value": ""}]}}}

    merge(target, {"Lines": {"1": {"Sectors": {"1": {"Value": "31.2"}, "3": {"Value": "x"}}}}})

    sectors = target["Lines"]["1"]["Sectors"]
    assert [s and s["Value"] for s in sectors] == ["27.1", "31.2", None, "x"]


def test_deleted_keys_are_removed_and_scalars_replaced() -> None:
    target: dict[str, Any] = {"a": 1, "b": {"c": 2}, "d": 3}

    merge(target, {"_deleted": ["d"], "a": 5, "b": "flat"})

    assert target == {"a": 5, "b": "flat"}


def test_feed_updates_change_the_view() -> None:
    live = state()

    live.apply_feed("TimingData", {"Lines": {"44": {"Position": "1"}, "3": {"Position": "2"}}})
    live.apply_feed("TrackStatus", {"Status": "4", "Message": "SCDeployed"})

    result = view(live)
    assert [c.code for c in result.cars[:2]] == ["HAM", "VER"]
    assert result.track_status == "safety_car"


# ------------------------------------------------------------------ view


def test_view_reads_the_session_and_converts_its_start_to_utc() -> None:
    session = view(state()).session

    assert (session.key, session.circuit_key, session.meeting) == (
        11404,
        65,
        "Mexico City Grand Prix",
    )
    assert session.starts_at == datetime(2026, 11, 1, 20, 0, tzinfo=UTC)


def test_view_orders_cars_with_gaps_tyres_and_lap_progress() -> None:
    result = view(state())

    leader, second = result.cars[0], result.cars[1]
    assert (leader.code, leader.position, leader.gap_s) == ("VER", 1, None)
    assert (second.code, second.gap_s) == ("HAM", 0.799)
    assert leader.compound == "SOFT"
    assert leader.tyre_age is not None
    assert leader.tyre_age > 0
    assert 0.0 <= leader.lap_progress <= 1.0
    assert result.lap == result.total_laps == 71


def test_view_links_team_radio_to_the_official_recording() -> None:
    radio = view(state()).team_radio

    assert len(radio) == 3
    assert radio[0].url.startswith("https://livetiming.formula1.com/static/2026/")
    assert radio[0].url.endswith(".mp3")
    assert radio[0].at is not None
    assert radio[-1].at is not None
    assert radio[0].at >= radio[-1].at


def test_view_colours_mini_sectors_and_keeps_sector_times() -> None:
    live = state()
    live.apply_feed(
        "TimingData",
        {
            "Lines": {
                "1": {
                    "Sectors": {
                        "0": {
                            "Value": "26.901",
                            "PersonalFastest": True,
                            "Segments": {"0": {"Status": 2051}, "1": {"Status": 2049}},
                        }
                    }
                }
            }
        },
    )

    car = next(c for c in view(live).cars if c.number == 1)

    first = car.sectors[0]
    assert first.segments[:3] == ["purple", "green", "yellow"]
    assert (first.time_s, first.personal_best, first.overall_best) == (26.901, True, False)
    assert car.sectors[2].segments[-1] == "pit"
    assert car.sectors[1].segments[-1] == "none"
    assert car.grid == 6


STATUS_SERIES = [
    {"Utc": "2026-10-31T17:42:52Z", "TrackStatus": "Yellow"},
    {"Utc": "2026-11-01T20:11:50Z", "TrackStatus": "Yellow"},
    {"Utc": "2026-11-01T20:12:05Z", "TrackStatus": "VSCDeployed"},
    {"Utc": "2026-11-01T20:14:42Z", "TrackStatus": "VSCEnding"},
    {"Utc": "2026-11-01T20:14:53Z", "TrackStatus": "AllClear"},
    {"Utc": "2026-11-01T20:15:00Z", "SessionStatus": "Started"},
    {"Utc": "2026-11-01T21:06:02Z", "TrackStatus": "Red"},
]
LAP_SERIES = [
    {"Utc": "2026-11-01T20:04:50Z", "Lap": 2},
    {"Utc": "2026-11-01T20:10:14Z", "Lap": 6},
    {"Utc": "2026-11-01T20:14:00Z", "Lap": 8},
    {"Utc": "2026-11-01T21:05:00Z", "Lap": 40},
]


def test_timeline_turns_status_changes_into_flag_periods() -> None:
    live = state()
    live.apply_feed("SessionData", {"Series": LAP_SERIES, "StatusSeries": STATUS_SERIES})

    periods = view(live).timeline

    assert [p.status for p in periods] == ["yellow", "virtual_safety_car", "red"]
    vsc = periods[1]
    assert (vsc.start_lap, vsc.end_lap) == (6, 8)
    assert vsc.end_at == datetime(2026, 11, 1, 20, 14, 53, tzinfo=UTC)
    assert periods[-1].end_at is None
    assert periods[-1].start_lap == 40


def test_session_history_keeps_pit_lane_times_once_the_feed_drops_them() -> None:
    live, history = state(), SessionHistory()
    live.apply_feed(
        "PitLaneTimeCollection",
        {"PitTimes": {"44": {"RacingNumber": "44", "Duration": "22.416", "Lap": "18"}}},
    )
    history.update(live)
    live.apply_feed("PitLaneTimeCollection", {"PitTimes": {"_deleted": ["44"]}})
    live.apply_feed(
        "PitLaneTimeCollection",
        {"PitTimes": {"1": {"RacingNumber": "1", "Duration": "", "Lap": "19"}}},
    )
    history.update(live)

    rows = view(live, history).pit_lane

    assert [(r.number, r.lap, r.pit_lane_duration_s) for r in rows] == [(44, 18, 22.416)]


def test_session_history_keeps_one_weather_reading_per_lap() -> None:
    live, history = state(), SessionHistory()
    for lap, air in ((10, "21.0"), (10, "21.4"), (11, "21.8")):
        live.apply_feed("LapCount", {"CurrentLap": lap})
        live.apply_feed("WeatherData", {"AirTemp": air, "Rainfall": "0"})
        history.update(live)

    points = view(live, history).weather_history

    assert [(p.lap, p.air_c, p.rain) for p in points] == [(10, 21.4, False), (11, 21.8, False)]


def test_view_survives_an_empty_state() -> None:
    result = view(LiveState())

    assert result.cars == []
    assert result.session.starts_at is None
    assert result.weather is None
    assert result.timeline == []
    assert result.pit_lane == []
    assert result.weather_history == []


@pytest.mark.parametrize(
    ("text", "seconds"),
    [("1:19.674", 79.674), ("27.481", 27.481), ("", None), ("x", None)],
)
def test_lap_seconds(text: str, seconds: float | None) -> None:
    assert lap_seconds(text) == seconds


@pytest.mark.parametrize(
    ("text", "parsed"),
    [("+0.799", (0.799, 0)), ("1L", (None, 1)), ("+2 LAPS", (None, 2)), ("LAP 71", (None, 0))],
)
def test_gap(text: str, parsed: tuple[float | None, int]) -> None:
    assert gap(text) == parsed


def test_session_start_needs_a_valid_offset() -> None:
    assert session_start({"StartDate": "2026-11-08T14:00:00", "GmtOffset": "x"}) is None
    assert session_start({"StartDate": "bad"}) is None
    assert session_start({"StartDate": "2026-11-08T14:00:00", "GmtOffset": "-03:00:00"}) == (
        datetime(2026, 11, 8, 17, 0, tzinfo=UTC)
    )


# ------------------------------------------------------------------ client


class FakeConnection:
    def __init__(self, frames: list[str | type[BaseException]]) -> None:
        self.frames = frames
        self.sent: list[dict[str, Any]] = []
        self.closed = False

    async def send(self, message: str) -> None:
        self.sent.extend(decode(message))

    async def recv(self) -> str:
        item = self.frames.pop(0)
        if isinstance(item, type):
            raise item()
        return item

    async def close(self) -> None:
        self.closed = True


def frames(*messages: dict[str, Any]) -> list[str | type[BaseException]]:
    return [encode({}), *(encode(m) for m in messages)]


async def collect(events: AsyncIterator[Any]) -> list[Any]:
    return [event async for event in events]


def test_stream_handshakes_subscribes_and_yields_events() -> None:
    connection = FakeConnection(
        [
            *frames(
                {"type": 3, "invocationId": "subscribe", "result": {"LapCount": {}}},
                {"type": 1, "target": "feed", "arguments": ["LapCount", {"CurrentLap": 2}, "t"]},
            ),
            TimeoutError,
            encode({"type": 7}),
        ]
    )

    events = asyncio.run(collect(client.stream(connection, ("LapCount",))))

    assert events == [Snapshot({"LapCount": {}}), Feed("LapCount", {"CurrentLap": 2}, "t")]
    assert [m.get("target") or m.get("protocol") for m in connection.sent[:2]] == [
        "json",
        "Subscribe",
    ]
    assert {"type": 6} in connection.sent  # keep-alive ping after a silent period


def test_stream_raises_on_a_refused_handshake_or_an_error_close() -> None:
    refused = FakeConnection([encode({"error": "nope"})])
    closed = FakeConnection([encode({}), encode({"type": 7, "error": "gone"})])

    with pytest.raises(client.HubError, match="nope"):
        asyncio.run(collect(client.stream(refused)))
    with pytest.raises(client.HubError, match="gone"):
        asyncio.run(collect(client.stream(closed)))


def test_run_forever_reconnects_after_a_failure() -> None:
    received: list[Any] = []
    pauses: list[float] = []
    attempts: Iterator[OSError | FakeConnection] = iter(
        [
            OSError("down"),
            FakeConnection(
                frames({"type": 3, "invocationId": "subscribe", "result": {}}, {"type": 7})
            ),
        ]
    )

    async def connect() -> FakeConnection:
        item = next(attempts)
        if isinstance(item, BaseException):
            raise item
        return item

    async def on_event(event: Any) -> None:
        received.append(event)

    async def sleep(seconds: float) -> None:
        pauses.append(seconds)

    asyncio.run(client.run_forever(on_event, connect=connect, sleep=sleep, max_attempts=2))

    assert received == [Snapshot({})]
    assert pauses == [client.RETRY_DELAYS_S[0], client.RETRY_DELAYS_S[1]]


# ------------------------------------------------------------------ recording


def test_recordings_round_trip_and_replay_with_their_spacing(tmp_path: Path) -> None:
    path = tmp_path / "session.jsonl"
    times = iter([100.0, 104.0, 105.0])
    recorder = recording.Recorder(path, clock=lambda: next(times))
    recorder.write(Snapshot({"LapCount": {"CurrentLap": 1}}))
    recorder.write(Feed("LapCount", {"CurrentLap": 2}, "t"))
    recorder.write(Closed(None))  # not recorded
    recorder.write(Feed("LapCount", {"CurrentLap": 3}, "t"))
    recorder.close()
    with path.open("a", encoding="utf-8") as file:
        file.write("not json\n")
    pauses: list[float] = []

    async def sleep(seconds: float) -> None:
        pauses.append(seconds)

    events = asyncio.run(collect(recording.replay(path, speed=2.0, sleep=sleep)))

    assert [type(e).__name__ for e in events] == ["Snapshot", "Feed", "Feed"]
    assert pauses == [2.0, 0.5]


def test_hub_urls_point_at_the_official_hub_or_at_a_relay() -> None:
    assert client.hub_urls() == (
        "https://livetiming.formula1.com/signalrcore/negotiate",
        "wss://livetiming.formula1.com/signalrcore",
    )
    assert client.hub_urls("https://relay.test/") == (
        "https://relay.test/signalrcore/negotiate",
        "wss://relay.test/signalrcore",
    )
    assert client.hub_urls("http://localhost:8787") == (
        "http://localhost:8787/signalrcore/negotiate",
        "ws://localhost:8787/signalrcore",
    )

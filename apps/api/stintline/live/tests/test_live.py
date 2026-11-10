"""Live mode: rejoin estimates, circuit context, publishing, endpoint, WebSocket, command."""

from __future__ import annotations

import asyncio
import json
from io import StringIO
from pathlib import Path
from typing import Any

import pytest
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.core.cache import cache
from django.core.management import call_command
from rest_framework.test import APIClient

from config.asgi import application
from racedata.fixtures import FIXTURES_ROOT
from racedata.live.protocol import Closed, Feed, Snapshot
from racedata.live.snapshot import LiveCar
from stintline.live.api.views import live_state
from stintline.live.circuit import CircuitContext, circuit_context
from stintline.live.publisher import CACHE_KEY, GROUP, Publisher
from stintline.live.strategy import pit_now, race_gaps
from stintline.racing.models import Session, SessionKind

SNAPSHOT = json.loads(
    (FIXTURES_ROOT / "livetiming" / "snapshot-mexico-2026.json").read_text(encoding="utf-8")
)
CONTEXT = CircuitContext(reference_session_id=7, pit_loss_s=20.0, pit_loss_sigma_s=1.0)


def car(number: int, position: int, gap: float | None, **kw: Any) -> LiveCar:
    base: dict[str, Any] = {
        "number": number,
        "code": f"C{number}",
        "first_name": "",
        "last_name": "",
        "team": "",
        "colour": "",
        "position": position,
        "gap_s": gap,
        "laps_behind": 0,
        "interval_s": None,
        "laps": 30,
        "in_pit": False,
        "pit_out": False,
        "retired": False,
        "stopped": False,
        "pit_stops": 0,
        "last_lap_s": 80.0,
        "best_lap_s": None,
        "compound": "MEDIUM",
        "tyre_age": 10,
        "tyre_new": True,
        "lap_progress": 0.5,
    }
    return LiveCar(**{**base, **kw})


# ------------------------------------------------------------------ strategy


def test_pit_now_places_the_car_behind_everyone_within_the_pit_loss() -> None:
    cars = [car(1, 1, None), car(2, 2, 5.0), car(3, 3, 12.0), car(4, 4, 30.0)]

    result = pit_now(cars, 20.0)

    assert result[1].position == 3  # 0 + 20 s: behind cars at 5 and 12 s
    assert (result[1].ahead, result[1].behind) == (3, 4)
    assert result[1].margin_ahead_s == 8.0
    assert result[1].margin_behind_s == 10.0
    assert result[4].position == 4


def test_pit_now_skips_cars_in_the_pits_or_out_and_counts_lapped_cars() -> None:
    cars = [
        car(1, 1, None),
        car(2, 2, 3.0, in_pit=True),
        car(3, 3, None, retired=True),
        car(4, 4, None, laps_behind=1),
    ]

    result = pit_now(cars, 20.0)

    assert set(result) == {1, 4}
    assert race_gaps(cars)[4] == 80.0
    assert result[1].position == 2  # car 2 is in the pits but still on track ahead


# ------------------------------------------------------------------ circuit


def test_circuit_context_uses_the_latest_stored_race_there(seeded: None) -> None:
    hungary = Session.objects.get(event__season__year=2025, event__round=14, kind=SessionKind.RACE)
    key = hungary.event.circuit.openf1_circuit_key

    context = circuit_context(key)

    assert context.reference_session_id == hungary.pk
    assert context.pit_loss_s is not None
    assert 15 < context.pit_loss_s < 30


def test_unknown_circuit_gives_an_empty_context(db: None) -> None:
    assert circuit_context(None) == CircuitContext(None, None, None)
    assert circuit_context(99999) == CircuitContext(None, None, None)


# ------------------------------------------------------------------ publisher


def publisher(now: list[float]) -> Publisher:
    return Publisher(clock=lambda: now[0], context=lambda key: CONTEXT)


def test_publisher_builds_the_snapshot_with_rejoin_estimates() -> None:
    pub = publisher([100.0])
    pub.apply(Snapshot(SNAPSHOT))

    data = pub.snapshot()

    assert data["session"]["meeting"] == "Mexico City Grand Prix"
    assert data["reference_session_id"] == 7
    assert data["cars"][0]["code"] == "VER"
    assert data["cars"][1]["pit_now"]["position"] >= 2
    assert data["updated_at"] == 100.0


def test_publisher_throttles_and_caches(db: None) -> None:
    now = [100.0]
    pub = publisher(now)
    pub.apply(Snapshot(SNAPSHOT))

    assert pub.publish_if_due() is True
    pub.apply(Feed("LapCount", {"CurrentLap": 3}, "t"))
    assert pub.publish_if_due() is False  # within a second of the last one
    now[0] += 1.5
    assert pub.publish_if_due() is True
    assert pub.publish_if_due() is False  # nothing new
    assert cache.get(CACHE_KEY)["lap"] == 3


def test_publisher_ignores_other_events() -> None:
    pub = publisher([0.0])
    pub.apply(Snapshot({}))
    pub.publish_if_due(force=True)

    pub.apply(Closed(None))

    assert pub.publish_if_due(force=True) is False


# ------------------------------------------------------------------ endpoint


@pytest.mark.parametrize(
    ("status", "state"),
    [("Started", "live"), ("Aborted", "live"), ("Inactive", "waiting"), ("Finalised", "finished")],
)
def test_live_state(status: str, state: str) -> None:
    assert live_state({"session": {"status": status}}) == state
    assert live_state(None) == "offline"


def test_live_endpoint_is_offline_without_the_live_process(db: None) -> None:
    body = APIClient().get("/api/v1/live").json()

    assert body == {"state": "offline", "snapshot": None, "next_session": None}


def test_live_endpoint_serves_the_cached_snapshot(seeded: None) -> None:
    pub = publisher([100.0])
    pub.apply(Snapshot(SNAPSHOT))
    pub.publish_if_due(force=True)

    response = APIClient().get("/api/v1/live")

    assert response["Cache-Control"] == "no-store"
    body = response.json()
    assert body["state"] == "finished"
    assert body["snapshot"]["lap"] == 71
    assert len(body["snapshot"]["team_radio"]) == 3


# ------------------------------------------------------------------ websocket


def test_websocket_sends_the_latest_snapshot_then_updates(db: None) -> None:
    cache.set(CACHE_KEY, {"lap": 1}, 60)

    async def scenario() -> list[Any]:
        communicator = WebsocketCommunicator(application, "/ws/live")
        connected, _ = await communicator.connect()
        assert connected
        first = await communicator.receive_json_from()
        layer = get_channel_layer()
        assert layer is not None
        await layer.group_send(GROUP, {"type": "live.snapshot", "data": {"lap": 2}})
        second = await communicator.receive_json_from()
        await communicator.disconnect()
        return [first, second]

    assert asyncio.run(scenario()) == [{"lap": 1}, {"lap": 2}]


# ------------------------------------------------------------------ command


def test_live_command_replays_a_recording(
    tmp_path: Path, db: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The command publishes from a worker thread: keep the database out of it here
    # (the circuit context is covered above).
    monkeypatch.setattr(
        "stintline.live.management.commands.live.Publisher",
        lambda: Publisher(context=lambda key: CONTEXT),
    )
    path = tmp_path / "weekend.jsonl"
    lines = [
        {"kind": "snapshot", "received_at": 1.0, "data": SNAPSHOT},
        {"kind": "feed", "received_at": 1.0, "args": ["LapCount", {"CurrentLap": 70}, "t"]},
    ]
    path.write_text("".join(json.dumps(line) + "\n" for line in lines), encoding="utf-8")
    out = StringIO()

    call_command("live", "--replay", str(path), "--speed", "100", stdout=out)

    assert "Replay finished" in out.getvalue()
    assert cache.get(CACHE_KEY)["lap"] == 70


def test_live_command_keeps_running_when_it_cannot_record(
    tmp_path: Path, db: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def no_feed(on_event: Any) -> None:
        await on_event(Snapshot(SNAPSHOT))

    blocked = tmp_path / "file"
    blocked.write_text("not a directory", encoding="utf-8")
    monkeypatch.setattr("stintline.live.management.commands.live.run_forever", no_feed)
    monkeypatch.setattr(
        "stintline.live.management.commands.live.Publisher",
        lambda: Publisher(context=lambda key: CONTEXT),
    )
    err = StringIO()

    call_command("live", "--record", str(blocked), stdout=StringIO(), stderr=err)

    assert "continuing without" in err.getvalue()
    assert cache.get(CACHE_KEY)["lap"] == 71

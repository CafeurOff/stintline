"""SignalR Core JSON hub protocol: framing and the few message types the feed uses."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

RECORD_SEPARATOR = "\x1e"
HANDSHAKE: dict[str, Any] = {"protocol": "json", "version": 1}
SUBSCRIBE_ID = "subscribe"

INVOCATION = 1
COMPLETION = 3
PING = 6
CLOSE = 7

TOPICS: tuple[str, ...] = (
    "Heartbeat",
    "SessionInfo",
    "SessionStatus",
    "SessionData",
    "DriverList",
    "ExtrapolatedClock",
    "LapCount",
    "TimingData",
    "TimingAppData",
    "TimingStats",
    "TyreStintSeries",
    "LapSeries",
    "TrackStatus",
    "RaceControlMessages",
    "TeamRadio",
    "WeatherData",
    "PitLaneTimeCollection",
)
"""Topics delivered without authentication (probe of 2026-11-03). ``CarData.z`` and
``Position.z`` are withheld and not needed."""


def encode(message: dict[str, Any]) -> str:
    return json.dumps(message, separators=(",", ":")) + RECORD_SEPARATOR


def decode(frame: str) -> list[dict[str, Any]]:
    """A frame may carry several messages, each terminated by the record separator."""
    out: list[dict[str, Any]] = []
    for part in frame.split(RECORD_SEPARATOR):
        if part.strip():
            message = json.loads(part)
            if isinstance(message, dict):
                out.append(message)
    return out


def subscribe(topics: tuple[str, ...] = TOPICS) -> dict[str, Any]:
    return {
        "type": INVOCATION,
        "invocationId": SUBSCRIBE_ID,
        "target": "Subscribe",
        "arguments": [list(topics)],
    }


@dataclass(frozen=True, slots=True)
class Snapshot:
    """Full state of every subscribed topic (reply to ``Subscribe``)."""

    topics: dict[str, Any]


@dataclass(frozen=True, slots=True)
class Feed:
    """Incremental update of one topic, merged into the snapshot."""

    topic: str
    payload: Any
    timestamp: str


@dataclass(frozen=True, slots=True)
class Closed:
    error: str | None


Event = Snapshot | Feed | Closed


def classify(message: dict[str, Any]) -> Event | None:
    """Turn a hub message into a feed event; pings and unknown messages give ``None``."""
    kind = message.get("type")
    if kind == COMPLETION and message.get("invocationId") == SUBSCRIBE_ID:
        result = message.get("result")
        return Snapshot(result if isinstance(result, dict) else {})
    if kind == INVOCATION and message.get("target") == "feed":
        args = message.get("arguments") or []
        if len(args) >= 2:
            return Feed(str(args[0]), args[1], str(args[2]) if len(args) > 2 else "")
    if kind == CLOSE:
        error = message.get("error")
        return Closed(str(error) if error else None)
    return None

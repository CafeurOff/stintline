"""Record the live feed to JSON lines, and replay a recording as if it were live.

Same format as the 2026 probe: ``{"kind": "snapshot", "received_at": t, "data": {...}}``
and ``{"kind": "feed", "received_at": t, "args": [topic, payload, timestamp]}``.
Recordings are personal (formula1.com terms): never commit or publish a full one.
"""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from pathlib import Path
from typing import IO, Any

from racedata.live.protocol import Event, Feed, Snapshot


class Recorder:
    def __init__(self, path: Path, clock: Callable[[], float] = time.time) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._file: IO[str] = path.open("a", encoding="utf-8")
        self._clock = clock

    def write(self, event: Event) -> None:
        record: dict[str, Any]
        if isinstance(event, Snapshot):
            record = {"kind": "snapshot", "data": event.topics}
        elif isinstance(event, Feed):
            record = {"kind": "feed", "args": [event.topic, event.payload, event.timestamp]}
        else:
            return
        record["received_at"] = self._clock()
        self._file.write(json.dumps(record, separators=(",", ":")) + "\n")
        self._file.flush()

    def close(self) -> None:
        self._file.close()


def read(path: Path) -> Iterator[tuple[float, Event]]:
    """``(received_at, event)`` for every valid line; malformed lines are skipped."""
    with path.open(encoding="utf-8") as file:
        for line in file:
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            at = float(record.get("received_at") or 0.0)
            if record.get("kind") == "snapshot" and isinstance(record.get("data"), dict):
                yield at, Snapshot(record["data"])
            elif record.get("kind") == "feed":
                args = record.get("args") or []
                if len(args) >= 2:
                    stamp = str(args[2]) if len(args) > 2 else ""
                    yield at, Feed(str(args[0]), args[1], stamp)


async def replay(
    path: Path,
    *,
    speed: float = 1.0,
    sleep: Callable[[float], Awaitable[None]] | None = None,
) -> AsyncIterator[Event]:
    """Yield a recording's events with their original spacing divided by ``speed``."""
    pause = sleep or asyncio.sleep
    previous: float | None = None
    for at, event in read(path):
        if previous is not None and at > previous:
            await pause((at - previous) / speed)
        previous = at
        yield event

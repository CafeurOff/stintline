"""Turn feed events into the snapshot the UI receives, and broadcast it.

The latest snapshot is kept in the cache (served by ``GET /api/v1/live`` and sent to new
WebSocket clients); every snapshot is broadcast to the ``live`` Channels group, at most
once per ``PUBLISH_INTERVAL_S``. Feed events are only merged as they arrive: publishing
runs on its own beat, so a burst of updates never holds up reading the feed.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache

from racedata.live.merge import LiveState
from racedata.live.protocol import Event, Feed, Snapshot
from racedata.live.snapshot import SessionHistory, view
from stintline.live.circuit import CircuitContext, circuit_context
from stintline.live.strategy import pit_now

GROUP = "live"
CACHE_KEY = "live:snapshot"
PUBLISH_INTERVAL_S = 0.5
"""Half a second: cars move between timing loops on the page, so a faster beat only adds
traffic, and a slower one makes the tower lag behind the feed."""
STALE_AFTER_S = 120
"""A snapshot older than this means the live process stopped: the UI shows offline."""


class Publisher:
    def __init__(
        self,
        clock: Callable[[], float] = time.time,
        context: Callable[[int | None], CircuitContext] = circuit_context,
    ) -> None:
        self.state = LiveState()
        self.history = SessionHistory()
        self._clock = clock
        self._context = context
        self._dirty = False
        self._last_publish = 0.0
        self._circuits: dict[int | None, CircuitContext] = {}
        """Context per circuit key, read once (it needs the database)."""
        self.transcripts: dict[str, str] = {}
        """What was said in each radio clip, by URL, filled by ``live.radio`` (ADR 0029)."""
        self.radio_urls: list[str] = []
        """Clips in the latest snapshot, newest first."""

    def apply(self, event: Event) -> None:
        if isinstance(event, Snapshot):
            self.state.apply_snapshot(event.topics)
        elif isinstance(event, Feed):
            self.state.apply_feed(event.topic, event.payload)
        else:
            return
        self.history.update(self.state, at=self._clock())
        self._dirty = True

    def _circuit_key(self) -> int | None:
        circuit = (self.state.get("SessionInfo").get("Meeting") or {}).get("Circuit") or {}
        key = circuit.get("Key") if isinstance(circuit, dict) else None
        try:
            return int(str(key)) if key is not None else None
        except ValueError:
            return None

    def needs_circuit(self) -> bool:
        """The session's circuit has not been read yet: call :meth:`load_circuit` from a
        thread allowed to query the database before :meth:`take_if_due`."""
        return self._circuit_key() not in self._circuits

    def load_circuit(self) -> CircuitContext:
        key = self._circuit_key()
        context = self._circuits.get(key)
        if context is None:
            context = self._circuits[key] = self._context(key)
        return context

    def snapshot(self) -> dict[str, Any]:
        live = view(self.state, self.history, now=self._clock())
        circuit = self.load_circuit()
        stops = pit_now(live.cars, circuit.pit_loss_s) if circuit.pit_loss_s is not None else {}
        data = live.model_dump(mode="json")
        for car in data["cars"]:
            stop = stops.get(car["number"])
            car["pit_now"] = (
                None
                if stop is None
                else {
                    "position": stop.position,
                    "ahead": stop.ahead,
                    "behind": stop.behind,
                    "margin_ahead_s": stop.margin_ahead_s,
                    "margin_behind_s": stop.margin_behind_s,
                }
            )
        for radio in data["team_radio"]:
            radio["transcript"] = self.transcripts.get(radio["url"])
        self.radio_urls = [radio["url"] for radio in data["team_radio"]]
        data["reference_session_id"] = circuit.reference_session_id
        data["pit_loss_s"] = circuit.pit_loss_s
        data["pit_loss_sigma_s"] = circuit.pit_loss_sigma_s
        data["updated_at"] = self._clock()
        return data

    def add_transcript(self, url: str, text: str) -> None:
        self.transcripts[url] = text
        self._dirty = True

    def take_if_due(self, *, force: bool = False) -> dict[str, Any] | None:
        """The snapshot to publish now, if the state changed and the beat allows it.

        Built on the thread that merges the feed (it reads the state being merged), then
        handed to :meth:`send`, which may run elsewhere."""
        now = self._clock()
        if not self._dirty or (not force and now - self._last_publish < PUBLISH_INTERVAL_S):
            return None
        data = self.snapshot()
        self._dirty = False
        self._last_publish = now
        return data

    @staticmethod
    def send(data: dict[str, Any]) -> None:
        cache.set(CACHE_KEY, data, STALE_AFTER_S)
        layer = get_channel_layer()
        if layer is not None:
            async_to_sync(layer.group_send)(GROUP, {"type": "live.snapshot", "data": data})

    def publish_if_due(self, *, force: bool = False) -> bool:
        data = self.take_if_due(force=force)
        if data is None:
            return False
        self.send(data)
        return True


def latest() -> dict[str, Any] | None:
    data: dict[str, Any] | None = cache.get(CACHE_KEY)
    return data

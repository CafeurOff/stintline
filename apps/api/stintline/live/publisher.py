"""Turn feed events into the snapshot the UI receives, and broadcast it.

The latest snapshot is kept in the cache (served by ``GET /api/v1/live`` and sent to new
WebSocket clients); every snapshot is broadcast to the ``live`` Channels group, at most
once per ``PUBLISH_INTERVAL_S``.
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
from racedata.live.snapshot import view
from stintline.live.circuit import CircuitContext, circuit_context
from stintline.live.strategy import pit_now

GROUP = "live"
CACHE_KEY = "live:snapshot"
PUBLISH_INTERVAL_S = 1.0
STALE_AFTER_S = 120
"""A snapshot older than this means the live process stopped: the UI shows offline."""


class Publisher:
    def __init__(
        self,
        clock: Callable[[], float] = time.time,
        context: Callable[[int | None], CircuitContext] = circuit_context,
    ) -> None:
        self.state = LiveState()
        self._clock = clock
        self._context = context
        self._dirty = False
        self._last_publish = 0.0

    def apply(self, event: Event) -> None:
        if isinstance(event, Snapshot):
            self.state.apply_snapshot(event.topics)
        elif isinstance(event, Feed):
            self.state.apply_feed(event.topic, event.payload)
        else:
            return
        self._dirty = True

    def snapshot(self) -> dict[str, Any]:
        live = view(self.state)
        circuit = self._context(live.session.circuit_key)
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
        data["reference_session_id"] = circuit.reference_session_id
        data["pit_loss_s"] = circuit.pit_loss_s
        data["pit_loss_sigma_s"] = circuit.pit_loss_sigma_s
        data["updated_at"] = self._clock()
        return data

    def publish_if_due(self, *, force: bool = False) -> bool:
        now = self._clock()
        if not self._dirty or (not force and now - self._last_publish < PUBLISH_INTERVAL_S):
            return False
        data = self.snapshot()
        cache.set(CACHE_KEY, data, STALE_AFTER_S)
        layer = get_channel_layer()
        if layer is not None:
            async_to_sync(layer.group_send)(GROUP, {"type": "live.snapshot", "data": data})
        self._dirty = False
        self._last_publish = now
        return True


def latest() -> dict[str, Any] | None:
    data: dict[str, Any] | None = cache.get(CACHE_KEY)
    return data

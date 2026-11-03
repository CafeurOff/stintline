"""Test doubles for code that depends on racedata (deterministic clock, scripted HTTP)."""

from __future__ import annotations

import httpx


class FakeClock:
    """Deterministic clock: ``sleep`` advances time instantly and is recorded."""

    def __init__(self, start: float = 1000.0) -> None:
        self.now = start
        self.sleeps: list[float] = []

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def sequence_transport(
    *responses: httpx.Response | Exception,
) -> tuple[httpx.MockTransport, list[httpx.Request]]:
    """Transport returning ``responses`` in order (exceptions are raised), plus the list of
    requests it received."""
    calls: list[httpx.Request] = []
    queue = list(responses)

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        item = queue.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    return httpx.MockTransport(handler), calls

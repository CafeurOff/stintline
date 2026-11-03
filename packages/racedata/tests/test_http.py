from __future__ import annotations

from typing import Any

import httpx
import pytest

from racedata import (
    InvalidPayloadError,
    NotFoundError,
    ProviderError,
    RateLimitedError,
    UpstreamUnavailableError,
)
from racedata.http import HttpClient, RateLimit, RateLimiter, RetryPolicy, SystemClock
from racedata.testing import FakeClock, sequence_transport

FAST_RETRY = RetryPolicy(max_attempts=3, base_delay_s=1.0, multiplier=2.0, max_delay_s=10.0)


def make_client(transport: httpx.MockTransport, clock: FakeClock, **kwargs: Any) -> HttpClient:
    return HttpClient("test", "https://example.test/v1", transport=transport, clock=clock, **kwargs)


def test_get_json_returns_payload_and_sends_query(clock: FakeClock) -> None:
    transport, calls = sequence_transport(httpx.Response(200, json=[{"a": 1}]))

    data = make_client(transport, clock).get_json("laps", {"session_key": 9})

    assert data == [{"a": 1}]
    assert str(calls[0].url) == "https://example.test/v1/laps?session_key=9"
    assert calls[0].headers["User-Agent"].startswith("StintLine/")


def test_server_errors_are_retried_with_exponential_backoff(clock: FakeClock) -> None:
    transport, calls = sequence_transport(
        httpx.Response(503), httpx.Response(502), httpx.Response(200, json={"ok": True})
    )

    data = make_client(transport, clock, retry=FAST_RETRY).get_json("x")

    assert data == {"ok": True}
    assert len(calls) == 3
    assert clock.sleeps == [1.0, 2.0]


def test_timeouts_exhaust_retries_into_upstream_unavailable(clock: FakeClock) -> None:
    transport, calls = sequence_transport(*[httpx.ReadTimeout("slow")] * 3)

    with pytest.raises(UpstreamUnavailableError, match="timeout"):
        make_client(transport, clock, retry=FAST_RETRY).get_json("x")
    assert len(calls) == 3


def test_connection_errors_are_retried(clock: FakeClock) -> None:
    transport, _ = sequence_transport(httpx.ConnectError("refused"), httpx.Response(200, json=[]))

    assert make_client(transport, clock, retry=FAST_RETRY).get_json("x") == []


def test_rate_limit_honours_retry_after(clock: FakeClock) -> None:
    transport, _ = sequence_transport(
        httpx.Response(429, headers={"Retry-After": "7"}), httpx.Response(200, json=[])
    )

    make_client(transport, clock, retry=FAST_RETRY).get_json("x")

    assert clock.sleeps == [7.0]


def test_rate_limit_persisting_raises_rate_limited(clock: FakeClock) -> None:
    transport, _ = sequence_transport(*[httpx.Response(429, headers={"Retry-After": "bogus"})] * 3)

    with pytest.raises(RateLimitedError) as info:
        make_client(transport, clock, retry=FAST_RETRY).get_json("x")
    assert info.value.retry_after_s is None


def test_not_found_is_not_retried(clock: FakeClock) -> None:
    transport, calls = sequence_transport(httpx.Response(404))

    with pytest.raises(NotFoundError):
        make_client(transport, clock).get_json("x")
    assert len(calls) == 1


def test_other_client_errors_raise_provider_error(clock: FakeClock) -> None:
    transport, _ = sequence_transport(httpx.Response(422))

    with pytest.raises(ProviderError, match="HTTP 422"):
        make_client(transport, clock).get_json("x")


def test_invalid_json_raises_invalid_payload(clock: FakeClock) -> None:
    transport, _ = sequence_transport(httpx.Response(200, content=b"<html>"))

    with pytest.raises(InvalidPayloadError):
        make_client(transport, clock).get_json("x")


class MemoryCache:
    def __init__(self) -> None:
        self.store: dict[str, Any] = {}

    def get(self, key: str) -> Any | None:
        return self.store.get(key)

    def set(self, key: str, value: Any) -> None:
        self.store[key] = value


def test_cached_responses_skip_the_network(clock: FakeClock) -> None:
    transport, calls = sequence_transport(httpx.Response(200, json=[1]))
    client = make_client(transport, clock, cache=MemoryCache())

    assert client.get_json("x", {"a": 1}) == [1]
    assert client.get_json("x", {"a": 1}) == [1]
    assert len(calls) == 1
    client.close()


def test_retry_policy_caps_delays() -> None:
    policy = RetryPolicy(base_delay_s=1.0, multiplier=10.0, max_delay_s=5.0)

    assert policy.delay_for(0) == 1.0
    assert policy.delay_for(3) == 5.0
    assert policy.delay_for(0, retry_after_s=3.0) == 3.0


def test_rate_limiter_enforces_every_window(clock: FakeClock) -> None:
    limiter = RateLimiter([RateLimit(2, 1.0), RateLimit(3, 60.0)], clock)

    for _ in range(4):
        limiter.acquire()

    # 3rd call waits for the 1 s window, 4th waits for the 60 s window.
    assert clock.sleeps[0] == pytest.approx(1.0)
    assert sum(clock.sleeps) == pytest.approx(60.0)


def test_rate_limiter_without_limits_never_waits(clock: FakeClock) -> None:
    limiter = RateLimiter([], clock)
    for _ in range(100):
        limiter.acquire()
    assert clock.sleeps == []


def test_system_clock_is_monotonic() -> None:
    clock = SystemClock()
    first = clock.monotonic()
    clock.sleep(0)
    assert clock.monotonic() >= first

"""HTTP client shared by every provider: rate limiting, retries, caching and timeouts.

Every network call in StintLine goes through :class:`HttpClient`. Time is injected
(:class:`Clock`) so that rate limiting and back-off are tested without real sleeps.
"""

from __future__ import annotations

import time
from collections import deque
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from racedata.cache import NullCache, ResponseCache, cache_key
from racedata.errors import (
    InvalidPayloadError,
    NotFoundError,
    ProviderError,
    RateLimitedError,
    UpstreamUnavailableError,
)

QueryParams = Mapping[str, str | int]

HTTP_NOT_FOUND = 404
HTTP_TOO_MANY_REQUESTS = 429
HTTP_SERVER_ERROR = 500


class Clock(Protocol):
    def monotonic(self) -> float: ...

    def sleep(self, seconds: float) -> None: ...


class SystemClock:
    """Real wall clock."""

    def monotonic(self) -> float:
        return time.monotonic()

    def sleep(self, seconds: float) -> None:
        time.sleep(seconds)


@dataclass(frozen=True, slots=True)
class RateLimit:
    """At most ``max_calls`` requests in any sliding window of ``period_s`` seconds."""

    max_calls: int
    period_s: float


@dataclass(frozen=True, slots=True)
class RetryPolicy:
    """Exponential back-off for transient failures (timeouts, 5xx, 429).

    Attributes:
        max_attempts: total tries including the first one.
        base_delay_s: wait before the first retry.
        multiplier: growth factor between consecutive retries.
        max_delay_s: upper bound for a single wait, also caps ``Retry-After``.
    """

    max_attempts: int = 5
    base_delay_s: float = 1.0
    multiplier: float = 2.0
    max_delay_s: float = 30.0

    def delay_for(self, retry_index: int, retry_after_s: float | None = None) -> float:
        backoff = self.base_delay_s * self.multiplier**retry_index
        wait = max(backoff, retry_after_s or 0.0)
        return min(wait, self.max_delay_s)


@dataclass
class RateLimiter:
    """Sliding-window limiter enforcing several limits at once (e.g. per second and per minute).

    Safe within one process. Ingestion runs in a single worker process (ADR 0004), so
    process-local limiting is sufficient. 429 handling remains as a safety net.
    """

    limits: Sequence[RateLimit]
    clock: Clock
    _calls: deque[float] = field(default_factory=deque, init=False)

    def acquire(self) -> None:
        if not self.limits:
            return
        longest = max(limit.period_s for limit in self.limits)
        while True:
            now = self.clock.monotonic()
            while self._calls and now - self._calls[0] >= longest:
                self._calls.popleft()
            wait = max((self._wait_for(limit, now) for limit in self.limits), default=0.0)
            if wait <= 0:
                self._calls.append(now)
                return
            self.clock.sleep(wait)

    def _wait_for(self, limit: RateLimit, now: float) -> float:
        in_window = [t for t in self._calls if now - t < limit.period_s]
        if len(in_window) < limit.max_calls:
            return 0.0
        oldest_relevant = in_window[-limit.max_calls]
        return limit.period_s - (now - oldest_relevant)


class HttpClient:
    """HTTP client for one upstream provider (JSON APIs and text feeds)."""

    def __init__(
        self,
        provider: str,
        base_url: str,
        *,
        limits: Sequence[RateLimit] = (),
        retry: RetryPolicy | None = None,
        timeout_s: float = 20.0,
        cache: ResponseCache | None = None,
        transport: httpx.BaseTransport | None = None,
        clock: Clock | None = None,
        user_agent: str = "StintLine/0.1 (+https://github.com/CafeurOff/stintline)",
    ) -> None:
        self.provider = provider
        self.base_url = base_url.rstrip("/")
        self._clock = clock or SystemClock()
        self._limiter = RateLimiter(limits, self._clock)
        self._retry = retry or RetryPolicy()
        self._cache = cache or NullCache()
        self._client = httpx.Client(
            timeout=timeout_s,
            transport=transport,
            headers={"User-Agent": user_agent},
            follow_redirects=True,
        )

    def close(self) -> None:
        self._client.close()

    def get_json(self, path: str, params: QueryParams | None = None) -> Any:
        """GET ``base_url/path`` and return the decoded JSON body.

        Raises:
            NotFoundError: HTTP 404.
            RateLimitedError: still rate limited after every retry.
            UpstreamUnavailableError: timeouts, connection errors or 5xx after every retry.
            InvalidPayloadError: the body is not valid JSON.
            ProviderError: any other 4xx.
        """
        url, query = self._url(path, params)
        key = cache_key(self.provider, url, query)
        cached = self._cache.get(key)
        if cached is not None:
            return cached
        response = self._fetch(url, query, "application/json")
        try:
            data = response.json()
        except ValueError as exc:
            raise InvalidPayloadError(self.provider, f"invalid JSON from {url}") from exc
        self._cache.set(key, data)
        return data

    def get_text(self, path: str, params: QueryParams | None = None, *, accept: str = "*/*") -> str:
        """GET ``base_url/path`` and return the body as text (feeds, XML). Not cached.

        Raises the same errors as :meth:`get_json`, except ``InvalidPayloadError``.
        """
        url, query = self._url(path, params)
        return self._fetch(url, query, accept).text

    def _url(self, path: str, params: QueryParams | None) -> tuple[str, dict[str, str]]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        return url, {k: str(v) for k, v in (params or {}).items()}

    def _fetch(self, url: str, query: dict[str, str], accept: str) -> httpx.Response:
        last_error: ProviderError | None = None
        for attempt in range(self._retry.max_attempts):
            if attempt:
                retry_after = (
                    last_error.retry_after_s if isinstance(last_error, RateLimitedError) else None
                )
                self._clock.sleep(self._retry.delay_for(attempt - 1, retry_after))
            self._limiter.acquire()
            try:
                response = self._client.get(url, params=query, headers={"Accept": accept})
            except httpx.TimeoutException:
                last_error = UpstreamUnavailableError(self.provider, f"timeout on {url}")
                continue
            except httpx.TransportError as exc:
                last_error = UpstreamUnavailableError(self.provider, f"{type(exc).__name__}")
                continue

            status = response.status_code
            if status == HTTP_TOO_MANY_REQUESTS:
                last_error = RateLimitedError(self.provider, _retry_after(response))
                continue
            if status >= HTTP_SERVER_ERROR:
                last_error = UpstreamUnavailableError(self.provider, f"HTTP {status} on {url}")
                continue
            if status == HTTP_NOT_FOUND:
                raise NotFoundError(self.provider, f"HTTP 404 on {url}")
            if status >= httpx.codes.BAD_REQUEST:
                raise ProviderError(self.provider, f"HTTP {status} on {url}")
            return response

        assert last_error is not None  # noqa: S101  (loop ran at least once)
        raise last_error


def _retry_after(response: httpx.Response) -> float | None:
    value = response.headers.get("Retry-After")
    if value is None:
        return None
    try:
        return max(float(value), 0.0)
    except ValueError:
        return None

"""Typed errors raised by providers. Callers never see raw HTTP or parsing exceptions."""

from __future__ import annotations


class ProviderError(Exception):
    """Base class for every error raised by a data provider."""

    def __init__(self, provider: str, message: str) -> None:
        super().__init__(f"[{provider}] {message}")
        self.provider = provider


class UpstreamUnavailableError(ProviderError):
    """The upstream service timed out, refused the connection or returned a 5xx."""


class RateLimitedError(ProviderError):
    """The upstream service rejected the request because of rate limiting (HTTP 429)."""

    def __init__(self, provider: str, retry_after_s: float | None = None) -> None:
        detail = f"rate limited, retry after {retry_after_s}s" if retry_after_s else "rate limited"
        super().__init__(provider, detail)
        self.retry_after_s = retry_after_s


class InvalidPayloadError(ProviderError):
    """The upstream response could not be parsed into the expected DTOs."""


class NotFoundError(ProviderError):
    """The requested resource does not exist upstream (HTTP 404)."""

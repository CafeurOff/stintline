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


class UnauthorizedError(ProviderError):
    """The upstream service requires authentication for this request (HTTP 401)."""

    def __init__(self, provider: str, message: str, detail: str = "") -> None:
        super().__init__(provider, message)
        self.detail = detail
        """The upstream explanation, trimmed (never shown to clients)."""


class LiveSessionLockedError(ProviderError):
    """Data is withheld while an F1 session is live (OpenF1 free tier, ADR 0028).

    Not a failure of the request itself: the same call succeeds once the session has
    ended, so callers defer the work instead of retrying or reporting an error."""

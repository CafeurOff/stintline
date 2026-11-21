"""StintLine race data providers.

The only package allowed to perform network I/O. Every upstream payload is
normalised into typed DTOs (UTC datetimes, explicit units) before leaving it.
"""

from racedata.errors import (
    InvalidPayloadError,
    LiveSessionLockedError,
    NotFoundError,
    ProviderError,
    RateLimitedError,
    UnauthorizedError,
    UpstreamUnavailableError,
)

__all__ = [
    "InvalidPayloadError",
    "LiveSessionLockedError",
    "NotFoundError",
    "ProviderError",
    "RateLimitedError",
    "UnauthorizedError",
    "UpstreamUnavailableError",
]
__version__ = "0.1.0"

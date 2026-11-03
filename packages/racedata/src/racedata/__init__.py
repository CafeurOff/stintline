"""StintLine race data providers.

The only package allowed to perform network I/O. Every upstream payload is
normalised into typed DTOs (UTC datetimes, explicit units) before leaving it.
"""

from racedata.errors import (
    InvalidPayloadError,
    NotFoundError,
    ProviderError,
    RateLimitedError,
    UpstreamUnavailableError,
)

__all__ = [
    "InvalidPayloadError",
    "NotFoundError",
    "ProviderError",
    "RateLimitedError",
    "UpstreamUnavailableError",
]
__version__ = "0.1.0"

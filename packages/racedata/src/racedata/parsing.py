"""Small, strict converters shared by the adapters."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from racedata.errors import InvalidPayloadError

SECONDS_PER_MINUTE = 60


def parse_datetime(provider: str, value: Any) -> datetime:
    """ISO 8601 string to aware UTC datetime. Naive inputs are rejected."""
    if not isinstance(value, str):
        raise InvalidPayloadError(provider, f"expected ISO datetime string, got {value!r}")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise InvalidPayloadError(provider, f"invalid datetime {value!r}") from exc
    if parsed.tzinfo is None:
        raise InvalidPayloadError(provider, f"naive datetime {value!r}")
    return parsed.astimezone(UTC)


def parse_optional_datetime(provider: str, value: Any) -> datetime | None:
    return None if value in (None, "") else parse_datetime(provider, value)


def parse_utc_date_time(provider: str, day: str, time: str | None) -> datetime | None:
    """Jolpica splits UTC timestamps into ``date`` and ``time`` (``"15:00:00Z"``)."""
    if not time:
        return None
    return parse_datetime(provider, f"{day}T{time}")


def parse_date(provider: str, value: Any) -> date:
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise InvalidPayloadError(provider, f"invalid date {value!r}") from exc


def optional_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def optional_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_duration_s(value: Any) -> float | None:
    """``"21.594"`` or ``"1:02.345"`` (long stops, red flags) to seconds."""
    if value in (None, ""):
        return None
    text = str(value).strip()
    minutes, sep, seconds = text.rpartition(":")
    try:
        return (int(minutes) * SECONDS_PER_MINUTE if sep else 0) + float(seconds)
    except ValueError:
        return None

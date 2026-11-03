"""Lap-time units shared by every model.

Lap times are handled as seconds (``float``) internally. Conversion to and from the
``M:SS.mmm`` display format lives here so that no model parses strings itself.
"""

from __future__ import annotations

from typing import NewType

LapTime = NewType("LapTime", float)
"""A lap or sector duration in seconds."""

SECONDS_PER_MINUTE = 60


def parse_lap_time(text: str) -> LapTime:
    """Parse ``"1:20.832"`` or ``"80.832"`` into seconds.

    Raises:
        ValueError: if the text is empty, malformed or negative.
    """
    raw = text.strip()
    if not raw:
        raise ValueError("empty lap time")
    minutes_part, sep, seconds_part = raw.rpartition(":")
    try:
        seconds = float(seconds_part)
        minutes = int(minutes_part) if sep else 0
    except ValueError as exc:
        raise ValueError(f"malformed lap time: {text!r}") from exc
    if seconds < 0 or minutes < 0 or (sep and seconds >= SECONDS_PER_MINUTE):
        raise ValueError(f"malformed lap time: {text!r}")
    return LapTime(minutes * SECONDS_PER_MINUTE + seconds)


def format_lap_time(seconds: float) -> str:
    """Format seconds as ``M:SS.mmm`` (e.g. ``80.832`` -> ``"1:20.832"``)."""
    if seconds < 0:
        raise ValueError("lap time cannot be negative")
    total_ms = round(seconds * 1000)
    minutes, rem_ms = divmod(total_ms, SECONDS_PER_MINUTE * 1000)
    return f"{minutes}:{rem_ms // 1000:02d}.{rem_ms % 1000:03d}"

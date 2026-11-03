"""Facts derived from raw provider records, kept provider-neutral and pure."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime

from racedata.models import RaceControlRecord, TrackStatusKind, TrackStatusPeriod

TRACK_SCOPE = "Track"
_CLEARING_FLAGS = frozenset({"GREEN", "CLEAR", "CHEQUERED"})


class _Open:
    def __init__(self, status: TrackStatusKind, started_at: datetime, lap: int | None) -> None:
        self.status = status
        self.started_at = started_at
        self.lap_start = lap

    def close(self, at: datetime | None, lap: int | None) -> TrackStatusPeriod:
        return TrackStatusPeriod(
            status=self.status,
            started_at=self.started_at,
            ended_at=at,
            lap_start=self.lap_start,
            lap_end=lap,
        )


def track_status_periods(messages: Iterable[RaceControlRecord]) -> list[TrackStatusPeriod]:
    """Reconstruct Safety Car, Virtual Safety Car and red-flag periods.

    Rules, in chronological order:

    - ``SAFETY CAR DEPLOYED`` opens SC (closing an open VSC: VSC upgraded to SC).
    - ``VIRTUAL SAFETY CAR DEPLOYED`` opens VSC. ``VIRTUAL SAFETY CAR ENDING`` closes it.
    - A track-wide ``RED`` flag closes SC/VSC and opens RED.
    - A track-wide ``GREEN``/``CLEAR``/``CHEQUERED`` flag closes any open period
      (``TRACK CLEAR`` after an SC, ``GREEN LIGHT - PIT EXIT OPEN`` after a red flag).
    - Sector-scoped flags (local yellows) never affect neutralisation.

    A period still open at the end is returned with ``ended_at=None``.
    """
    periods: list[TrackStatusPeriod] = []
    current: _Open | None = None

    def close(at: datetime | None, lap: int | None) -> None:
        nonlocal current
        if current is not None:
            periods.append(current.close(at, lap))
            current = None

    for msg in sorted(messages, key=lambda m: m.occurred_at):
        text = msg.message.upper()
        at, lap = msg.occurred_at, msg.lap_number
        if msg.category == "SafetyCar":
            if "VIRTUAL SAFETY CAR DEPLOYED" in text:
                close(at, lap)
                current = _Open(TrackStatusKind.VIRTUAL_SAFETY_CAR, at, lap)
            elif "VIRTUAL SAFETY CAR ENDING" in text:
                if current is not None and current.status is TrackStatusKind.VIRTUAL_SAFETY_CAR:
                    close(at, lap)
            elif "SAFETY CAR DEPLOYED" in text:
                close(at, lap)
                current = _Open(TrackStatusKind.SAFETY_CAR, at, lap)
            continue
        if msg.scope != TRACK_SCOPE or msg.flag is None:
            continue
        flag = msg.flag.upper()
        if flag == "RED":
            close(at, lap)
            current = _Open(TrackStatusKind.RED_FLAG, at, lap)
        elif flag in _CLEARING_FLAGS:
            close(at, lap)
    close(None, None)
    return periods

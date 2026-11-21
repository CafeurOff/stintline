"""Facts derived from raw provider records, kept provider-neutral and pure."""

from __future__ import annotations

import re
from collections.abc import Collection, Iterable
from datetime import datetime

from racedata.models import (
    LapRecord,
    PitRecord,
    QualifyingSegmentPeriod,
    RaceControlRecord,
    TrackStatusKind,
    TrackStatusPeriod,
)

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


def reference_lap(
    laps: Iterable[LapRecord],
    pits: Iterable[PitRecord],
    excluded: Collection[tuple[int, int]] = (),
) -> LapRecord | None:
    """The lap used to draw the circuit: the fastest timed lap that is neither lap 1, a
    pit-out lap, a pit-in lap nor ``excluded`` (deleted laps, which cut the track), so the
    car follows the racing line from line to line. Returns ``None`` when no lap qualifies
    (e.g. a race abandoned on lap 1)."""
    pit_laps = {(pit.driver_number, pit.lap_number) for pit in pits} | set(excluded)
    candidates = [
        lap
        for lap in laps
        if lap.lap_number > 1
        and lap.lap_time_s is not None
        and lap.lap_time_s > 0
        and lap.started_at is not None
        and not lap.is_pit_out_lap
        and (lap.driver_number, lap.lap_number) not in pit_laps
    ]
    return min(candidates, key=lambda lap: (lap.lap_time_s, lap.driver_number), default=None)


_DELETED = re.compile(
    r"^CAR (?P<car>\d+) \([A-Z]{3}\) (?:TIME [\d:.]+ |LAP )DELETED\b.*?\bLAP (?P<lap>\d+)\b"
)
_REINSTATED = re.compile(
    r"^CAR (?P<car>\d+) \([A-Z]{3}\) (?:TIME [\d:.]+ |LAP )REINSTATED\b.*?\bLAP (?P<lap>\d+)\b"
)


def deleted_laps(messages: Iterable[RaceControlRecord]) -> set[tuple[int, int]]:
    """``(car, lap)`` of every lap time deleted by race control and not reinstated since.

    OpenF1 flags deletions only in messages, in two wordings seen since 2023:
    ``CAR 44 (HAM) TIME 1:29.374 DELETED - TRACK LIMITS AT TURN 4 LAP 2 15:08:15`` and
    ``CAR 14 (ALO) LAP DELETED - TRACK LIMITS AT TURN 6 LAP 7 14:22:01``. An unknown
    wording leaves the lap counted (ADR 0028)."""
    deleted: set[tuple[int, int]] = set()
    for m in sorted(messages, key=lambda m: m.occurred_at):
        text = m.message.strip().upper()
        if match := _DELETED.match(text):
            deleted.add((int(match["car"]), int(match["lap"])))
        elif match := _REINSTATED.match(text):
            deleted.discard((int(match["car"]), int(match["lap"])))
    return deleted


def qualifying_segments(messages: Iterable[RaceControlRecord]) -> list[QualifyingSegmentPeriod]:
    """Q1-Q3 windows: from the first message of a phase to its chequered flag (or its last
    message when the flag is missing). Laps started before the flag still count, so the
    replay uses the window to name the segment, not to drop laps."""
    by_phase: dict[int, list[RaceControlRecord]] = {}
    for m in messages:
        if m.qualifying_phase is not None and m.qualifying_phase > 0:
            by_phase.setdefault(m.qualifying_phase, []).append(m)
    segments: list[QualifyingSegmentPeriod] = []
    for number in sorted(by_phase):
        rows = sorted(by_phase[number], key=lambda m: m.occurred_at)
        flags = [m.occurred_at for m in rows if (m.flag or "").upper() == "CHEQUERED"]
        segments.append(
            QualifyingSegmentPeriod(
                number=number,
                started_at=rows[0].occurred_at,
                ended_at=flags[0] if flags else rows[-1].occurred_at,
            )
        )
    return segments

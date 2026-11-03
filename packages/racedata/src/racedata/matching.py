"""Join the Jolpica calendar (canonical events) with OpenF1 timing sessions."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import timedelta

from racedata.models import EventInfo, SessionKind, TimingSession

MATCH_TOLERANCE = timedelta(days=1)
"""Maximum gap between scheduled and actual start. Same-kind sessions of consecutive
events are at least a week apart, so a day absorbs delays without ambiguity."""


def match_sessions(
    event: EventInfo,
    timing_sessions: Iterable[TimingSession],
    tolerance: timedelta = MATCH_TOLERANCE,
) -> dict[SessionKind, TimingSession]:
    """For each scheduled session of ``event``, the timing session of the same kind
    starting closest to it (within ``tolerance``)."""
    candidates = list(timing_sessions)
    matched: dict[SessionKind, TimingSession] = {}
    for scheduled in event.sessions:
        if scheduled.starts_at is None:
            continue
        best: TimingSession | None = None
        for ts in candidates:
            if ts.kind is not scheduled.kind:
                continue
            gap = abs(ts.starts_at - scheduled.starts_at)
            if gap <= tolerance and (
                best is None or gap < abs(best.starts_at - scheduled.starts_at)
            ):
                best = ts
        if best is not None:
            matched[scheduled.kind] = best
    return matched

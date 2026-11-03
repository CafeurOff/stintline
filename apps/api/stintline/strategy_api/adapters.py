"""Build strategy-engine inputs from stored race data.

This is the only place where ORM rows become :mod:`stintline_strategy` types, which keeps
the engine framework-free (CLAUDE.md boundary).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from stintline.racing.models import Lap as LapRow
from stintline.racing.models import PitStop as PitStopRow
from stintline.racing.models import Session, Stint, TrackStatus
from stintline_strategy.domain import (
    Compound,
    Lap,
    Neutralisation,
    NeutralisedPeriod,
    PitStop,
    Race,
)


def _stint_lookup(session: Session) -> dict[int, list[Stint]]:
    by_car: dict[int, list[Stint]] = defaultdict(list)
    for stint in Stint.objects.filter(entry__session=session).select_related("entry"):
        by_car[stint.entry.car_number].append(stint)
    return by_car


def _stint_for(stints: list[Stint], lap: int) -> Stint | None:
    for stint in stints:
        if (
            stint.lap_start is not None
            and stint.lap_start <= lap
            and (stint.lap_end is None or lap <= stint.lap_end)
        ):
            return stint
    return None


def race_from_session(session: Session) -> Race:
    """Assemble a :class:`Race` (laps with stint, compound, tyre age and race time)."""
    rows = list(
        LapRow.objects.filter(entry__session=session)
        .select_related("entry")
        .order_by("entry__car_number", "lap_number")
    )
    if not rows:
        raise ValueError(f"session {session.pk} has no laps")
    stints = _stint_lookup(session)
    starts = [r.started_at for r in rows if r.lap_number == 1 and r.started_at is not None]
    race_start: datetime | None = min(starts) if starts else None
    next_start = {(r.entry.car_number, r.lap_number): r.started_at for r in rows}

    laps: list[Lap] = []
    for r in rows:
        car = r.entry.car_number
        stint = _stint_for(stints.get(car, []), r.lap_number)
        tyre_age = (
            stint.tyre_age_at_start + (r.lap_number - stint.lap_start)
            if stint and stint.tyre_age_at_start is not None and stint.lap_start is not None
            else None
        )
        laps.append(
            Lap(
                car=car,
                lap=r.lap_number,
                time_s=r.lap_time_s,
                stint=stint.stint_number if stint else None,
                compound=Compound(stint.compound) if stint else Compound.UNKNOWN,
                tyre_age=tyre_age,
                is_pit_in=r.is_pit_in_lap,
                is_pit_out=r.is_pit_out_lap,
                end_time_s=_end_time(r, next_start.get((car, r.lap_number + 1)), race_start),
            )
        )

    pit_stops = tuple(
        PitStop(car=p.entry.car_number, lap=p.lap_number, lane_duration_s=p.pit_lane_duration_s)
        for p in PitStopRow.objects.filter(entry__session=session).select_related("entry")
    )
    neutralisations = tuple(
        NeutralisedPeriod(Neutralisation(t.status), t.lap_start, t.lap_end)
        for t in TrackStatus.objects.filter(session=session)
        if t.lap_start is not None
    )
    winner_laps = (
        session.entries.filter(finish_position=1).values_list("laps_completed", flat=True).first()
    )
    total = winner_laps or max(r.lap_number for r in rows)
    return Race(
        name=session.event.name,
        total_laps=total,
        laps=tuple(laps),
        pit_stops=pit_stops,
        neutralisations=neutralisations,
    )


def _end_time(
    row: LapRow, next_lap_start: datetime | None, race_start: datetime | None
) -> float | None:
    """Race time at the line: next lap's start when known, else this lap's start + time."""
    if race_start is None:
        return None
    if next_lap_start is not None:
        return (next_lap_start - race_start).total_seconds()
    if row.started_at is not None and row.lap_time_s is not None:
        return (row.started_at - race_start).total_seconds() + row.lap_time_s
    return None

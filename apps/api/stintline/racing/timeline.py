"""Every lap of a session on the session clock: the data of practice and qualifying replays
(ADR 0028).

Unlike a race, cars in practice and qualifying run at different times and spend most of the
session in the garage, so laps are placed by when they started, in seconds from the start of
the session, not by lap number.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from django.db.models import Prefetch

from stintline.racing.models import (
    QUALIFYING_KINDS,
    Lap,
    QualifyingSegment,
    RaceControlMessage,
    Session,
    SessionEntry,
    Stint,
    TrackStatus,
    WeatherSample,
)

SEGMENTS = 3
"""Qualifying is split into Q1, Q2 and Q3 (SQ1-SQ3 for sprint qualifying)."""


@dataclass(frozen=True)
class TimelineLap:
    lap: int
    start_s: float
    end_s: float | None
    """When the car crossed the line again: the lap time, never after the start of the next
    lap, else that start. ``None`` when neither is known (back to the garage mid-lap)."""
    drive_start_s: float | None
    """When the car is on track during this lap. An out lap starts at the previous crossing
    of the line, so its time includes the stop in the garage: the car is placed on track
    only for the sectors it was timed in (see ``_drive``)."""
    drive_from: float
    """Share of the lap already behind the car at ``drive_start_s`` (0 for a flying lap)."""
    time_s: float | None
    sectors_s: tuple[float | None, float | None, float | None]
    compound: str | None
    tyre_age: int | None
    pit_out: bool
    pit_in: bool
    deleted: bool


@dataclass(frozen=True)
class TimelineCar:
    car_number: int
    laps: list[TimelineLap]


@dataclass(frozen=True)
class TimelineSegment:
    number: int
    start_s: float
    end_s: float
    eliminated: list[int] = field(default_factory=list)
    """Cars knocked out at the end of this segment, best first (empty for the last one)."""


@dataclass(frozen=True)
class TimelineFlag:
    status: str
    start_s: float
    end_s: float | None


@dataclass(frozen=True)
class TimelineMessage:
    at_s: float
    category: str
    flag: str
    car_number: int | None
    message: str


@dataclass(frozen=True)
class TimelineWeather:
    at_s: float
    air_temperature_c: float | None
    track_temperature_c: float | None
    rainfall: bool
    wind_speed_ms: float | None


@dataclass(frozen=True)
class Timeline:
    starts_at: datetime
    duration_s: float
    cars: list[TimelineCar]
    segments: list[TimelineSegment]
    flags: list[TimelineFlag] = field(default_factory=list)
    race_control: list[TimelineMessage] = field(default_factory=list)
    weather: list[TimelineWeather] = field(default_factory=list)


FIRST_TIMED_SEASON = 2023
"""OpenF1 has lap timing from 2023 (ADR 0002): older sessions never get a replay."""


def replay_state(
    session: Session, has_data: bool, now: datetime
) -> Literal["ready", "pending", "upcoming", "none"]:
    """What the Grand Prix page offers for a session: a link only when the replay works."""
    if has_data:
        return "ready"
    if session.ends_at is None or session.ends_at > now:
        return "upcoming"
    if session.event.season.year >= FIRST_TIMED_SEASON:
        return "pending"
    return "none"


def session_timeline(session: Session) -> Timeline | None:
    """``None`` when the session has no timed lap (not imported, or no timing published)."""
    entries = list(
        SessionEntry.objects.filter(session=session)
        .prefetch_related(
            Prefetch("laps", queryset=Lap.objects.order_by("lap_number")),
            Prefetch("stints", queryset=Stint.objects.order_by("stint_number")),
        )
        .order_by("car_number")
    )
    starts = [lap.started_at for e in entries for lap in e.laps.all() if lap.started_at is not None]
    if not starts:
        return None
    origin = min([session.starts_at, *starts]) if session.starts_at else min(starts)
    cars = [_car(entry, origin) for entry in entries]
    ends = [lap.end_s for car in cars for lap in car.laps if lap.end_s is not None]
    session_end = (session.ends_at - origin).total_seconds() if session.ends_at else 0.0
    return Timeline(
        starts_at=origin,
        duration_s=round(max([session_end, *ends]), 3),
        cars=[car for car in cars if car.laps],
        segments=_segments(session, entries, origin),
        flags=[
            TimelineFlag(
                status=row.status,
                start_s=_seconds(row.started_at, origin),
                end_s=None if row.ended_at is None else _seconds(row.ended_at, origin),
            )
            for row in TrackStatus.objects.filter(session=session).order_by("started_at")
        ],
        race_control=[
            TimelineMessage(
                at_s=_seconds(row.occurred_at, origin),
                category=row.category,
                flag=row.flag,
                car_number=row.car_number,
                message=row.message,
            )
            for row in RaceControlMessage.objects.filter(session=session).order_by("occurred_at")
        ],
        weather=[
            TimelineWeather(
                at_s=_seconds(row.sampled_at, origin),
                air_temperature_c=row.air_temperature_c,
                track_temperature_c=row.track_temperature_c,
                rainfall=row.rainfall,
                wind_speed_ms=row.wind_speed_ms,
            )
            for row in WeatherSample.objects.filter(session=session).order_by("sampled_at")
        ],
    )


def _seconds(at: datetime, origin: datetime) -> float:
    return round((at - origin).total_seconds(), 3)


def _car(entry: SessionEntry, origin: datetime) -> TimelineCar:
    laps = [lap for lap in entry.laps.all() if lap.started_at is not None]
    stints = list(entry.stints.all())
    out: list[TimelineLap] = []
    for index, lap in enumerate(laps):
        assert lap.started_at is not None  # noqa: S101  (filtered above)
        start = (lap.started_at - origin).total_seconds()
        following = laps[index + 1] if index + 1 < len(laps) else None
        next_start = None
        if following is not None and following.lap_number == lap.lap_number + 1:
            assert following.started_at is not None  # noqa: S101
            next_start = (following.started_at - origin).total_seconds()
        timed_end = None if lap.lap_time_s is None else start + lap.lap_time_s
        ends = [e for e in (timed_end, next_start) if e is not None]
        end = min(ends) if ends else None
        drive_start, drive_from = _drive(lap, start, end)
        compound, age = _tyre(stints, lap.lap_number)
        out.append(
            TimelineLap(
                lap=lap.lap_number,
                start_s=round(start, 3),
                end_s=None if end is None else round(end, 3),
                drive_start_s=None if drive_start is None else round(drive_start, 3),
                drive_from=round(drive_from, 3),
                time_s=lap.lap_time_s,
                sectors_s=(lap.sector_1_s, lap.sector_2_s, lap.sector_3_s),
                compound=compound,
                tyre_age=age,
                pit_out=lap.is_pit_out_lap,
                pit_in=lap.is_pit_in_lap,
                deleted=lap.is_deleted,
            )
        )
    return TimelineCar(car_number=entry.car_number, laps=out)


SECTORS = 3


def _drive(lap: Lap, start: float, end: float | None) -> tuple[float | None, float]:
    """When the car is on track during the lap, and the share of the lap behind it then.

    A flying lap is driven from its start. An out lap begins at the car's previous crossing
    of the line, so most of it can be spent in the garage: the car is shown only for the
    sectors timed on that lap (S1 is missing when it left the pit lane mid-sector), each
    taken as a third of the lap. Without any timed sector it is shown from its start."""
    if end is None:
        return None, 0.0
    if not lap.is_pit_out_lap:
        return start, 0.0
    sectors = [s for s in (lap.sector_1_s, lap.sector_2_s, lap.sector_3_s) if s is not None]
    if not sectors:
        return start, 0.0
    driven = min(sum(sectors), end - start)
    return end - driven, 1 - len(sectors) / SECTORS


def _tyre(stints: list[Stint], lap: int) -> tuple[str | None, int | None]:
    for stint in stints:
        if stint.lap_start is None or lap < stint.lap_start:
            continue
        if stint.lap_end is not None and lap > stint.lap_end:
            continue
        age = None
        if stint.tyre_age_at_start is not None:
            age = stint.tyre_age_at_start + lap - stint.lap_start
        return stint.compound, age
    return None, None


def _segments(
    session: Session, entries: list[SessionEntry], origin: datetime
) -> list[TimelineSegment]:
    if session.kind not in QUALIFYING_KINDS:
        return []
    rows = QualifyingSegment.objects.filter(session=session).order_by("number")
    knocked = _knocked_out(entries)
    return [
        TimelineSegment(
            number=row.number,
            start_s=round((row.started_at - origin).total_seconds(), 3),
            end_s=round((row.ended_at - origin).total_seconds(), 3),
            eliminated=knocked.get(row.number, []),
        )
        for row in rows
    ]


def _knocked_out(entries: list[SessionEntry]) -> dict[int, list[int]]:
    """Segment -> cars that went no further, from the best time of each segment (Jolpica or
    OpenF1). A car without a Q1 time is out in Q1. Empty when no segment time is known,
    so nothing is shown rather than a wrong list."""
    if not any(e.q1_s is not None for e in entries):
        return {}
    ranked = sorted(
        entries, key=lambda e: (e.finish_position is None, e.finish_position or 0, e.car_number)
    )
    out: dict[int, list[int]] = {}
    for entry in ranked:
        times = (entry.q1_s, entry.q2_s, entry.q3_s)
        reached = max((i + 1 for i, t in enumerate(times) if t is not None), default=1)
        if reached < SEGMENTS:
            out.setdefault(reached, []).append(entry.car_number)
    return out

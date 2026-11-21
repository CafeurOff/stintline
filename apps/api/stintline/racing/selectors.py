"""Read queries for the racing models (no business logic, no N+1)."""

from __future__ import annotations

from bisect import bisect_right
from dataclasses import dataclass
from datetime import datetime

from django.db.models import Count, Exists, F, Max, Min, OuterRef, Prefetch, QuerySet

from stintline.racing.models import (
    Event,
    Lap,
    PitStop,
    Season,
    Session,
    SessionEntry,
    Stint,
    TeamRadio,
    TrackOutline,
    TrackStatus,
)

# Classified cars first (by position), then retirements, consistently across databases.
ENTRY_ORDER = (F("finish_position").asc(nulls_last=True), "car_number")


def seasons() -> QuerySet[Season]:
    return Season.objects.annotate(events_count=Count("events")).order_by("-year")


def season_events(year: int) -> QuerySet[Event]:
    winners = SessionEntry.objects.filter(finish_position=1).select_related(
        "driver__portrait", "team", "session__event__season"
    )
    sessions = (
        Session.objects.annotate(has_data=Exists(Lap.objects.filter(entry__session=OuterRef("pk"))))
        .prefetch_related(Prefetch("entries", queryset=winners, to_attr="winners"))
        .order_by("scheduled_start")
    )
    return (
        Event.objects.filter(season__year=year)
        .select_related("circuit", "season")
        .prefetch_related(Prefetch("sessions", queryset=sessions))
        .order_by("round")
    )


def session_detail(session_id: int) -> Session:
    entries = SessionEntry.objects.select_related("driver__portrait", "team").order_by(*ENTRY_ORDER)
    return (
        Session.objects.select_related("event__season", "event__circuit")
        .prefetch_related(
            Prefetch("entries", queryset=entries),
            Prefetch("track_statuses", queryset=TrackStatus.objects.order_by("started_at")),
        )
        .get(pk=session_id)
    )


def session_stints(session_id: int) -> QuerySet[SessionEntry]:
    return (
        SessionEntry.objects.filter(session_id=session_id)
        .select_related("driver__portrait", "team")
        .prefetch_related(
            Prefetch("stints", queryset=Stint.objects.order_by("stint_number")),
            Prefetch("pit_stops", queryset=PitStop.objects.order_by("lap_number")),
        )
        .order_by(*ENTRY_ORDER)
    )


def track_outline(session_id: int) -> TrackOutline | None:
    """The session's own outline, else the latest one drawn at the same circuit: a wet or
    red-flagged practice can have no clean lap to draw from (ADR 0028)."""
    own = TrackOutline.objects.filter(session_id=session_id).first()
    if own is not None:
        return own
    circuit = Session.objects.filter(pk=session_id).values_list("event__circuit_id", flat=True)
    return (
        TrackOutline.objects.filter(session__event__circuit_id__in=circuit)
        .order_by("-session__ends_at")
        .first()
    )


def session_sectors(session_id: int) -> list[dict[str, object]]:
    """Best lap, best sector times and top speed of every car (rows without timing skipped).
    Laps deleted by race control count for none of them.

    The ideal lap is the sum of the three best sectors, possibly from different laps.
    """
    rows = (
        Lap.objects.filter(entry__session_id=session_id, is_deleted=False)
        .values("entry__car_number")
        .annotate(
            best_lap_s=Min("lap_time_s"),
            best_s1=Min("sector_1_s"),
            best_s2=Min("sector_2_s"),
            best_s3=Min("sector_3_s"),
            top_speed_kph=Max("speed_trap_kph"),
        )
        .order_by("best_lap_s")
    )
    out: list[dict[str, object]] = []
    for row in rows:
        sectors = [row["best_s1"], row["best_s2"], row["best_s3"]]
        out.append(
            {
                "car_number": row["entry__car_number"],
                "best_lap_s": row["best_lap_s"],
                "best_sectors_s": sectors,
                "ideal_lap_s": None if None in sectors else round(sum(sectors), 3),
                "top_speed_kph": row["top_speed_kph"],
            }
        )
    return out


@dataclass(frozen=True, slots=True)
class RadioMessage:
    car_number: int
    recorded_at: datetime
    url: str
    lap: int | None
    """The car's lap when the message was recorded; ``None`` before its first timed lap
    starts or when the session has no lap start times."""
    transcript: str | None
    """``None`` while not transcribed yet, ``""`` when nothing intelligible was said."""
    transcript_confidence: float | None


def session_radio(session_id: int) -> list[RadioMessage]:
    """Team radio of a session, oldest first, each placed on its car's lap (ADR 0029)."""
    starts: dict[int, tuple[list[datetime], list[int]]] = {}
    laps = (
        Lap.objects.filter(entry__session_id=session_id, started_at__isnull=False)
        .order_by("entry__car_number", "started_at")
        .values_list("entry__car_number", "started_at", "lap_number")
    )
    for car, started_at, number in laps:
        if started_at is None:  # excluded by the filter; narrows the type
            continue
        times, numbers = starts.setdefault(car, ([], []))
        times.append(started_at)
        numbers.append(number)
    out: list[RadioMessage] = []
    for row in TeamRadio.objects.filter(session_id=session_id).order_by("recorded_at", "pk"):
        times, numbers = starts.get(row.car_number, ([], []))
        index = bisect_right(times, row.recorded_at) - 1
        out.append(
            RadioMessage(
                car_number=row.car_number,
                recorded_at=row.recorded_at,
                url=row.url,
                lap=numbers[index] if index >= 0 else None,
                transcript=row.transcript if row.transcribed_at is not None else None,
                transcript_confidence=row.transcript_confidence,
            )
        )
    return out


def radio_stamp(session_id: int) -> datetime | None:
    """Changes whenever a clip of the session is transcribed (for the response ETag)."""
    stamp: datetime | None = TeamRadio.objects.filter(session_id=session_id).aggregate(
        last=Max("transcribed_at")
    )["last"]
    return stamp

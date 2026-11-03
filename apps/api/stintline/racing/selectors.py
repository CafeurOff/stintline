"""Read queries for the racing models (no business logic, no N+1)."""

from __future__ import annotations

from django.db.models import Count, Exists, F, Max, Min, OuterRef, Prefetch, QuerySet

from stintline.racing.models import (
    Event,
    Lap,
    PitStop,
    Season,
    Session,
    SessionEntry,
    Stint,
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
    return TrackOutline.objects.filter(session_id=session_id).first()


def session_sectors(session_id: int) -> list[dict[str, object]]:
    """Best lap, best sector times and top speed of every car (rows without timing skipped).

    The ideal lap is the sum of the three best sectors, possibly from different laps.
    """
    rows = (
        Lap.objects.filter(entry__session_id=session_id)
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

"""Read queries for the racing models (no business logic, no N+1)."""

from __future__ import annotations

from django.db.models import Count, Exists, F, OuterRef, Prefetch, QuerySet

from stintline.racing.models import (
    Event,
    Lap,
    PitStop,
    Season,
    Session,
    SessionEntry,
    Stint,
    TrackStatus,
)

# Classified cars first (by position), then retirements, consistently across databases.
ENTRY_ORDER = (F("finish_position").asc(nulls_last=True), "car_number")


def seasons() -> QuerySet[Season]:
    return Season.objects.annotate(events_count=Count("events")).order_by("-year")


def season_events(year: int) -> QuerySet[Event]:
    sessions = Session.objects.annotate(
        has_data=Exists(Lap.objects.filter(entry__session=OuterRef("pk")))
    ).order_by("scheduled_start")
    return (
        Event.objects.filter(season__year=year)
        .select_related("circuit", "season")
        .prefetch_related(Prefetch("sessions", queryset=sessions))
        .order_by("round")
    )


def session_detail(session_id: int) -> Session:
    entries = SessionEntry.objects.select_related("driver", "team").order_by(*ENTRY_ORDER)
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
        .select_related("driver", "team")
        .prefetch_related(
            Prefetch("stints", queryset=Stint.objects.order_by("stint_number")),
            Prefetch("pit_stops", queryset=PitStop.objects.order_by("lap_number")),
        )
        .order_by(*ENTRY_ORDER)
    )

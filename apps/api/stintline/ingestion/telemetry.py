"""Telemetry of each driver's fastest clean lap (ADR 0013).

Two bounded OpenF1 requests per driver (``car_data`` and ``location`` over the lap), so a
race costs about 40 requests. Runs after a session import, and catches up on older races
a few at a time (``refresh_recent``), never inside a request.
"""

from __future__ import annotations

from collections.abc import Collection
from datetime import datetime, timedelta
from functools import partial

import structlog
from django.db import transaction
from django.db.models import QuerySet

from racedata.sources import Sources
from stintline.racing.models import RACE_KINDS, Lap, Session, TelemetryLap

log = structlog.get_logger(__name__)

MIN_CAR_SAMPLES = 20
"""Fewer samples than this over a lap means the feed had a gap: nothing is stored."""


def fastest_clean_laps(session: Session) -> list[Lap]:
    """Per car, the fastest timed lap that is not lap 1, a pit-in or a pit-out lap."""
    laps = (
        Lap.objects.filter(
            entry__session=session,
            lap_number__gt=1,
            lap_time_s__gt=0,
            started_at__isnull=False,
            is_pit_in_lap=False,
            is_pit_out_lap=False,
        )
        .select_related("entry")
        .order_by("entry_id", "lap_time_s", "lap_number")
    )
    best: dict[int, Lap] = {}
    for lap in laps:
        best.setdefault(lap.entry_id, lap)
    return list(best.values())


def missing_telemetry() -> QuerySet[Session]:
    """Timed races and sprints with laps but no telemetry yet, most recent first."""
    return (
        Session.objects.filter(
            kind__in=RACE_KINDS,
            openf1_session_key__isnull=False,
            ingested_at__isnull=False,
            entries__laps__isnull=False,
        )
        .exclude(entries__telemetry__isnull=False)
        .distinct()
        .order_by("-ends_at")
    )


def _seconds_since(start: datetime, at: datetime) -> float:
    return round((at - start).total_seconds(), 3)


def ingest_telemetry(
    session: Session, sources: Sources, now: datetime, cars: Collection[int] | None = None
) -> int:
    """Store the fastest-lap telemetry of every car (or of ``cars``). Laps already stored
    are skipped, so re-running costs nothing. Returns the number of laps stored."""
    key = session.openf1_session_key
    if key is None:
        return 0
    stored = 0
    for lap in fastest_clean_laps(session):
        entry = lap.entry
        if cars is not None and entry.car_number not in cars:
            continue
        if TelemetryLap.objects.filter(entry=entry, lap_number=lap.lap_number).exists():
            continue
        if lap.started_at is None or lap.lap_time_s is None:  # excluded by the query
            continue
        start = lap.started_at
        end = start + timedelta(seconds=lap.lap_time_s)
        car = sources.timing.car_data(key, entry.car_number, start, end)
        if len(car) < MIN_CAR_SAMPLES:
            log.warning(
                "telemetry_too_short", session_id=session.pk, car=entry.car_number, samples=len(car)
            )
            continue
        places = sources.timing.locations(key, entry.car_number, start, end)
        rel = partial(_seconds_since, start)

        with transaction.atomic():
            TelemetryLap.objects.update_or_create(
                entry=entry,
                lap_number=lap.lap_number,
                defaults={
                    "lap_time_s": lap.lap_time_s,
                    "samples": {
                        "t": [rel(c.at) for c in car],
                        "speed": [c.speed_kph for c in car],
                        "throttle": [c.throttle_pct for c in car],
                        "brake": [int(c.brake) for c in car],
                        "gear": [c.gear for c in car],
                        "rpm": [c.rpm for c in car],
                        "drs": [c.drs for c in car],
                    },
                    "positions": {
                        "t": [rel(p.at) for p in places],
                        "x": [round(p.x, 1) for p in places],
                        "y": [round(p.y, 1) for p in places],
                    },
                    "fetched_at": now,
                },
            )
        stored += 1
    log.info("telemetry_ingested", session_id=session.pk, laps=stored)
    return stored

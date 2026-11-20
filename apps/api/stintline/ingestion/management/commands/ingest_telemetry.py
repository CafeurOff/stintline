"""``manage.py ingest_telemetry [--session ID | --season YEAR] [--altitude] [--sync]``

Fastest-lap telemetry of every car (ADR 0013). Queues Celery tasks unless ``--sync``.
Without options, queues every timed race and sprint still missing it, most recent first.
``--altitude`` instead fetches the positions again for laps stored without altitude
(ADR 0021); without a session or season it takes every such race.
"""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandParser
from django.utils import timezone

from stintline.ingestion import tasks, telemetry
from stintline.ingestion.sources import open_sources
from stintline.racing.models import RACE_KINDS, Session


class Command(BaseCommand):
    help = "Import the fastest-lap telemetry of every car (OpenF1 car_data and location)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--session", type=int, help="one stored session id")
        parser.add_argument("--season", type=int, help="every timed race and sprint of a season")
        parser.add_argument("--sync", action="store_true", help="run here instead of queuing")
        parser.add_argument(
            "--altitude", action="store_true", help="add altitude to laps stored without it"
        )

    def handle(
        self,
        *args: Any,
        session: int | None = None,
        season: int | None = None,
        sync: bool = False,
        altitude: bool = False,
        **options: Any,
    ) -> None:
        if session is not None:
            sessions = Session.objects.filter(pk=session)
        elif season is not None:
            sessions = Session.objects.filter(
                event__season__year=season,
                kind__in=RACE_KINDS,
                ingested_at__isnull=False,
            ).order_by("-ends_at")
        elif altitude:
            sessions = telemetry.missing_altitude()
        else:
            sessions = telemetry.missing_telemetry()
        ids = list(sessions.values_list("pk", flat=True))
        task = tasks.add_telemetry_altitude if altitude else tasks.ingest_telemetry
        if not sync:
            for pk in ids:
                task.delay(pk)
            self.stdout.write(self.style.SUCCESS(f"{len(ids)} sessions queued"))
            return
        total = 0
        with open_sources() as sources:
            for item in Session.objects.filter(pk__in=ids).order_by("-ends_at"):
                if altitude:
                    laps = telemetry.add_altitude(item, sources)
                else:
                    laps = telemetry.ingest_telemetry(item, sources, timezone.now())
                total += laps
                self.stdout.write(f"{item}: {laps} laps")
        verb = "given altitude" if altitude else "stored"
        self.stdout.write(self.style.SUCCESS(f"{total} laps {verb}"))

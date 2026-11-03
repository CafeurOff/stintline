"""``manage.py ingest --season 2025 [--round 14] [--sync]``"""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandParser

from stintline.ingestion import history, services, tasks
from stintline.ingestion.sources import open_sources
from stintline.racing.models import Session


class Command(BaseCommand):
    help = "Import a season (or one round) from the configured data sources."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--season", type=int, required=True)
        parser.add_argument("--round", type=int, dest="round_")
        parser.add_argument(
            "--sync", action="store_true", help="run in this process instead of queueing tasks"
        )

    def handle(
        self, *args: Any, season: int, round_: int | None, sync: bool, **options: Any
    ) -> None:
        if not sync:
            result = (
                tasks.ingest_event.delay(season, round_)
                if round_
                else tasks.ingest_season.delay(season)
            )
            self.stdout.write(f"Queued ingestion task {result.id}")
            return
        with open_sources() as sources:
            events = services.ingest_calendar(season, sources)
            if round_:
                events = [e for e in events if e.round == round_]
            sessions = Session.objects.filter(event__in=events).select_related("event__season")
            for session in sessions:
                if services.is_ingestable(session):
                    report = services.ingest_session(session, sources)
                    self.stdout.write(f"{session}: {report.counts}")
            results = history.ingest_season_results(season, sources)
            self.stdout.write(f"{season} results and standings: {results.counts}")
        self.stdout.write(self.style.SUCCESS(f"Ingested {len(events)} event(s) for {season}"))

"""``manage.py seed_demo``: load the reference races from local fixtures (no network)."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandParser
from django.utils import timezone

from stintline.ingestion import history, portraits, services, telemetry
from stintline.ingestion.sources import MODE_FIXTURES, open_sources
from stintline.paddock import services as paddock
from stintline.racing.models import Driver, Session, SessionKind

DEMO_SEASON = 2025
DEMO_ROUNDS = (4, 14, 16)
"""Bahrain (high degradation, Safety Car), Hungary (track position, undercut) and
Italy (low degradation, one stop). Used to choose model defaults."""
BACKTEST_ROUNDS = (3, 9, 11, 15, 20, 24)
"""Held-out validation races, never used to tune parameters: Japan, Spain, Austria,
Netherlands (Safety Car), Mexico City and Abu Dhabi."""


TELEMETRY_DEMO = (14, (4, 81, 63))
"""Fastest-lap telemetry recorded for the Hungarian podium only (fixtures stay small)."""


FIA_DEMO_EVENT = "Hungarian Grand Prix"
"""FIA documents recorded for Hungary only: its stewards' decisions and final classification."""


class Command(BaseCommand):
    help = "Load the demo dataset (2025 Bahrain, Hungarian and Italian Grands Prix) offline."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--backtest", action="store_true", help="also load the six held-out validation races"
        )

    def handle(self, *args: Any, backtest: bool = False, **options: Any) -> None:
        rounds = DEMO_ROUNDS + (BACKTEST_ROUNDS if backtest else ())
        with open_sources(MODE_FIXTURES) as sources:
            services.ingest_calendar(DEMO_SEASON, sources, kinds=frozenset({SessionKind.RACE}))
            races = Session.objects.filter(
                event__season__year=DEMO_SEASON,
                event__round__in=rounds,
                kind=SessionKind.RACE,
            ).select_related("event__season")
            for session in races:
                report = services.ingest_session(session, sources)
                self.stdout.write(f"{session.event.name}: {report.counts}")
            round_, cars = TELEMETRY_DEMO
            hungary = races.get(event__round=round_)
            laps = telemetry.ingest_telemetry(hungary, sources, timezone.now(), cars)
            self.stdout.write(f"Telemetry: {laps} laps")
            reference = history.ingest_reference(sources)
            self.stdout.write(f"Drivers, teams and circuits: {reference.counts}")
            results = history.ingest_season_results(DEMO_SEASON, sources)
            self.stdout.write(f"{DEMO_SEASON} results and standings: {results.counts}")
            grid = Driver.objects.filter(entries__session__event__season__year=DEMO_SEASON)
            pictures = portraits.ingest_portraits(sources, grid.distinct())
            self.stdout.write(f"Portraits: {pictures.counts}")
            if sources.fia is not None:
                documents = paddock.seed_documents(
                    sources.fia, hungary.event, FIA_DEMO_EVENT, timezone.now()
                )
                self.stdout.write(f"FIA documents read: {documents}")
        self.stdout.write(self.style.SUCCESS(f"Demo data loaded ({len(rounds)} races)"))

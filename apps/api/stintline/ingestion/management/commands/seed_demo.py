"""``manage.py seed_demo``: load the reference races from local fixtures (no network)."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandParser

from stintline.ingestion import services
from stintline.ingestion.sources import MODE_FIXTURES, open_sources
from stintline.racing.models import Session, SessionKind

DEMO_SEASON = 2025
DEMO_ROUNDS = (4, 14, 16)
"""Bahrain (high degradation, Safety Car), Hungary (track position, undercut) and
Italy (low degradation, one stop). Used to choose model defaults."""
BACKTEST_ROUNDS = (3, 9, 11, 15, 20, 24)
"""Held-out validation races, never used to tune parameters: Japan, Spain, Austria,
Netherlands (Safety Car), Mexico City and Abu Dhabi."""


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
        self.stdout.write(self.style.SUCCESS(f"Demo data loaded ({len(rounds)} races)"))

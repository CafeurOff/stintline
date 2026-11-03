"""``manage.py seed_demo``: load the reference races from local fixtures (no network)."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand

from stintline.ingestion import services
from stintline.ingestion.sources import MODE_FIXTURES, open_sources
from stintline.racing.models import Session, SessionKind

DEMO_SEASON = 2025
DEMO_ROUNDS = (4, 14, 16)
"""Bahrain (high degradation, Safety Car), Hungary (track position, undercut) and
Italy (low degradation, one stop)."""


class Command(BaseCommand):
    help = "Load the demo dataset (2025 Bahrain, Hungarian and Italian Grands Prix) offline."

    def handle(self, *args: Any, **options: Any) -> None:
        with open_sources(MODE_FIXTURES) as sources:
            services.ingest_calendar(DEMO_SEASON, sources, kinds=frozenset({SessionKind.RACE}))
            races = Session.objects.filter(
                event__season__year=DEMO_SEASON,
                event__round__in=DEMO_ROUNDS,
                kind=SessionKind.RACE,
            ).select_related("event__season")
            for session in races:
                report = services.ingest_session(session, sources)
                self.stdout.write(f"{session.event.name}: {report.counts}")
        self.stdout.write(self.style.SUCCESS(f"Demo data loaded ({len(DEMO_ROUNDS)} races)"))

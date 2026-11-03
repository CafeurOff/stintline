"""``manage.py ingest_portraits [--season 2025]``: driver portraits from Wikipedia."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandParser

from stintline.ingestion import portraits
from stintline.ingestion.sources import open_sources
from stintline.racing.models import Driver


class Command(BaseCommand):
    help = "Fetch freely licensed driver portraits from Wikipedia (ADR 0009)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--season", type=int, help="only drivers who raced that season")

    def handle(self, *args: Any, season: int | None = None, **options: Any) -> None:
        drivers = Driver.objects.all()
        if season is not None:
            drivers = drivers.filter(entries__session__event__season__year=season).distinct()
        with open_sources() as sources:
            report = portraits.ingest_portraits(sources, drivers)
        self.stdout.write(self.style.SUCCESS(f"Portraits: {report.counts}"))

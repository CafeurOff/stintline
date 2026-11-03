"""``manage.py ingest_history [--from 1950] [--to 2022] [--force]``

One-off import of every season's results, qualifying and standings, plus driver, team and
circuit biographies. Runs in this process (Jolpica allows about 500 requests per hour, so
the full history takes a few hours) and resumes where it stopped: seasons already imported
are skipped unless ``--force``.
"""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandParser
from django.utils import timezone

from racedata.errors import ProviderError
from stintline.ingestion import history
from stintline.ingestion.sources import open_sources
from stintline.racing.models import Season


class Command(BaseCommand):
    help = "Import results, qualifying, standings and biographies since 1950 (resumable)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--from", type=int, dest="first", default=history.FIRST_SEASON)
        parser.add_argument("--to", type=int, dest="last", default=timezone.now().year - 1)
        parser.add_argument("--force", action="store_true", help="re-import finished seasons")
        parser.add_argument("--skip-reference", action="store_true")

    def handle(
        self,
        *args: Any,
        first: int,
        last: int,
        force: bool,
        skip_reference: bool,
        **options: Any,
    ) -> None:
        done = set(
            Season.objects.filter(results_ingested_at__isnull=False).values_list("year", flat=True)
        )
        with open_sources() as sources:
            if not skip_reference:
                self.stdout.write(f"Biographies: {history.ingest_reference(sources).counts}")
            for season in range(first, last + 1):
                if season in done and not force:
                    self.stdout.write(f"{season}: already imported, skipped")
                    continue
                try:
                    report = history.ingest_season_results(season, sources)
                except ProviderError as exc:
                    self.stderr.write(
                        f"{season}: stopped ({type(exc).__name__}), run again to resume"
                    )
                    raise SystemExit(1) from exc
                self.stdout.write(f"{season}: {report.counts}")
        self.stdout.write(self.style.SUCCESS(f"History imported for {first}-{last}"))

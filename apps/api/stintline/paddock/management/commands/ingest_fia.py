"""``manage.py ingest_fia``: list FIA documents and read their PDFs now (ADR 0018)."""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.utils import timezone

from stintline.ingestion.sources import open_sources
from stintline.paddock import refresh


class Command(BaseCommand):
    help = "List the FIA documents of a season (1 request / 10 s) and read up to N PDFs."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--season", type=int, action="append", help="Default: settings")
        parser.add_argument("--texts", type=int, default=0, help="PDFs to read after listing")
        parser.add_argument(
            "--all-events", action="store_true", help="List every event again, not only due ones"
        )

    def handle(self, *args: Any, **options: Any) -> None:
        seasons: list[int] = options["season"] or list(settings.FIA_SEASONS)
        with open_sources() as sources:
            if sources.fia is None:
                raise CommandError("No FIA source configured.")
            unknown = [s for s in seasons if s not in sources.fia.seasons]
            if unknown:
                raise CommandError(f"No FIA document page known for {unknown}.")
            report = refresh.refresh(
                sources.fia,
                seasons,
                timezone.now(),
                event_pages=1000,
                texts=options["texts"],
                everything=options["all_events"],
            )
        self.stdout.write(
            self.style.SUCCESS(
                f"{len(report.events)} events listed, {report.new_documents} new documents, "
                f"{report.texts} texts read"
            )
        )

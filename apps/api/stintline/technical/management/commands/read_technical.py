"""``manage.py read_technical``: read the technical PDFs again (after a parser change)."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.utils import timezone

from racedata.errors import ProviderError
from stintline.ingestion.sources import open_sources
from stintline.paddock import readers, services
from stintline.paddock.models import FiaDocument


class Command(BaseCommand):
    help = "Read the FIA technical documents again (1 request / 10 s), newest first."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--season", type=int, help="Only this season")
        parser.add_argument("--limit", type=int, default=50, help="Documents to read")
        parser.add_argument(
            "--all", action="store_true", help="Read again documents that already gave rows"
        )

    def handle(self, *args: Any, **options: Any) -> None:
        documents = FiaDocument.objects.filter(readers.handled_titles()).select_related("event")
        if options["season"]:
            documents = documents.filter(event__season__year=options["season"])
        if not options["all"]:
            documents = documents.filter(
                upgrades__isnull=True,
                no_updates__isnull=True,
                pu_usage__isnull=True,
                pu_changes__isnull=True,
            ).distinct()
        read = 0
        with open_sources() as sources:
            if sources.fia is None:
                raise CommandError("No FIA source configured.")
            for document in documents.order_by("-published_at")[: options["limit"]]:
                try:
                    if document.text_fetched_at is None:
                        # Not read yet: store its text too, so the import skips it later.
                        services.fetch_text(sources.fia, document, timezone.now())
                    else:
                        services.take_turn()
                        services.read_with_readers(document, sources.fia.document_pdf(document.url))
                except ProviderError as exc:
                    self.stderr.write(f"{document.pk}: {type(exc).__name__}")
                    continue
                read += 1
        self.stdout.write(self.style.SUCCESS(f"{read} technical documents read"))

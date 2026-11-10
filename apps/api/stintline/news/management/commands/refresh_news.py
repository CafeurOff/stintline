"""``manage.py refresh_news``: read the news feeds now (also every 30 min via Celery beat)."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.utils import timezone

from stintline.ingestion.sources import open_sources
from stintline.news import services


class Command(BaseCommand):
    help = "Read the news feeds and store their headlines (title and link only)."

    def handle(self, *args: Any, **options: Any) -> None:
        with open_sources() as sources:
            created = services.refresh_headlines(sources, timezone.now())
        self.stdout.write(self.style.SUCCESS(f"{created} new headlines"))

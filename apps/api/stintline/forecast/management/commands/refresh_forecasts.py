"""``manage.py refresh_forecasts``: fetch the weather forecasts of upcoming sessions now."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.utils import timezone

from stintline.forecast import services
from stintline.ingestion.sources import open_sources


class Command(BaseCommand):
    help = "Fetch Open-Meteo forecasts for sessions in the next 15 days (also every 3 h)."

    def handle(self, *args: Any, **options: Any) -> None:
        with open_sources() as sources:
            stored = services.refresh_forecasts(sources, timezone.now())
        self.stdout.write(self.style.SUCCESS(f"{stored} session forecasts stored"))

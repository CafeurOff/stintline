"""``manage.py check_title_rules [--season YEAR]``

Recounts every driver's season with our points rules (ADR 0022) and lists the drivers whose
total differs from the official final standings. Run it after a rules change, or when a
new season's rules are added.
"""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandParser

from stintline.championship import selectors
from stintline.racing.models import Driver, Season


class Command(BaseCommand):
    help = "Compare our recount of each season with the official final standings."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--season", type=int, help="one season (default: all)")

    def handle(self, *args: Any, season: int | None = None, **options: Any) -> None:
        years = [season] if season else sorted(Season.objects.values_list("year", flat=True))
        clean = 0
        for year in years:
            gaps = selectors.audit(year)
            if not gaps:
                clean += 1
                continue
            names = Driver.objects.in_bulk([gap["driver_id"] for gap in gaps])
            lines = ", ".join(
                f"{names[g['driver_id']].ref} {g['ours']:g} vs {g['official']:g}" for g in gaps
            )
            self.stdout.write(f"{year}: {lines}")
        self.stdout.write(self.style.SUCCESS(f"{clean} of {len(years)} seasons match"))

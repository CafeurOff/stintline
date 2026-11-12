"""``manage.py build_analysis``: compute the per-race figures of the analysis pages now."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandParser

from stintline.analysis import build
from stintline.racing.models import RACE_KINDS, Session


class Command(BaseCommand):
    help = "Compute the analysis figures of imported races (stale ones by default)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--season", type=int, help="Rebuild every race of this season")
        parser.add_argument("--session", type=int, help="Rebuild one session")
        parser.add_argument("--all", action="store_true", help="Rebuild every imported race")

    def handle(self, *args: Any, **options: Any) -> None:
        sessions = Session.objects.filter(kind__in=RACE_KINDS, ingested_at__isnull=False)
        if options["session"]:
            sessions = sessions.filter(pk=options["session"])
        elif options["season"]:
            sessions = sessions.filter(event__season__year=options["season"])
        elif not options["all"]:
            sessions = build.stale_sessions()
        built = 0
        for session in sessions.select_related("event").order_by("starts_at"):
            if build.build_race_stats(session) is not None:
                built += 1
        self.stdout.write(self.style.SUCCESS(f"{built} races analysed"))

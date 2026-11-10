"""``manage.py live_demo --session 70 --out recordings/demo.jsonl``

Rebuild a live-feed recording from a stored race, then try the live mode with
``manage.py live --replay recordings/demo.jsonl --speed 20``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from stintline.live.demo import build
from stintline.racing.models import Session


class Command(BaseCommand):
    help = "Write a live-feed recording rebuilt from a stored race (no official data)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--session", type=int, required=True, help="stored race session id")
        parser.add_argument("--out", type=Path, required=True)

    def handle(self, *args: Any, session: int, out: Path, **options: Any) -> None:
        race = Session.objects.select_related("event__circuit").filter(pk=session).first()
        if race is None:
            raise CommandError(f"No session {session}")
        out.parent.mkdir(parents=True, exist_ok=True)
        lines = build(race, out)
        self.stdout.write(self.style.SUCCESS(f"{lines} lines written to {out}"))

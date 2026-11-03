"""``manage.py backtest``: compare predicted and actual pit-exit positions."""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from stintline.racing.models import Session, SessionKind
from stintline.strategy_api.adapters import race_from_session
from stintline_strategy.backtest import Metrics, backtest_pit_exits

HEADER = (
    "| Race | Stops | MAE (most likely) | MAE (expected) | Exact | ±1 "
    "| 90 % interval coverage | Baseline MAE (no change) |\n"
    "| --- | --- | --- | --- | --- | --- | --- | --- |"
)


def _row(name: str, m: Metrics) -> str:
    return (
        f"| {name} | {m.n} | {m.mae:.2f} | {m.mae_expected:.2f} | {m.exact_rate:.0%} | "
        f"{m.within_one_rate:.0%} | {m.interval_coverage:.0%} | {m.baseline_mae:.2f} |"
    )


class Command(BaseCommand):
    help = "Backtest pit-exit position predictions on ingested races."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--season", type=int, default=2025)
        parser.add_argument("--rounds", type=int, nargs="*", help="default: every ingested race")
        parser.add_argument(
            "--json", type=Path, dest="json_path", help="also write the metrics as JSON"
        )

    def handle(
        self,
        *args: Any,
        season: int,
        rounds: list[int] | None,
        json_path: Path | None,
        **options: Any,
    ) -> None:
        sessions = Session.objects.filter(
            event__season__year=season, kind=SessionKind.RACE, ingested_at__isnull=False
        ).select_related("event")
        if rounds:
            sessions = sessions.filter(event__round__in=rounds)
        races = [race_from_session(s) for s in sessions.order_by("event__round")]
        if not races:
            raise CommandError("no ingested race matches; run `manage.py seed_demo --backtest`")
        payload: dict[str, Any] = {}
        for mode, known in (("blind", False), ("scenario", True)):
            report = backtest_pit_exits(races, known_rival_stops=known)
            rows = [_row(name, m) for name, m in report.per_race.items()]
            self.stdout.write(f"\n### Mode: {mode}\n")
            self.stdout.write("\n".join([HEADER, *rows, _row("**All**", report.overall)]))
            self.stdout.write(f"\nSkipped stops: {len(report.skipped)}")
            payload[mode] = {
                "overall": asdict(report.overall),
                "per_race": {k: asdict(v) for k, v in report.per_race.items()},
                "skipped": list(report.skipped),
            }
        if json_path:
            json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

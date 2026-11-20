"""Shared writers of the ingestion: the run report, and the driver, team and result rows that
both the timing import and the Jolpica history import write.

Network calls happen before any transaction is opened. Writes are upserts on natural keys
(``bulk_create(update_conflicts=True)``), so running an import twice never duplicates
rows.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import structlog

from racedata.models import (
    QualifyingRecord,
    ResultRecord,
)
from stintline.racing.models import (
    Driver,
    Team,
)

log = structlog.get_logger(__name__)


@dataclass
class IngestReport:
    """Row counts written (inserted or updated) by an ingestion run."""

    counts: dict[str, int] = field(default_factory=dict)
    skipped: list[str] = field(default_factory=list)

    def add(self, name: str, value: int) -> None:
        self.counts[name] = self.counts.get(name, 0) + value


def upsert_driver_and_team(r: ResultRecord | QualifyingRecord) -> tuple[Driver, Team]:
    """Identity from a classification row. Biography fields are only ever filled in, never
    blanked, so a sparse row cannot erase what the reference import stored."""
    bio: dict[str, object] = {}
    if isinstance(r, ResultRecord):
        bio = {
            k: v
            for k, v in {
                "nationality": r.nationality,
                "date_of_birth": r.date_of_birth,
                "permanent_number": r.permanent_number,
                "wikipedia_url": r.driver_url,
            }.items()
            if v
        }
    driver, _ = Driver.objects.update_or_create(
        ref=r.driver_id,
        defaults={
            "code": r.code or "",
            "given_name": r.given_name,
            "family_name": r.family_name,
            **bio,
        },
    )
    team_bio: dict[str, object] = {}
    if isinstance(r, ResultRecord):
        team_bio = {
            k: v
            for k, v in {
                "nationality": r.constructor_nationality,
                "wikipedia_url": r.constructor_url,
            }.items()
            if v
        }
    team, _ = Team.objects.update_or_create(
        ref=r.constructor_id, defaults={"name": r.constructor_name, **team_bio}
    )
    return driver, team


def result_fields(r: ResultRecord) -> dict[str, object]:
    """Classification columns of a race or sprint entry."""
    return {
        "grid_position": r.grid,
        "finish_position": r.position,
        "classification": r.position_text,
        "status": r.status,
        "points": r.points,
        "laps_completed": r.laps_completed,
        "race_time_s": r.race_time_s,
        "fastest_lap_rank": r.fastest_lap_rank,
        "fastest_lap_s": r.fastest_lap_s,
    }

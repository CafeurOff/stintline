"""Title maths over stored results: one season's Grands Prix and sprints turned into per-round
tallies, the title state today and the round it was decided at (ADR 0022)."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from django.db.models import Max, Sum

from stintline.championship import maths
from stintline.championship.rules import SeasonRules, UnknownSeasonError, rules_for
from stintline.racing.models import (
    Driver,
    Event,
    EventFormat,
    Season,
    Session,
    SessionEntry,
    SessionKind,
    Standing,
)

STILL_TO_COME = timedelta(days=3)
"""A Grand Prix with no result yet still counts as to come this long after its date (results
arrive within hours); an older one without results was cancelled or never run."""


@dataclass(frozen=True, slots=True)
class Round:
    number: int
    event_id: int
    name: str
    race_date: date
    sprint: bool
    race_done: bool
    sprint_done: bool


@dataclass(slots=True)
class SeasonResults:
    year: int
    rules: SeasonRules
    rounds: list[Round]
    race_points: dict[int, dict[int, float]] = field(default_factory=dict)
    """Driver id → round → points in that Grand Prix."""
    places: dict[int, dict[int, int]] = field(default_factory=dict)
    """Driver id → round → best classified place in that Grand Prix."""
    sprint_points: dict[int, dict[int, float]] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class TitleState:
    year: int
    rules: SeasonRules
    races_done: int
    remaining: maths.Remaining
    points_left: float
    table: list[maths.Standing]
    drivers: dict[int, Driver]
    decided: Round | None
    next_round: Round | None
    clinch: dict[int, float] | None


def load(year: int) -> SeasonResults | None:
    try:
        rules = rules_for(year)
    except UnknownSeasonError:
        return None
    events = list(
        Event.objects.filter(season__year=year)
        .order_by("round")
        .values("id", "round", "name", "race_date", "format")
    )
    if not events:
        return None
    rows = (
        SessionEntry.objects.filter(
            session__event__season__year=year,
            session__kind__in=[SessionKind.RACE, SessionKind.SPRINT],
        )
        .values("session__event__round", "session__kind", "driver_id")
        .annotate(total=Sum("points"))
    )
    race_points: dict[int, dict[int, float]] = defaultdict(dict)
    sprint_points: dict[int, dict[int, float]] = defaultdict(dict)
    raced: set[int] = set()
    sprinted: set[int] = set()
    for row in rows:
        number = row["session__event__round"]
        target = race_points if row["session__kind"] == SessionKind.RACE else sprint_points
        (raced if target is race_points else sprinted).add(number)
        target[row["driver_id"]][number] = float(row["total"] or 0)
    places: dict[int, dict[int, int]] = defaultdict(dict)
    for number, driver, place, text in SessionEntry.objects.filter(
        session__event__season__year=year,
        session__kind=SessionKind.RACE,
        finish_position__isnull=False,
    ).values_list("session__event__round", "driver_id", "finish_position", "classification"):
        if place is None or not text.isdigit():  # retired, disqualified...: not counted back
            continue
        # Shared drives (1950s): a driver's best car counts.
        places[driver][number] = min(place, places[driver].get(number, place))
    rounds = [
        Round(
            number=e["round"],
            event_id=e["id"],
            name=e["name"],
            race_date=e["race_date"],
            sprint=e["format"] == EventFormat.SPRINT,
            race_done=e["round"] in raced,
            sprint_done=e["round"] in sprinted,
        )
        for e in events
    ]
    return SeasonResults(year, rules, rounds, dict(race_points), dict(places), dict(sprint_points))


def _tallies(season: SeasonResults, upto: int | None) -> list[maths.Tally]:
    """Every driver's tally after round ``upto`` (``None``: everything run so far)."""
    done = [r.number for r in season.rounds if r.race_done and (upto is None or r.number <= upto)]
    drivers = set(season.race_points) | set(season.sprint_points)
    return [
        maths.Tally(
            driver_id=driver,
            races=tuple(season.race_points.get(driver, {}).get(n, 0.0) for n in done),
            sprints=sum(
                points
                for n, points in season.sprint_points.get(driver, {}).items()
                if upto is None or n <= upto
            ),
            finishes=tuple(
                place for n, place in season.places.get(driver, {}).items() if n in done
            ),
        )
        for driver in drivers
    ]


def _to_come(season: SeasonResults, today: date) -> list[Round]:
    return [r for r in season.rounds if not r.race_done and r.race_date >= today - STILL_TO_COME]


def _remaining_after(season: SeasonResults, number: int, today: date) -> maths.Remaining:
    later = [
        r
        for r in season.rounds
        if r.number > number and (r.race_done or r in _to_come(season, today))
    ]
    return maths.Remaining(races=len(later), sprints=sum(r.sprint for r in later))


def decided_round(season: SeasonResults, today: date) -> Round | None:
    done = [r for r in season.rounds if r.race_done]
    steps = [
        (r.number, _tallies(season, r.number), _remaining_after(season, r.number, today))
        for r in done
    ]
    number = maths.decided_after(steps, season.rules)
    return next((r for r in done if r.number == number), None)


def title_state(year: int, today: date) -> TitleState | None:
    season = load(year)
    if season is None:
        return None
    to_come = _to_come(season, today)
    remaining = maths.Remaining(
        races=len(to_come),
        sprints=sum(r.sprint and not r.sprint_done for r in to_come),
    )
    table = maths.standings(_tallies(season, None), remaining, season.rules)
    next_round = to_come[0] if to_come else None
    clinch = None
    if next_round is not None:
        clinch = maths.clinch_margins(
            table,
            remaining,
            maths.Remaining(races=1, sprints=int(next_round.sprint and not next_round.sprint_done)),
            season.rules,
        )
    races_done = sum(r.race_done for r in season.rounds)
    points_left = sum(maths.future_races(remaining, season.rules)) + (
        remaining.sprints * season.rules.sprint_max
    )
    ids = [row.driver_id for row in table]
    drivers = Driver.objects.select_related("portrait").in_bulk(ids)
    return TitleState(
        year=year,
        rules=season.rules,
        races_done=races_done,
        remaining=remaining,
        points_left=points_left,
        table=table,
        drivers=drivers,
        decided=decided_round(season, today),
        next_round=next_round,
        clinch=clinch,
    )


def audit(year: int) -> list[dict[str, Any]]:
    """Drivers whose counted points with our rules differ from the official final standings
    (an empty list when the rules reproduce the championship)."""
    season = load(year)
    if season is None:
        return []
    final = (
        Standing.objects.filter(season__year=year, driver__isnull=False)
        .order_by("-round")
        .values_list("round", flat=True)
        .first()
    )
    if final is None:
        return []
    official = dict(
        Standing.objects.filter(season__year=year, round=final, driver__isnull=False).values_list(
            "driver_id", "points"
        )
    )
    out = []
    for tally in _tallies(season, None):
        ours = maths.counted(tally.races, tally.sprints, season.rules)
        theirs = official.get(tally.driver_id, 0.0)
        if abs(ours - theirs) > 0.01:
            out.append({"driver_id": tally.driver_id, "ours": ours, "official": theirs})
    return out


def data_stamp() -> str:
    """Changes whenever results are imported: part of the response's cache key."""
    seasons = Season.objects.aggregate(last=Max("results_ingested_at"))["last"]
    sessions = Session.objects.aggregate(last=Max("ingested_at"))["last"]
    return f"{seasons}-{sessions}"


def as_payload(state: TitleState) -> dict[str, Any]:
    """The title state shaped for the API: drivers who scored or can still win, best first."""
    leader = state.table[0].points if state.table else 0.0
    margins = state.clinch or {}
    return {
        "season": state.year,
        "rules": {
            "race_max": state.rules.race_max,
            "sprint_max": state.rules.sprint_max,
            "all_count": state.rules.all_count,
            "blocks": state.rules.blocks,
            "double_last_race": state.rules.double_last_race,
        },
        "races_done": state.races_done,
        "races_left": state.remaining.races,
        "sprints_left": state.remaining.sprints,
        "points_left": state.points_left,
        "decided": state.decided,
        "next_round": state.next_round,
        "drivers": [
            {
                "driver": state.drivers[row.driver_id],
                "points": row.points,
                "scored": row.scored,
                "ceiling": row.ceiling,
                "gap": leader - row.points,
                "status": row.status,
                "clinch_margin": margins.get(row.driver_id),
            }
            for row in state.table
            if row.scored > 0 or row.status is not maths.Status.OUT
        ],
    }

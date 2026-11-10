"""Race reports written from our own data (ADR 0012).

A report is a set of facts about one classified race or sprint: winner and margin, podium,
biggest climb, fastest lap, retirements, safety cars, the winner's strategy and the
championship after the round. The web turns these facts into sentences in English or
French, so nothing here is prose and nothing is copied from anyone.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, time
from typing import Any

from django.db.models import Count, Exists, F, OuterRef, QuerySet

from stintline.racing.models import (
    Event,
    Session,
    SessionEntry,
    SessionKind,
    Standing,
    TrackStatusKind,
)
from stintline.racing.selectors import ENTRY_ORDER

PODIUM = 3
MIN_NOTABLE_GAIN = 3
"""Places gained from the grid before a climb is worth a sentence."""
RETIRED_CODES = frozenset({"R", "D", "E", "N", "W"})
"""Jolpica ``positionText`` of drivers who were not classified at the finish."""
REPORT_KINDS = (SessionKind.RACE, SessionKind.SPRINT)
MAX_REPORTS = 30


@dataclass(frozen=True)
class Placed:
    entry: SessionEntry
    gap_s: float | None
    laps_down: int


def reported_sessions() -> QuerySet[Session]:
    """Races and sprints with a winner, most recent first."""
    winner = SessionEntry.objects.filter(session=OuterRef("pk"), finish_position=1)
    return (
        Session.objects.filter(kind__in=REPORT_KINDS)
        .filter(Exists(winner))
        .select_related("event__season", "event__circuit")
        .order_by("-event__race_date", F("scheduled_start").desc(nulls_last=True))
    )


def finished_at(session: Session) -> datetime:
    """When the report can be dated: the session end, else its start, else race day."""
    return (
        session.ends_at
        or session.scheduled_start
        or datetime.combine(session.event.race_date, time(), tzinfo=UTC)
    )


def _placed(entries: list[SessionEntry]) -> list[Placed]:
    winner = entries[0]
    out: list[Placed] = []
    for entry in entries[:PODIUM]:
        laps_down = max(winner.laps_completed - entry.laps_completed, 0)
        gap = (
            entry.race_time_s - winner.race_time_s
            if entry is not winner
            and laps_down == 0
            and entry.race_time_s is not None
            and winner.race_time_s is not None
            else None
        )
        out.append(Placed(entry, None if gap is None else round(gap, 3), laps_down))
    return out


def _biggest_gain(entries: list[SessionEntry]) -> SessionEntry | None:
    best: SessionEntry | None = None
    best_gain = MIN_NOTABLE_GAIN - 1
    for entry in entries:
        # Grid 0 means a pit-lane start in Jolpica: counted from the back of the grid.
        grid = entry.grid_position or (len(entries) if entry.grid_position == 0 else None)
        if grid is None or entry.finish_position is None:
            continue
        gain = grid - entry.finish_position
        if gain > best_gain:
            best, best_gain = entry, gain
    return best


def _neutralisations(session: Session) -> dict[str, int] | None:
    """Safety cars and red flags, only when race control was imported: without it, "no
    safety car" could not be told apart from missing data."""
    if not session.race_control.exists():
        return None
    counts = dict(
        session.track_statuses.values("status").annotate(n=Count("id")).values_list("status", "n")
    )
    return {
        "safety_cars": counts.get(TrackStatusKind.SAFETY_CAR, 0),
        "virtual_safety_cars": counts.get(TrackStatusKind.VIRTUAL_SAFETY_CAR, 0),
        "red_flags": counts.get(TrackStatusKind.RED_FLAG, 0),
    }


def _rain(session: Session) -> bool | None:
    """Whether rain was recorded during the session; ``None`` without weather data."""
    samples = session.weather.all()
    if not samples.exists():
        return None
    return samples.filter(rainfall=True).exists()


def _strategy(winner: SessionEntry) -> dict[str, Any] | None:
    compounds = list(winner.stints.order_by("stint_number").values_list("compound", flat=True))
    if not compounds:
        return None
    return {"stops": max(len(compounds) - 1, 0), "compounds": compounds}


def _career_wins(winner: SessionEntry, event: Event) -> int:
    """Grand Prix wins of the winner up to and including this one."""
    return SessionEntry.objects.filter(
        driver=winner.driver_id,
        finish_position=1,
        session__kind=SessionKind.RACE,
        session__event__race_date__lte=event.race_date,
    ).count()


def _championship(event: Event) -> dict[str, Any] | None:
    rows = Standing.objects.filter(season=event.season_id, driver__isnull=False)
    table = list(
        rows.filter(round=event.round).select_related("driver__portrait").order_by("position")[:2]
    )
    if not table or table[0].position != 1:
        return None
    leader = table[0]
    second = table[1] if len(table) > 1 else None
    before = (
        rows.filter(round__lt=event.round, position=1)
        .order_by("-round")
        .values_list("driver_id", flat=True)
        .first()
    )
    return {
        "round": event.round,
        "leader": leader.driver,
        "points": leader.points,
        "second": second.driver if second else None,
        "lead": leader.points - second.points if second else None,
        "leader_changed": before is not None and before != leader.driver_id,
    }


def _fill_team_colours(entries: list[SessionEntry], season_id: int) -> None:
    """Results imported from Jolpica carry no team colour: borrow the team's latest timing
    colour of the season (or of any season). In memory only, nothing is saved."""
    missing = {e.team_id for e in entries if not e.team_colour}
    if not missing:
        return
    latest: dict[int, str] = {}
    in_season: dict[int, str] = {}
    rows = (
        SessionEntry.objects.filter(team_id__in=missing)
        .exclude(team_colour="")
        .order_by("session__event__race_date")
        .values_list("team_id", "team_colour", "session__event__season_id")
    )
    for team_id, colour, season in rows:
        latest[team_id] = colour
        if season == season_id:
            in_season[team_id] = colour
    for entry in entries:
        if not entry.team_colour:
            entry.team_colour = in_season.get(entry.team_id) or latest.get(entry.team_id, "")


def build(session: Session) -> dict[str, Any] | None:
    """Facts of one race or sprint report; ``None`` while it has no winner."""
    entries = list(
        session.entries.select_related("driver__portrait", "team").order_by(*ENTRY_ORDER)
    )
    if not entries or entries[0].finish_position != 1:
        return None
    event = session.event
    _fill_team_colours(entries, event.season_id)
    winner = entries[0]
    classified = [e for e in entries if e.finish_position is not None]
    fastest = next((e for e in entries if e.fastest_lap_rank == 1), None)
    is_race = session.kind == SessionKind.RACE
    return {
        "session_id": session.pk,
        "kind": session.kind,
        "event": event,
        "finished_at": finished_at(session),
        "winner": winner,
        "winner_wins": _career_wins(winner, event) if is_race else None,
        "podium": _placed(classified),
        "starters": len(entries),
        "classified": len(classified),
        "biggest_gain": _biggest_gain(classified[PODIUM:]),
        "fastest_lap": fastest,
        "retirements": [e for e in entries if e.classification in RETIRED_CODES],
        "neutralisations": _neutralisations(session),
        "rain": _rain(session),
        "winner_strategy": _strategy(winner),
        "championship": _championship(event) if is_race else None,
    }

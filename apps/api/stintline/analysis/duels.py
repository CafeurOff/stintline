"""Head-to-head between two drivers over a season, and every team's teammate duel.

Qualifying and race head-to-heads work for every season since 1950 (Jolpica results).
The race-pace gap needs timing and the engine's figures, so it exists from 2023.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from statistics import median
from typing import Any

from django.db.models import QuerySet

from stintline.analysis.models import EntryRaceStats
from stintline.racing.hub import season_colours
from stintline.racing.models import Event, Season, SessionEntry, SessionKind, Team

POINT_KINDS = (SessionKind.RACE, SessionKind.SPRINT)
QUALI_SEGMENTS = ("q3_s", "q2_s", "q1_s")


@dataclass
class Weekend:
    event: Event
    race: dict[int, SessionEntry] = field(default_factory=dict)
    sprint: dict[int, SessionEntry] = field(default_factory=dict)
    quali: dict[int, SessionEntry] = field(default_factory=dict)


def season_weekends(year: int) -> list[Weekend]:
    """Every Grand Prix of the season with its race, sprint and qualifying entries."""
    weekends = {
        e.pk: Weekend(e)
        for e in Event.objects.filter(season__year=year).select_related("circuit").order_by("round")
    }
    entries: QuerySet[SessionEntry] = SessionEntry.objects.filter(
        session__event__season__year=year,
        session__kind__in=[SessionKind.RACE, SessionKind.SPRINT, SessionKind.QUALIFYING],
    ).select_related("session", "driver__portrait", "team", "stats")
    for entry in entries:
        weekend = weekends[entry.session.event_id]
        target = {
            SessionKind.RACE: weekend.race,
            SessionKind.SPRINT: weekend.sprint,
            SessionKind.QUALIFYING: weekend.quali,
        }[SessionKind(entry.session.kind)]
        target[entry.driver_id] = entry
    return [w for w in weekends.values() if w.race]


def _quali_position(weekend: Weekend, driver_id: int) -> int | None:
    """Qualifying position, else the grid (no qualifying data for most seasons before 1994;
    grid 0 means a pit-lane start)."""
    quali = weekend.quali.get(driver_id)
    if quali is not None and quali.finish_position:
        return quali.finish_position
    race = weekend.race.get(driver_id)
    return race.grid_position if race is not None and race.grid_position else None


def _quali_gap(weekend: Weekend, a: int, b: int) -> float | None:
    """A's time minus B's in the last segment both drivers set a time in."""
    qa, qb = weekend.quali.get(a), weekend.quali.get(b)
    if qa is None or qb is None:
        return None
    for segment in QUALI_SEGMENTS:
        ta: float | None = getattr(qa, segment)
        tb: float | None = getattr(qb, segment)
        if ta is not None and tb is not None:
            return round(ta - tb, 3)
    return None


def _pace(entry: SessionEntry | None) -> float | None:
    stats: EntryRaceStats | None = getattr(entry, "stats", None) if entry is not None else None
    if stats is None:
        return None
    return stats.median_corrected_s


def _points(weekend: Weekend, driver_id: int) -> float:
    return sum(e.points for e in (weekend.race.get(driver_id), weekend.sprint.get(driver_id)) if e)


def _classified(entry: SessionEntry) -> bool:
    return entry.classification.isdigit()


def _side_round(weekend: Weekend, driver_id: int) -> dict[str, Any] | None:
    race = weekend.race.get(driver_id)
    if race is None:
        return None
    return {
        "quali": _quali_position(weekend, driver_id),
        "finish": race.finish_position,
        "classification": race.classification,
        "status": race.status,
        "points": _points(weekend, driver_id),
        "team_ref": race.team.ref,
    }


def _side_totals(weekends: list[Weekend], driver_id: int) -> dict[str, Any]:
    races = [w.race[driver_id] for w in weekends if driver_id in w.race]
    finishes = [e.finish_position for e in races if _classified(e) and e.finish_position]
    grids = [p for w in weekends if (p := _quali_position(w, driver_id)) is not None]
    stats = [getattr(e, "stats", None) for e in races]
    timed = [s for s in stats if s is not None and s.laps_led is not None]
    return {
        "starts": len(races),
        "points": sum(_points(w, driver_id) for w in weekends),
        "wins": sum(1 for p in finishes if p == 1),
        "podiums": sum(1 for p in finishes if p <= 3),
        "poles": sum(1 for p in grids if p == 1),
        "finishes": len(finishes),
        "retirements": len(races) - len(finishes),
        "best_finish": min(finishes, default=None),
        "average_quali": round(sum(grids) / len(grids), 2) if grids else None,
        "average_finish": round(sum(finishes) / len(finishes), 2) if finishes else None,
        "laps_led": sum(s.laps_led or 0 for s in timed) if timed else None,
    }


def _ahead(a: int | None, b: int | None) -> int:
    """1 when A is ahead, -1 when B is, 0 when it cannot be told."""
    if a is None or b is None or a == b:
        return 0
    return 1 if a < b else -1


def pair(weekends: list[Weekend], a: int, b: int) -> dict[str, Any]:
    """Head-to-head of drivers ``a`` and ``b`` (driver ids) over ``weekends``."""
    rounds: list[dict[str, Any]] = []
    tally = {"quali": [0, 0], "race": [0, 0], "pace": [0, 0]}
    for w in weekends:
        side_a, side_b = _side_round(w, a), _side_round(w, b)
        if side_a is None or side_b is None:
            continue
        pace_a, pace_b = _pace(w.race.get(a)), _pace(w.race.get(b))
        pace_gap = round(pace_a - pace_b, 3) if pace_a is not None and pace_b is not None else None
        either_classified = _classified(w.race[a]) or _classified(w.race[b])
        verdicts = {
            "quali": _ahead(side_a["quali"], side_b["quali"]),
            "race": _ahead(side_a["finish"], side_b["finish"]) if either_classified else 0,
            "pace": 0 if pace_gap is None or pace_gap == 0 else (1 if pace_gap < 0 else -1),
        }
        for key, verdict in verdicts.items():
            if verdict:
                tally[key][0 if verdict > 0 else 1] += 1
        rounds.append(
            {
                "round": w.event.round,
                "event_id": w.event.pk,
                "name": w.event.name,
                "country": w.event.circuit.country,
                "session_id": w.race[a].session_id
                if getattr(w.race[a], "stats", None) is not None
                else None,
                "a": side_a,
                "b": side_b,
                "quali_gap_s": _quali_gap(w, a, b),
                "pace_gap_s": pace_gap,
            }
        )
    quali_gaps = [r["quali_gap_s"] for r in rounds if r["quali_gap_s"] is not None]
    pace_gaps = [r["pace_gap_s"] for r in rounds if r["pace_gap_s"] is not None]
    return {
        "shared_rounds": len(rounds),
        "quali": tally["quali"],
        "race": tally["race"],
        "pace": tally["pace"],
        "median_quali_gap_s": round(median(quali_gaps), 3) if quali_gaps else None,
        "median_pace_gap_s": round(median(pace_gaps), 3) if pace_gaps else None,
        "rounds": rounds,
    }


def _driver_side(
    weekends: list[Weekend], driver_id: int, colours: dict[int, str]
) -> dict[str, Any]:
    entry = next(w.race[driver_id] for w in reversed(weekends) if driver_id in w.race)
    return {
        "driver": entry.driver,
        "team": entry.team,
        "colour": colours.get(driver_id),
        **_side_totals(weekends, driver_id),
    }


def head_to_head(year: int, a: int, b: int) -> dict[str, Any] | None:
    """``None`` when either driver did not start a race that season."""
    weekends = season_weekends(year)
    started = {d for w in weekends for d in w.race}
    if a not in started or b not in started:
        return None
    colours = season_colours(Season.objects.get(year=year).pk).drivers
    return {
        "season": year,
        "a": _driver_side(weekends, a, colours),
        "b": _driver_side(weekends, b, colours),
        **pair(weekends, a, b),
    }


def _team_weekends(weekends: list[Weekend], team_id: int) -> list[Weekend]:
    """The same weekends, keeping only the team's own entries."""
    out = []
    for w in weekends:
        out.append(
            Weekend(
                w.event,
                {d: e for d, e in w.race.items() if e.team_id == team_id},
                {d: e for d, e in w.sprint.items() if e.team_id == team_id},
                {d: e for d, e in w.quali.items() if e.team_id == team_id},
            )
        )
    return out


def _main_pair(weekends: list[Weekend]) -> tuple[int, int] | None:
    """The two drivers who shared the most race weekends for the team."""
    shared: dict[tuple[int, int], int] = defaultdict(int)
    for w in weekends:
        drivers = sorted(w.race)
        for i, a in enumerate(drivers):
            for b in drivers[i + 1 :]:
                shared[(a, b)] += 1
    if not shared:
        return None
    return max(shared, key=lambda k: (shared[k], -k[0]))


def teammates(year: int) -> list[dict[str, Any]]:
    """Every team's main teammate duel, best-scoring team first."""
    weekends = season_weekends(year)
    season = Season.objects.filter(year=year).first()
    if season is None or not weekends:
        return []
    colours = season_colours(season.pk)
    team_ids = {e.team_id for w in weekends for e in w.race.values()}
    out = []
    for team in Team.objects.filter(pk__in=team_ids):
        own = _team_weekends(weekends, team.pk)
        duo = _main_pair(own)
        if duo is None:
            continue
        a, b = duo
        side_a = _driver_side(own, a, colours.drivers)
        side_b = _driver_side(own, b, colours.drivers)
        if side_b["points"] > side_a["points"]:
            a, b, side_a, side_b = b, a, side_b, side_a
        out.append(
            {
                "team": team,
                "colour": colours.teams.get(team.pk),
                "a": side_a,
                "b": side_b,
                **pair(own, a, b),
            }
        )
    return sorted(out, key=lambda d: -(d["a"]["points"] + d["b"]["points"]))

"""Read queries of the technical page (ADR 0019): upgrades with the race pace around them,
power-unit usage against the allowance, incidents and penalty points."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from statistics import median
from typing import Any

from stintline.analysis.models import EntryRaceStats
from stintline.paddock.models import StewardsDecision
from stintline.racing.hub import season_colours
from stintline.racing.models import Event, Season, SessionKind, Team
from stintline.technical.models import CarUpgrade, PowerUnitChange, PowerUnitUsage

PACE_WINDOW_RACES = 3
"""Races on each side of an upgrade (validated with the maintainer on 2026-11-13): the three
before it, and the upgrade race with the two after it."""
MIN_WINDOW_RACES = 2
"""A side with fewer races (season start, retirements) gives no pace comparison."""
PENALTY_POINTS_WINDOW = timedelta(days=365)
"""Penalty points count for twelve months (FIA International Sporting Code)."""
BAN_THRESHOLD_POINTS = 12
"""Twelve points in twelve months bring a one-race ban."""

ELEMENT_ORDER = ("ICE", "TC", "MGU-H", "MGU-K", "ES", "CE", "EX", "ANC")


def _round(value: float | None, digits: int = 3) -> float | None:
    return round(value, digits) if value is not None else None


def _event_ref(event: Event) -> dict[str, Any]:
    return {
        "event_id": event.pk,
        "round": event.round,
        "name": event.name,
        "country": event.circuit.country,
    }


# --------------------------------------------------------------------- upgrades


def team_pace(season: int) -> dict[int, list[tuple[date, int, float]]]:
    """``{team_id: [(race date, event id, gap to the field %)]}``: the median over the
    team's cars of the fuel-corrected race pace against the field median (2023+)."""
    rows = EntryRaceStats.objects.filter(
        entry__session__event__season__year=season,
        entry__session__kind=SessionKind.RACE,
        median_corrected_s__isnull=False,
        entry__session__stats__field_median_s__isnull=False,
    ).values_list(
        "entry__team_id",
        "entry__session__event_id",
        "entry__session__event__race_date",
        "median_corrected_s",
        "entry__session__stats__field_median_s",
    )
    per: dict[tuple[int, int, date], list[float]] = defaultdict(list)
    for team_id, event_id, race_date, pace, field in rows:
        if pace is None or not field:
            continue
        per[(team_id, event_id, race_date)].append((float(pace) / float(field) - 1) * 100)
    out: dict[int, list[tuple[date, int, float]]] = defaultdict(list)
    for (team_id, event_id, race_date), gaps in per.items():
        out[team_id].append((race_date, event_id, median(gaps)))
    for series in out.values():
        series.sort()
    return out


def pace_around(
    series: list[tuple[date, int, float]], race_date: date
) -> tuple[float | None, float | None, int, int]:
    """Median gap to the field over the races before an upgrade and from it on."""
    before = [gap for d, _, gap in series if d < race_date][-PACE_WINDOW_RACES:]
    after = [gap for d, _, gap in series if d >= race_date][:PACE_WINDOW_RACES]
    return (
        median(before) if len(before) >= MIN_WINDOW_RACES else None,
        median(after) if len(after) >= MIN_WINDOW_RACES else None,
        len(before),
        len(after),
    )


def upgrades(year: int) -> dict[str, Any] | None:
    season = Season.objects.filter(year=year).first()
    if season is None:
        return None
    rows = list(
        CarUpgrade.objects.filter(event__season=season).select_related(
            "event__circuit", "team", "document"
        )
    )
    if not rows:
        return None
    colours = season_colours(season.pk).teams
    events = list(
        Event.objects.filter(season=season, upgrades__isnull=False)
        .select_related("circuit")
        .distinct()
        .order_by("round")
    )
    pace = team_pace(year)
    by_team: dict[int | None, list[CarUpgrade]] = defaultdict(list)
    for row in rows:
        by_team[row.team_id].append(row)
    teams: list[dict[str, Any]] = []
    for team_id, items in by_team.items():
        team: Team | None = items[0].team
        cells = []
        for event in events:
            mine = [u for u in items if u.event_id == event.pk]
            if not mine:
                continue
            before, after, n_before, n_after = pace_around(
                pace.get(team_id or 0, []), event.race_date
            )
            cells.append(
                {
                    "event_id": event.pk,
                    "round": event.round,
                    "count": len(mine),
                    "performance": sum(1 for u in mine if u.reason == "performance"),
                    "pace_before_pct": _round(before),
                    "pace_after_pct": _round(after),
                    "races_before": n_before,
                    "races_after": n_after,
                }
            )
        teams.append(
            {
                "team": team,
                "team_name": items[0].team_name,
                "colour": colours.get(team_id) if team_id else None,
                "upgrades": len(items),
                "cells": cells,
            }
        )
    teams.sort(key=lambda t: -t["upgrades"])
    return {
        "season": year,
        "rounds": [_event_ref(e) for e in events],
        "teams": teams,
        "upgrades": [
            {
                "id": u.pk,
                "document_id": u.document_id,
                "event_id": u.event_id,
                "round": u.event.round,
                "team_ref": u.team.ref if u.team else None,
                "team_name": u.team_name,
                "number": u.number,
                "component": u.component,
                "zone": u.zone,
                "reason": u.reason,
                "reason_detail": u.reason_detail,
                "difference": u.difference,
                "description": u.description,
            }
            for u in rows
        ],
    }


# ------------------------------------------------------------------ power units


def power_units(year: int) -> dict[str, Any] | None:
    season = Season.objects.filter(year=year).first()
    usage = PowerUnitUsage.objects.filter(event__season__year=year)
    if season is None or not usage.exists():
        return None
    latest = usage.order_by("-event__race_date", "-document__published_at").first()
    assert latest is not None  # noqa: S101  (exists() above)
    rows = list(
        PowerUnitUsage.objects.filter(document_id=latest.document_id).select_related(
            "driver__portrait"
        )
    )
    changes = list(
        PowerUnitChange.objects.filter(event__season=season)
        .select_related("event__circuit")
        .order_by("event__round", "car_number")
    )
    allowed: dict[str, int] = {}
    for change in changes:
        if change.allowed is not None:
            allowed[change.element] = max(allowed.get(change.element, 0), change.allowed)
    colours = season_colours(season.pk).drivers
    present = {r.element for r in rows}
    elements = [e for e in ELEMENT_ORDER if e in present]
    cars: dict[int, dict[str, Any]] = {}
    for row in rows:
        car = cars.setdefault(
            row.car_number,
            {
                "car_number": row.car_number,
                "driver": row.driver,
                "label": row.label,
                "colour": colours.get(row.driver_id) if row.driver_id else None,
                "used": {},
                "changes": [],
            },
        )
        car["used"][row.element] = row.used
    for change in changes:
        target = cars.get(change.car_number)
        if target is not None:
            target["changes"].append(
                {
                    **_event_ref(change.event),
                    "element": change.element,
                    "number": change.number,
                    "allowed": change.allowed,
                    "compliant": change.compliant,
                }
            )
    out = []
    for car in cars.values():
        over = [e for e in elements if e in allowed and car["used"].get(e, 0) > allowed[e]]
        out.append(
            {
                **car,
                "over": over,
                "beyond": sum(1 for c in car["changes"] if c["compliant"] is False),
            }
        )
    out.sort(key=lambda c: (-len(c["over"]), -sum(c["used"].values())))
    return {
        "season": year,
        "as_of": _event_ref(latest.event),
        "document_id": latest.document_id,
        "elements": elements,
        "allowed": allowed,
        "cars": out,
    }


# -------------------------------------------------------------------- incidents

INCIDENT_KINDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("power_unit", ("power unit element", "pu element", "power unit elements")),
    ("unsafe_release", ("unsafe release", "released in an unsafe", "unsafe manner")),
    ("pit_speeding", ("pit lane speed", "speeding")),
    ("collision", ("collision", "collid", "contact with")),
    ("track_limits", ("track limits", "left the track", "leaving the track", "off the track")),
    ("impeding", ("imped",)),
    ("flags", ("yellow flag", "red flag", "blue flag", "double yellow")),
    (
        "procedure",
        (
            "pit exit",
            "reconnaissance",
            "parc ferm",
            "false start",
            "grid",
            "procedure",
            "start position",
            "formation lap",
        ),
    ),
    ("driving", ("erratic", "forcing", "unsafe", "dangerous", "overtaking")),
    ("technical", ("technical", "scrutineering", "weight", "fuel", "tyre", "parc ferm", "plank")),
)


def incident_kind(decision: StewardsDecision) -> str:
    text = f"{decision.fact} {decision.infringement} {decision.document.title}".lower()
    return next((kind for kind, words in INCIDENT_KINDS if any(w in text for w in words)), "other")


@dataclass(frozen=True)
class _Points:
    when: date
    points: int


def incidents(year: int) -> dict[str, Any] | None:
    season = Season.objects.filter(year=year).first()
    if season is None:
        return None
    rows = list(
        StewardsDecision.objects.filter(document__event__season=season).select_related(
            "document__event__circuit", "driver__portrait", "session"
        )
    )
    if not rows:
        return None
    colours = season_colours(season.pk).drivers
    events = list(
        Event.objects.filter(season=season, fia_documents__decision__isnull=False)
        .select_related("circuit")
        .distinct()
        .order_by("round")
    )
    earliest = min(e.race_date for e in events) - PENALTY_POINTS_WINDOW
    history = StewardsDecision.objects.filter(
        penalty_points__gt=0,
        driver__isnull=False,
        document__event__race_date__gte=earliest,
    ).values_list("driver_id", "document__event__race_date", "penalty_points")
    points_of: dict[int, list[_Points]] = defaultdict(list)
    for driver_id, when, points in history:
        points_of[driver_id].append(_Points(when, points))

    kinds: dict[str, dict[str, int]] = defaultdict(lambda: {"decisions": 0, "penalties": 0})
    drivers: dict[int, dict[str, Any]] = {}
    for row in rows:
        kind = incident_kind(row)
        kinds[kind]["decisions"] += 1
        kinds[kind]["penalties"] += int(row.is_penalty)
        if row.driver is None:
            continue
        line = drivers.setdefault(
            row.driver_id or 0,
            {
                "driver": row.driver,
                "colour": colours.get(row.driver_id or 0),
                "decisions": 0,
                "penalties": 0,
                "points": 0,
                "kinds": defaultdict(int),
            },
        )
        line["decisions"] += 1
        line["penalties"] += int(row.is_penalty)
        line["points"] += row.penalty_points
        line["kinds"][kind] += 1

    def rolling(driver_id: int, on: date) -> int:
        return sum(
            p.points
            for p in points_of.get(driver_id, [])
            if on - PENALTY_POINTS_WINDOW < p.when <= on
        )

    out = []
    for driver_id, line in drivers.items():
        series = [rolling(driver_id, e.race_date) for e in events]
        out.append(
            {
                **line,
                "kinds": dict(line["kinds"]),
                "points_12m": series[-1] if series else 0,
                "points_by_round": series,
            }
        )
    out.sort(key=lambda d: (-d["points_12m"], -d["penalties"], -d["decisions"]))
    return {
        "season": year,
        "threshold": BAN_THRESHOLD_POINTS,
        "rounds": [_event_ref(e) for e in events],
        "kinds": [
            {"kind": k, **v} for k, v in sorted(kinds.items(), key=lambda kv: -kv[1]["decisions"])
        ],
        "drivers": out,
        "decisions": [
            {
                "document_id": r.document_id,
                **_event_ref(r.document.event),
                "driver": r.driver,
                "driver_name": r.driver_name,
                "colour": colours.get(r.driver_id or 0) if r.driver_id else None,
                "session_label": r.session_label,
                "lap": r.lap,
                "kind": incident_kind(r),
                "fact": r.fact,
                "is_penalty": r.is_penalty,
                "time_penalty_s": r.time_penalty_s,
                "grid_places": r.grid_places,
                "penalty_points": r.penalty_points,
                "drive_through": r.drive_through,
                "stop_go_s": r.stop_go_s,
                "back_of_grid": r.back_of_grid,
                "pit_lane_start": r.pit_lane_start,
                "reprimand": r.reprimand,
                "fine_eur": r.fine_eur,
                "disqualified": r.disqualified,
                "lap_time_deleted": r.lap_time_deleted,
                "no_further_action": r.no_further_action,
            }
            for r in sorted(rows, key=lambda r: (r.document.event.round, r.document.number))
        ],
    }

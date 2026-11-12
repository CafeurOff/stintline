"""Season pages: consistency of every driver and pit stops (ADR 0017)."""

from __future__ import annotations

from collections import defaultdict
from statistics import median
from typing import Any

from stintline.analysis.build import MIN_STATIONARY_S
from stintline.analysis.models import EntryRaceStats, RaceStats
from stintline.racing.hub import season_colours
from stintline.racing.models import PitStop, Season, SessionEntry, SessionKind

MIN_RACES = 3
"""Races with a consistency figure a driver needs to be ranked: a stand-in driver's one
race says little about them."""

FASTEST_STOPS_SHOWN = 15


def _round(value: float | None, digits: int = 3) -> float | None:
    return round(value, digits) if value is not None else None


def _race_ref(entry: SessionEntry) -> dict[str, Any]:
    event = entry.session.event
    return {
        "round": event.round,
        "event_id": event.pk,
        "session_id": entry.session_id,
        "name": event.name,
        "country": event.circuit.country,
    }


def consistency(year: int) -> list[dict[str, Any]]:
    """Drivers ranked by their median lap-to-lap scatter over the season's races."""
    season = Season.objects.filter(year=year).first()
    if season is None:
        return []
    colours = season_colours(season.pk).drivers
    rows = (
        EntryRaceStats.objects.filter(
            entry__session__event__season=season,
            entry__session__kind=SessionKind.RACE,
            spread_s__isnull=False,
        )
        .select_related("entry__driver__portrait", "entry__team", "entry__session__event__circuit")
        .order_by("entry__session__event__round")
    )
    by_driver: dict[int, list[EntryRaceStats]] = defaultdict(list)
    for row in rows:
        by_driver[row.entry.driver_id].append(row)
    out = []
    for driver_id, races in by_driver.items():
        if len(races) < MIN_RACES:
            continue
        spreads = [r.spread_s for r in races if r.spread_s is not None]
        best = min(races, key=lambda r: r.spread_s or 0.0)
        worst = max(races, key=lambda r: r.spread_s or 0.0)
        latest = races[-1].entry
        out.append(
            {
                "driver": latest.driver,
                "team": latest.team,
                "colour": colours.get(driver_id),
                "median_spread_s": round(median(spreads), 3),
                "best": {**_race_ref(best.entry), "spread_s": _round(best.spread_s)},
                "worst": {**_race_ref(worst.entry), "spread_s": _round(worst.spread_s)},
                "races": [
                    {
                        **_race_ref(r.entry),
                        "spread_s": _round(r.spread_s),
                        "clean_laps": r.clean_laps,
                    }
                    for r in races
                ],
            }
        )
    return sorted(out, key=lambda d: d["median_spread_s"])


def _median(values: list[float]) -> float | None:
    return round(median(values), 3) if values else None


def _stop(stop: PitStop, colours: dict[int, str]) -> dict[str, Any]:
    return {
        "driver": stop.entry.driver,
        "team": stop.entry.team,
        "colour": colours.get(stop.entry.driver_id),
        "lap": stop.lap_number,
        "stationary_s": stop.stationary_duration_s,
        "lane_s": stop.pit_lane_duration_s,
        **_race_ref(stop.entry),
    }


def pit_stops(year: int) -> dict[str, Any] | None:
    """Fastest stops, team averages and every race's stops, pit loss and undercuts."""
    season = Season.objects.filter(year=year).first()
    if season is None:
        return None
    colours = season_colours(season.pk)
    stops = list(
        PitStop.objects.filter(
            entry__session__event__season=season, entry__session__kind=SessionKind.RACE
        ).select_related("entry__driver__portrait", "entry__team", "entry__session__event__circuit")
    )
    if not stops:
        return None

    def stationary(stop: PitStop) -> float | None:
        s = stop.stationary_duration_s
        return s if s is not None and s >= MIN_STATIONARY_S else None

    timed = sorted(
        (s for s in stops if stationary(s) is not None),
        key=lambda s: s.stationary_duration_s or 0.0,
    )
    by_team: dict[int, list[PitStop]] = defaultdict(list)
    by_session: dict[int, list[PitStop]] = defaultdict(list)
    for stop in stops:
        by_team[stop.entry.team_id].append(stop)
        by_session[stop.entry.session_id].append(stop)

    teams = []
    for team_stops in by_team.values():
        still = [v for s in team_stops if (v := stationary(s)) is not None]
        lane = [s.pit_lane_duration_s for s in team_stops if s.pit_lane_duration_s is not None]
        team = team_stops[0].entry.team
        teams.append(
            {
                "team": team,
                "colour": colours.teams.get(team.pk),
                "stops": len(team_stops),
                "median_stationary_s": _median(still),
                "best_stationary_s": min(still, default=None),
                "median_lane_s": _median(lane),
                "best_lane_s": _round(min(lane, default=None)),
            }
        )
    teams.sort(
        key=lambda t: (
            t["median_stationary_s"] is None,
            t["median_stationary_s"] or t["median_lane_s"] or 0.0,
        )
    )

    stats = {r.session_id: r for r in RaceStats.objects.filter(session_id__in=by_session.keys())}
    races = []
    for session_id, race_stops in by_session.items():
        ranked = sorted(
            (s for s in race_stops if stationary(s) is not None),
            key=lambda s: s.stationary_duration_s or 0.0,
        )
        lane = [s.pit_lane_duration_s for s in race_stops if s.pit_lane_duration_s is not None]
        rs = stats.get(session_id)
        undercuts = rs.undercuts if rs is not None else []
        races.append(
            {
                **_race_ref(race_stops[0].entry),
                "stops": len(race_stops),
                "median_stationary_s": _median([v for s in ranked if (v := stationary(s))]),
                "median_lane_s": _median(lane),
                "fastest": _stop(ranked[0], colours.drivers) if ranked else None,
                "pit_loss_s": _round(rs.pit_loss_s, 2) if rs else None,
                "pit_loss_sigma_s": _round(rs.pit_loss_sigma_s, 2) if rs else None,
                "undercut_attempts": len(undercuts),
                "undercut_successes": sum(1 for u in undercuts if u["gap_after_s"] < 0),
            }
        )
    races.sort(key=lambda r: r["round"])
    attempts = sum(r["undercut_attempts"] for r in races)
    return {
        "season": year,
        "stops": len(stops),
        "timed_stops": len(timed),
        "undercut_attempts": attempts,
        "undercut_successes": sum(r["undercut_successes"] for r in races),
        "fastest": [_stop(s, colours.drivers) for s in timed[:FASTEST_STOPS_SHOWN]],
        "teams": teams,
        "races": races,
    }

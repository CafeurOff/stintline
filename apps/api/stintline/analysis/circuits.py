"""Track DNA: what our stored races say about each circuit (ADR 0017).

Only Grands Prix (not sprints) count, from the first timed season (2023) on.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from statistics import mean, median
from typing import Any

from stintline.analysis.models import RaceStats
from stintline.racing.models import Circuit, SessionEntry, SessionKind

DRY_COMPOUNDS = ("SOFT", "MEDIUM", "HARD")


def _median(values: list[float], digits: int = 3) -> float | None:
    return round(median(values), digits) if values else None


def _latest(values: list[float | int | None]) -> float | int | None:
    """Newest non-null value (races are sorted oldest first)."""
    return next((v for v in reversed(values) if v is not None), None)


def _race_row(stats: RaceStats, winner: SessionEntry | None) -> dict[str, Any]:
    event = stats.session.event
    undercuts = stats.undercuts
    return {
        "year": event.season.year,
        "event_id": event.pk,
        "session_id": stats.session_id,
        "name": event.name,
        "winner": winner.driver if winner else None,
        "winner_team": winner.team if winner else None,
        "winner_colour": winner.team_colour or None if winner else None,
        "winner_strategy": stats.winner_strategy,
        "wet": stats.wet,
        "passes": stats.passes,
        "safety_cars": stats.safety_cars,
        "virtual_safety_cars": stats.virtual_safety_cars,
        "red_flags": stats.red_flags,
        "pit_loss_s": round(stats.pit_loss_s, 2) if stats.pit_loss_s is not None else None,
        "pit_loss_reliable": stats.pit_loss_reliable,
        "fastest_lap_s": stats.fastest_lap_s,
        "undercut_attempts": len(undercuts),
        "undercut_successes": sum(1 for u in undercuts if u["gap_after_s"] < 0),
    }


def _profile(
    circuit: Circuit, races: list[RaceStats], winners: dict[int, SessionEntry]
) -> dict[str, Any]:
    dry = [r for r in races if not r.wet]
    reliable = [r for r in races if r.pit_loss_reliable]
    per_compound = {
        c: _median([r.degradation[c] for r in dry if c in r.degradation], 4) for c in DRY_COMPOUNDS
    }
    slopes = [
        mean(v for c, v in r.degradation.items() if c in DRY_COMPOUNDS)
        for r in dry
        if any(c in r.degradation for c in DRY_COMPOUNDS)
    ]
    passes = [r.passes for r in races if r.passes is not None]
    undercuts = [u for r in races for u in r.undercuts]
    strategies = Counter(max(len(r.winner_strategy) - 1, 0) for r in races if r.winner_strategy)
    fastest = min(
        (r for r in races if r.fastest_lap_s is not None),
        key=lambda r: r.fastest_lap_s or 0.0,
        default=None,
    )
    latest = races[-1]
    return {
        "circuit": circuit,
        "races": len(races),
        "latest_event_id": latest.session.event_id,
        "latest_session_id": latest.session_id,
        "lap_length_m": _latest([r.lap_length_m for r in races]),
        "top_speed_kph": _latest([r.top_speed_kph for r in races]),
        "full_throttle_share": _latest([r.full_throttle_share for r in races]),
        "braking_zones": _latest([r.braking_zones for r in races]),
        "pit_loss_s": _median([r.pit_loss_s for r in reliable if r.pit_loss_s is not None], 2),
        "pit_loss_sigma_s": _median(
            [r.pit_loss_sigma_s for r in reliable if r.pit_loss_sigma_s is not None], 2
        ),
        "degradation_s_per_lap": _median(slopes, 4),
        "degradation": per_compound,
        "safety_car_races": sum(1 for r in races if r.safety_cars),
        "vsc_races": sum(1 for r in races if r.virtual_safety_cars),
        "wet_races": sum(1 for r in races if r.wet),
        "passes_per_race": round(mean(passes), 1) if passes else None,
        "undercut_attempts": len(undercuts),
        "undercut_successes": sum(1 for u in undercuts if u["gap_after_s"] < 0),
        "winning_stops": [{"stops": k, "races": v} for k, v in sorted(strategies.items())],
        "fastest_lap_s": fastest.fastest_lap_s if fastest else None,
        "fastest_lap_year": fastest.session.event.season.year if fastest else None,
        "history": [_race_row(r, winners.get(r.session_id)) for r in reversed(races)],
    }


def circuit_profiles() -> list[dict[str, Any]]:
    """One profile per circuit raced since timing exists, in calendar order of the latest
    season that visited it."""
    stats = (
        RaceStats.objects.filter(session__kind=SessionKind.RACE)
        .select_related("session__event__circuit", "session__event__season")
        .order_by("session__event__race_date")
    )
    by_circuit: dict[int, list[RaceStats]] = defaultdict(list)
    for row in stats:
        by_circuit[row.session.event.circuit_id].append(row)
    winners = {
        e.session_id: e
        for e in SessionEntry.objects.filter(
            session__stats__isnull=False, session__kind=SessionKind.RACE, finish_position=1
        ).select_related("driver__portrait", "team")
    }
    latest = sorted(
        (races[-1] for races in by_circuit.values()),
        key=lambda r: (-r.session.event.season.year, r.session.event.round),
    )
    return [
        _profile(r.session.event.circuit, by_circuit[r.session.event.circuit_id], winners)
        for r in latest
    ]

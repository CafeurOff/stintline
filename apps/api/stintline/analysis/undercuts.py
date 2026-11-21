"""Every undercut tried at a circuit, from the attempts stored after each import (ADR 0017).

Only Grands Prix (not sprints) count, as on Track DNA. The engine finds the attempts
(``stintline_strategy.analysis.undercut_attempts``); this module only names the cars and
summarises them.
"""

from __future__ import annotations

from statistics import median
from typing import Any

from stintline.analysis.models import RaceStats
from stintline.racing.models import Circuit, SessionEntry, SessionKind

UNDERCUT_MEDIAN_MIN_ATTEMPTS = 3
"""Dry attempts a circuit needs before its median gain is shown. Below that, one odd stop
(a slow wheel nut, traffic on the out-lap) would stand for the whole circuit."""


def _car(entry: SessionEntry | None, number: int) -> dict[str, Any]:
    return {
        "car_number": number,
        "driver": entry.driver if entry else None,
        "team": entry.team if entry else None,
        "colour": (entry.team_colour or None) if entry else None,
    }


def _attempt(
    stats: RaceStats, raw: dict[str, Any], entries: dict[tuple[int, int], SessionEntry]
) -> dict[str, Any]:
    event = stats.session.event
    before = float(raw["gap_before_s"])
    after = float(raw["gap_after_s"])
    attacker = int(raw["attacker"])
    defender = int(raw["defender"])
    return {
        "year": event.season.year,
        "event_id": event.pk,
        "session_id": stats.session_id,
        "wet": stats.wet,
        "attacker": _car(entries.get((stats.session_id, attacker)), attacker),
        "defender": _car(entries.get((stats.session_id, defender)), defender),
        "attacker_lap": int(raw["attacker_lap"]),
        "defender_lap": int(raw["defender_lap"]),
        "gap_before_s": round(before, 3),
        "gap_after_s": round(after, 3),
        "gain_s": round(before - after, 3),
        "success": after < 0,
    }


def circuit_undercuts(circuit: Circuit) -> dict[str, Any]:
    """Every attempt at the circuit, newest race first, with the median gain of dry races.

    Gain is the gap before the attacker's stop minus the gap at the end of the defender's
    out-lap: positive means the attacker gained on the car ahead.
    """
    stats = list(
        RaceStats.objects.filter(session__kind=SessionKind.RACE, session__event__circuit=circuit)
        .select_related("session__event__season")
        .order_by("-session__event__race_date")
    )
    entries = {
        (e.session_id, e.car_number): e
        for e in SessionEntry.objects.filter(
            session_id__in=[s.session_id for s in stats]
        ).select_related("driver__portrait", "team")
    }
    attempts = [
        _attempt(s, raw, entries)
        for s in stats
        for raw in sorted(s.undercuts, key=lambda u: (u["attacker_lap"], u["attacker"]))
    ]
    dry = [a["gain_s"] for a in attempts if not a["wet"]]
    enough = len(dry) >= UNDERCUT_MEDIAN_MIN_ATTEMPTS
    return {
        "circuit": circuit,
        "races": len(stats),
        "attempts": attempts,
        "successes": sum(1 for a in attempts if a["success"]),
        "dry_attempts": len(dry),
        "median_gain_s": round(median(dry), 2) if enough else None,
        "min_attempts": UNDERCUT_MEDIAN_MIN_ATTEMPTS,
    }

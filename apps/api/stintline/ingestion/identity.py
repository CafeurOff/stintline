"""Who drove each car in a practice or sprint-qualifying session (ADR 0028).

Jolpica, the source of driver identity (ADR 0004), publishes no classification for these
sessions, and FP1/FP2 run before any classification of the weekend exists. A car number
is resolved from entries already stored, nearest first: this session (qualifying results
from Jolpica), the rest of the weekend, earlier rounds of the season, then the previous
season. A candidate is accepted only when its driver's code matches the three-letter
acronym of the timing feed, so a number handed to another driver is never mistaken.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.db.models import Q

from racedata.models import DriverEntry
from stintline.racing.models import Driver, Session, SessionEntry, Team


@dataclass(frozen=True)
class Identity:
    driver: Driver
    team: Team


def resolve_identities(
    session: Session, drivers: list[DriverEntry]
) -> tuple[dict[int, Identity], list[int]]:
    """Identity per car number, and the car numbers left unknown (sorted)."""
    event = session.event
    season = event.season.year
    candidates = list(
        SessionEntry.objects.filter(
            Q(session__event__season__year=season, session__event__round__lte=event.round)
            | Q(session__event__season__year=season - 1)
        )
        .select_related("driver", "team", "session__event__season")
        .order_by()
    )
    candidates.sort(key=lambda e: _nearness(e, session), reverse=True)

    by_number: dict[int, list[SessionEntry]] = {}
    by_code: dict[str, list[SessionEntry]] = {}
    for entry in candidates:
        by_number.setdefault(entry.car_number, []).append(entry)
        if entry.driver.code:
            by_code.setdefault(entry.driver.code.upper(), []).append(entry)

    found: dict[int, Identity] = {}
    unknown: list[int] = []
    for car in drivers:
        acronym = (car.acronym or "").upper()
        match = next(
            (e for e in by_number.get(car.driver_number, []) if _same_driver(e.driver, acronym)),
            None,
        )
        if match is None and acronym:
            # A driver who changed number keeps their code: take their latest team.
            match = next(iter(by_code.get(acronym, [])), None)
        if match is None:
            unknown.append(car.driver_number)
            continue
        found[car.driver_number] = Identity(match.driver, match.team)
    return found, sorted(unknown)


def _same_driver(driver: Driver, acronym: str) -> bool:
    """Without a code on either side there is nothing to contradict the car number."""
    return not acronym or not driver.code or driver.code.upper() == acronym


def _nearness(entry: SessionEntry, session: Session) -> tuple[int, int, int, float]:
    """Sort key, larger is nearer: this session, then this weekend, then the latest
    round of the season, then the previous season."""
    other = entry.session
    same_session = int(other.pk == session.pk)
    same_event = int(other.event_id == session.event_id)
    start = other.scheduled_start or other.starts_at
    return (
        same_session,
        same_event,
        other.event.season.year * 100 + other.event.round,
        start.timestamp() if start else 0.0,
    )

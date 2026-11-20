"""Season calendar: events and sessions from Jolpica, linked to their OpenF1 sessions."""

from __future__ import annotations

import structlog
from django.db import transaction

from racedata.matching import match_sessions
from racedata.models import (
    EventInfo,
    TimingSession,
)
from racedata.models import SessionKind as SourceKind
from racedata.sources import Sources
from stintline.racing.models import (
    Circuit,
    Event,
    Season,
    Session,
    SessionKind,
)

log = structlog.get_logger(__name__)


def ingest_calendar(
    season: int, sources: Sources, kinds: frozenset[SessionKind] | None = None
) -> list[Event]:
    """Upsert every event of ``season`` and its sessions, linking OpenF1 session keys.

    ``kinds`` limits which OpenF1 sessions are looked up (``None`` = all kinds).
    """
    infos = sources.schedule.season_events(season)
    timing = _timing_sessions(season, sources, kinds)
    events = [_upsert_event(info, match_sessions(info, timing)) for info in infos]
    log.info("calendar_ingested", season=season, events=len(events), timing_sessions=len(timing))
    return events


def _timing_sessions(
    season: int, sources: Sources, kinds: frozenset[SessionKind] | None
) -> list[TimingSession]:
    if kinds is None:
        return sources.timing.sessions(season)
    out: list[TimingSession] = []
    for kind in sorted(kinds):
        out.extend(sources.timing.sessions(season, SourceKind(kind)))
    return out


@transaction.atomic
def _upsert_event(info: EventInfo, matched: dict[SourceKind, TimingSession]) -> Event:
    season, _ = Season.objects.get_or_create(year=info.season)
    meeting_keys = {ts.meeting_key for ts in matched.values()}
    circuit_keys = {ts.circuit_key for ts in matched.values() if ts.circuit_key is not None}
    circuit, _ = Circuit.objects.update_or_create(
        ref=info.circuit.circuit_id,
        defaults={
            "name": info.circuit.name,
            "locality": info.circuit.locality,
            "country": info.circuit.country,
            **({"openf1_circuit_key": circuit_keys.pop()} if len(circuit_keys) == 1 else {}),
        },
    )
    event, _ = Event.objects.update_or_create(
        season=season,
        round=info.round,
        defaults={
            "name": info.name,
            "circuit": circuit,
            "race_date": info.race_date,
            "format": info.format.value,
            **({"openf1_meeting_key": meeting_keys.pop()} if len(meeting_keys) == 1 else {}),
        },
    )
    for scheduled in info.sessions:
        timing = matched.get(scheduled.kind)
        defaults: dict[str, object] = {"scheduled_start": scheduled.starts_at}
        if timing is not None:
            defaults |= {
                "starts_at": timing.starts_at,
                "ends_at": timing.ends_at,
                "openf1_session_key": timing.session_key,
            }
        Session.objects.update_or_create(event=event, kind=scheduled.kind.value, defaults=defaults)
    return event

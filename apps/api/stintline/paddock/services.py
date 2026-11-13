"""Import FIA documents, extract their text and read the stewards' decisions (ADR 0018).

Every call to fia.com waits for the shared slot (``throttle``) on top of ``racedata``'s own
limiter. Idempotent: documents are keyed by their PDF URL.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

import structlog
from django.db import transaction

from racedata.errors import InvalidPayloadError, NotFoundError, ProviderError
from racedata.models import FiaDocumentRef, StewardsDecisionRecord
from racedata.providers.fia import FiaSource, parse_decision, pdf_text
from stintline.paddock import throttle
from stintline.paddock.models import (
    STEWARDS_CATEGORIES,
    FiaDocument,
    FiaEventListing,
    StewardsDecision,
)
from stintline.racing.models import Event, Lap, Session, SessionEntry, SessionKind

log = structlog.get_logger(__name__)

OFFSET_STEP = timedelta(minutes=15)
"""Circuit UTC offsets are whole quarter hours: the issue-to-publication delay (a minute or
two) rounds away."""

SESSION_LABELS: tuple[tuple[str, SessionKind], ...] = (
    ("sprint qualifying", SessionKind.SPRINT_QUALIFYING),
    ("sprint shootout", SessionKind.SPRINT_QUALIFYING),
    ("sprint", SessionKind.SPRINT),
    ("qualifying", SessionKind.QUALIFYING),
    ("practice 1", SessionKind.PRACTICE_1),
    ("first practice", SessionKind.PRACTICE_1),
    ("practice 2", SessionKind.PRACTICE_2),
    ("second practice", SessionKind.PRACTICE_2),
    ("practice 3", SessionKind.PRACTICE_3),
    ("third practice", SessionKind.PRACTICE_3),
    ("race", SessionKind.RACE),
)
"""Session names used in decisions, most specific first ("Sprint Qualifying" before
"Sprint" before "Race")."""


class ThrottleBusyError(ProviderError):
    """Another process holds the fia.com request slot."""


def _take_turn() -> None:
    if not throttle.wait_turn():
        raise ThrottleBusyError("fia", "request slot busy")


# ------------------------------------------------------------------------ events


def _tokens(name: str) -> frozenset[str]:
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    words = re.findall(r"[a-z0-9]+", plain)
    return frozenset(w for w in words if w not in {"grand", "prix", "gp", "formula", "f1"})


def match_event(season: int, fia_name: str) -> Event | None:
    """Our Grand Prix for an fia.com event name, by the first rule with a single answer:
    same words once "Grand Prix" is dropped; our words all in the FIA name ("Barcelona-
    Catalunya" → "Barcelona"); the FIA words all in ours ("Bahrain" → "Bahrain Grand Prix
    in Malaysia"); the circuit's city in the FIA name ("São Paulo" → "Brazilian", run at
    Interlagos). Test sessions never match."""
    wanted = _tokens(fia_name)
    if not wanted or "test" in wanted or "tests" in wanted:
        return None
    events = list(Event.objects.filter(season__year=season).select_related("circuit"))
    rules: tuple[Callable[[Event], bool], ...] = (
        lambda e: _tokens(e.name) == wanted,
        lambda e: bool(_tokens(e.name)) and _tokens(e.name) <= wanted,
        lambda e: wanted <= _tokens(e.name),
        lambda e: bool(_tokens(e.circuit.locality)) and _tokens(e.circuit.locality) <= wanted,
    )
    for rule in rules:
        found = [e for e in events if rule(e)]
        if len(found) == 1:
            return found[0]
    return None


@dataclass(frozen=True)
class ListingReport:
    event_id: int
    documents: int
    created: int


def store_listing(event: Event, fia_name: str, refs: list[FiaDocumentRef], now: datetime) -> int:
    """Upsert the listed documents of an event; returns how many are new."""
    created = 0
    with transaction.atomic():
        for ref in refs:
            _, new = FiaDocument.objects.update_or_create(
                url=ref.url,
                defaults={
                    "event": event,
                    "number": ref.number,
                    "title": ref.title,
                    "category": ref.category.value,
                    "published_at": ref.published_at,
                    "cars": list(ref.cars),
                    "listed_at": now,
                },
            )
            created += int(new)
        FiaEventListing.objects.update_or_create(
            event=event,
            defaults={"fia_name": fia_name, "listed_at": now, "documents": len(refs)},
        )
    return created


def list_event(
    source: FiaSource, season: int, event: Event, fia_name: str, now: datetime
) -> ListingReport:
    _take_turn()
    refs = source.event_documents(season, fia_name)
    created = store_listing(event, fia_name, refs, now)
    log.info("fia_event_stored", event_id=event.pk, documents=len(refs), created=created)
    return ListingReport(event.pk, len(refs), created)


def season_names(source: FiaSource, season: int) -> dict[int, str]:
    """``{event_id: fia name}`` for every Grand Prix of the season page we can match."""
    _take_turn()
    out: dict[int, str] = {}
    for name in source.season_event_names(season):
        event = match_event(season, name)
        if event is None:
            log.info("fia_event_unmatched", season=season, name=name)
            continue
        out[event.pk] = name
    return out


# ------------------------------------------------------------------------- texts


def pending_texts(limit: int) -> list[FiaDocument]:
    """Documents still without text: stewards' documents first, newest first."""
    stewards = list(
        FiaDocument.objects.filter(text_fetched_at__isnull=True, category__in=STEWARDS_CATEGORIES)
        .select_related("event")
        .order_by("-published_at")[:limit]
    )
    rest = limit - len(stewards)
    others = (
        list(
            FiaDocument.objects.filter(text_fetched_at__isnull=True)
            .exclude(category__in=STEWARDS_CATEGORIES)
            .select_related("event")
            .order_by("-published_at")[:rest]
        )
        if rest > 0
        else []
    )
    return stewards + others


def fetch_text(source: FiaSource, document: FiaDocument, now: datetime) -> bool:
    """Read a document's PDF, keep its text and, for stewards' documents, the decision.

    A document whose PDF cannot be read is marked as fetched with no text, so it is not
    retried every run. Returns whether text was stored.
    """
    _take_turn()
    try:
        text = pdf_text(source.document_pdf(document.url))
    except (InvalidPayloadError, NotFoundError) as exc:
        log.warning("fia_text_unreadable", document_id=document.pk, error=type(exc).__name__)
        text = ""
    document.text = text
    document.text_fetched_at = now
    document.save(update_fields=["text", "text_fetched_at"])
    if text and document.category in STEWARDS_CATEGORIES:
        record = parse_decision(text)
        if record is not None:
            store_decision(document, record)
    return bool(text)


# --------------------------------------------------------------------- decisions


def session_kind(label: str) -> SessionKind | None:
    lowered = label.lower()
    return next((kind for word, kind in SESSION_LABELS if word in lowered), None)


def utc_offset(record: StewardsDecisionRecord, published_at: datetime) -> timedelta | None:
    """Circuit offset from UTC: the local issue time printed in the decision minus the
    publication instant on fia.com, rounded to a quarter hour."""
    if record.issued_on is None or record.issued_time is None:
        return None
    hour, minute = (int(x) for x in record.issued_time.split(":"))
    local = datetime.combine(record.issued_on, time(hour, minute))
    raw = local - published_at.astimezone(UTC).replace(tzinfo=None)
    return round(raw / OFFSET_STEP) * OFFSET_STEP


def incident_lap(session: Session, car: int, incident_time: str, offset: timedelta) -> int | None:
    """The lap the car was on at the incident (local time on the session's day)."""
    if session.starts_at is None:
        return None
    hour, minute = (int(x) for x in incident_time.split(":"))
    local_day: date = (session.starts_at.astimezone(UTC).replace(tzinfo=None) + offset).date()
    at = (datetime.combine(local_day, time(hour, minute)) - offset).replace(tzinfo=UTC)
    starts = list(
        Lap.objects.filter(entry__session=session, entry__car_number=car, started_at__isnull=False)
        .order_by("lap_number")
        .values_list("lap_number", "started_at")
    )
    lap: int | None = None
    for number, started in starts:
        if started is not None and started <= at:
            lap = number
    return lap


def store_decision(document: FiaDocument, record: StewardsDecisionRecord) -> StewardsDecision:
    event = document.event
    kind = session_kind(record.session)
    session = (
        Session.objects.filter(event=event, kind=kind.value).first() if kind is not None else None
    )
    entry = (
        SessionEntry.objects.filter(session__event=event, car_number=record.car)
        .select_related("driver")
        .order_by("-session__starts_at")
        .first()
        if record.car is not None
        else None
    )
    offset = utc_offset(record, document.published_at)
    lap = (
        incident_lap(session, record.car, record.incident_time, offset)
        if session is not None
        and record.car is not None
        and record.incident_time
        and offset is not None
        and kind in (SessionKind.RACE, SessionKind.SPRINT)
        else None
    )
    penalty = record.penalty
    decision, _ = StewardsDecision.objects.update_or_create(
        document=document,
        defaults={
            "car_number": record.car,
            "driver": entry.driver if entry else None,
            "driver_name": record.driver_name,
            "session": session,
            "session_label": record.session[:64],
            "incident_time": record.incident_time or "",
            "lap": lap,
            "fact": record.fact,
            "infringement": record.infringement,
            "decision": record.decision,
            "reason": record.reason,
            "time_penalty_s": penalty.time_s,
            "drive_through": penalty.drive_through,
            "stop_go_s": penalty.stop_go_s,
            "grid_places": penalty.grid_places,
            "back_of_grid": penalty.back_of_grid,
            "pit_lane_start": penalty.pit_lane_start,
            "penalty_points": penalty.penalty_points,
            "reprimand": penalty.reprimand,
            "fine_eur": penalty.fine_eur,
            "disqualified": penalty.disqualified,
            "lap_time_deleted": penalty.lap_time_deleted,
            "no_further_action": penalty.no_further_action,
        },
    )
    return decision


def seed_documents(source: FiaSource, event: Event, fia_name: str, now: datetime) -> int:
    """Offline demo: list one event from fixtures and read the PDFs that were recorded
    (its stewards' documents and the final classification)."""
    list_event(source, event.season.year, event, fia_name, now)
    read = 0
    for document in FiaDocument.objects.filter(event=event, text_fetched_at__isnull=True):
        if document.category in STEWARDS_CATEGORIES or document.title.startswith(
            "Final Race Classification"
        ):
            read += int(fetch_text(source, document, now))
    return read

"""Read queries for the documents page and the stewards' decisions (ADR 0018)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db import connection
from django.db.models import Count, Q, QuerySet

from stintline.paddock.models import STEWARDS_CATEGORIES, FiaDocument, StewardsDecision
from stintline.racing.models import Event, SessionEntry

SNIPPET_CHARS = 220
"""Text shown around the first match of a search."""
_WORD = re.compile(r"\w{3,}", re.U)


def documents(
    *,
    season: int | None = None,
    event_id: int | None = None,
    category: str | None = None,
    car: int | None = None,
    search: str | None = None,
) -> QuerySet[FiaDocument]:
    """Documents, newest first, or by relevance with ``search`` (Postgres full text; a
    plain contains match on other databases)."""
    rows = FiaDocument.objects.select_related("event__circuit", "event__season").select_related(
        "decision__driver__portrait"
    )
    if season is not None:
        rows = rows.filter(event__season__year=season)
    if event_id is not None:
        rows = rows.filter(event_id=event_id)
    if category:
        rows = rows.filter(category=category)
    if car is not None:
        rows = rows.filter(_names_car(rows, car) | Q(decision__car_number=car))
    if not search:
        return rows.order_by("-published_at", "-number")
    if connection.vendor == "postgresql":
        vector = SearchVector("title", weight="A") + SearchVector("text", weight="B")
        query = SearchQuery(search, search_type="websearch")
        return (
            rows.annotate(rank=SearchRank(vector, query))
            .filter(rank__gt=0)
            .order_by("-rank", "-published_at")
        )
    words = _WORD.findall(search) or [search]
    match = Q()
    for word in words:
        match &= Q(title__icontains=word) | Q(text__icontains=word)
    return rows.filter(match).order_by("-published_at", "-number")


def _names_car(rows: QuerySet[FiaDocument], car: int) -> Q:
    """Documents whose title names ``car``: a JSON lookup on Postgres, else in Python
    (SQLite has no JSON ``contains``)."""
    if connection.vendor == "postgresql":
        return Q(cars__contains=[car])
    ids = [pk for pk, cars in rows.values_list("pk", "cars") if car in (cars or [])]
    return Q(pk__in=ids)


def snippet(text: str, search: str | None) -> str | None:
    """The passage around the first searched word, on one line."""
    if not search or not text:
        return None
    lowered = text.lower()
    positions = [p for w in _WORD.findall(search.lower()) if (p := lowered.find(w)) >= 0]
    if not positions:
        return None
    start = max(0, min(positions) - SNIPPET_CHARS // 3)
    passage = " ".join(text[start : start + SNIPPET_CHARS].split())
    return ("…" if start else "") + passage + "…"


@dataclass(frozen=True)
class EventDocuments:
    event: Event
    documents: int
    decisions: int
    penalties: int


def event_summaries(season: int) -> list[EventDocuments]:
    """Grands Prix of a season that have documents, latest first, with counts."""
    events = (
        Event.objects.filter(season__year=season, fia_documents__isnull=False)
        .select_related("circuit", "season")
        .annotate(
            n_documents=Count("fia_documents", distinct=True),
            n_decisions=Count(
                "fia_documents",
                filter=Q(fia_documents__category__in=STEWARDS_CATEGORIES),
                distinct=True,
            ),
        )
        .order_by("-race_date")
    )
    penalties: dict[int, int] = {}
    rows = StewardsDecision.objects.filter(document__event__season__year=season).select_related(
        "document"
    )
    for decision in rows:
        if decision.is_penalty:
            event_id = decision.document.event_id
            penalties[event_id] = penalties.get(event_id, 0) + 1
    return [
        EventDocuments(
            e, getattr(e, "n_documents", 0), getattr(e, "n_decisions", 0), penalties.get(e.pk, 0)
        )
        for e in events
    ]


def decisions(
    *,
    season: int | None = None,
    event_id: int | None = None,
    driver_ref: str | None = None,
) -> QuerySet[StewardsDecision]:
    rows = StewardsDecision.objects.select_related(
        "document__event__circuit", "document__event__season", "driver__portrait", "session"
    )
    if season is not None:
        rows = rows.filter(document__event__season__year=season)
    if event_id is not None:
        rows = rows.filter(document__event_id=event_id)
    if driver_ref:
        rows = rows.filter(driver__ref=driver_ref)
    return rows.order_by("-document__published_at")


def team_colours(rows: list[StewardsDecision]) -> dict[tuple[int, int], dict[str, Any]]:
    """``{(event_id, car): {"colour", "team"}}`` from the cars' entries that weekend."""
    events = {r.document.event_id for r in rows}
    out: dict[tuple[int, int], dict[str, Any]] = {}
    entries = (
        SessionEntry.objects.filter(session__event_id__in=events)
        .select_related("team", "session")
        .order_by("session__starts_at")
    )
    for entry in entries:
        key = (entry.session.event_id, entry.car_number)
        if entry.team_colour or key not in out:
            out[key] = {"colour": entry.team_colour or None, "team": entry.team}
    return out

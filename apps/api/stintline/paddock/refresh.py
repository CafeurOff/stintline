"""What to fetch from fia.com on each run, within a small budget (ADR 0018).

At 10 s per request a run is short: a few event pages (active weekends first, then events
never listed) and a batch of PDFs (stewards' documents first). The backlog of a season is
read over successive runs without holding up the race imports on the shared worker.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

import structlog
from django.core.cache import cache

from racedata.errors import ProviderError
from racedata.providers.fia import FiaSource
from stintline.paddock import services
from stintline.paddock.models import FiaEventListing
from stintline.racing.models import Event

log = structlog.get_logger(__name__)

ACTIVE_BEFORE = timedelta(days=4)
"""Documents start on the Thursday before the race."""
ACTIVE_AFTER = timedelta(days=10)
"""Late documents (right of review, appeals) arrive in the days after the race."""
RELIST_EVERY = timedelta(minutes=25)
"""An active weekend is listed again at most this often (the beat runs every 30 min)."""
SEASON_PAGE_EVERY = timedelta(hours=6)
"""The season page (event names) is read again at most this often."""
EVENT_PAGES_PER_RUN = 6
"""About a minute of requests."""
TEXTS_PER_RUN = 40
"""About seven minutes of requests: a season's backlog (~1,400 PDFs) takes a day, its
stewards' decisions a few hours."""


@dataclass
class RefreshReport:
    events: list[int] = field(default_factory=list)
    new_documents: int = 0
    texts: int = 0
    errors: int = 0


def _names(source: FiaSource, season: int) -> dict[int, str]:
    key = f"fia:season-names:{season}"
    cached: dict[int, str] | None = cache.get(key)
    if cached is not None:
        return cached
    names = services.season_names(source, season)
    cache.set(key, names, int(SEASON_PAGE_EVERY.total_seconds()))
    return names


def due_events(
    source: FiaSource, season: int, now: datetime, *, everything: bool = False
) -> list[tuple[Event, str]]:
    """Events to list now, newest first: active weekends not listed recently, then events
    never listed. ``everything`` lists every started event of the season."""
    events = list(
        Event.objects.filter(season__year=season, race_date__lte=(now + ACTIVE_BEFORE).date())
        .select_related("fia_listing")
        .order_by("-race_date")
    )
    listings = {e.pk: getattr(e, "fia_listing", None) for e in events}
    unlisted = any(listing is None for listing in listings.values())
    names = _names(source, season) if unlisted else {}
    out: list[tuple[Event, str]] = []
    for event in events:
        listing: FiaEventListing | None = listings[event.pk]
        name = listing.fia_name if listing else names.get(event.pk)
        if name is None:
            continue
        active = event.race_date - ACTIVE_BEFORE <= now.date() <= event.race_date + ACTIVE_AFTER
        stale = listing is not None and listing.listed_at < now - RELIST_EVERY
        if everything or listing is None or (active and stale):
            out.append((event, name))
    return out


def refresh(
    source: FiaSource,
    seasons: list[int],
    now: datetime,
    *,
    event_pages: int = EVENT_PAGES_PER_RUN,
    texts: int = TEXTS_PER_RUN,
    everything: bool = False,
) -> RefreshReport:
    report = RefreshReport()
    try:
        budget = event_pages
        for season in seasons:
            for event, name in due_events(source, season, now, everything=everything):
                if budget <= 0:
                    break
                listed = services.list_event(source, season, event, name, now)
                report.events.append(event.pk)
                report.new_documents += listed.created
                budget -= 1
        for document in services.pending_texts(texts):
            report.texts += int(services.fetch_text(source, document, now))
    except ProviderError as exc:
        report.errors += 1
        log.warning("fia_refresh_stopped", error=type(exc).__name__)
    log.info(
        "fia_refresh_done",
        events=len(report.events),
        new_documents=report.new_documents,
        texts=report.texts,
        errors=report.errors,
    )
    return report

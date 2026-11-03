"""Celery tasks. Thin wrappers around :mod:`stintline.ingestion.services`; every task is
idempotent, so retries and re-runs are safe."""

from __future__ import annotations

from datetime import datetime, timedelta

import structlog
from celery import shared_task
from django.db.models import Q
from django.utils import timezone

from racedata.errors import RateLimitedError, UpstreamUnavailableError
from stintline.ingestion import history, portraits, services
from stintline.ingestion.sources import open_sources
from stintline.racing.models import RACE_KINDS, Event, Session

log = structlog.get_logger(__name__)

RETRYABLE = (UpstreamUnavailableError, RateLimitedError)
RETRY_BACKOFF_S = 30
"""First retry delay for upstream outages; doubles on each attempt (with jitter)."""
RETRY_BACKOFF_MAX_S = 600
MAX_RETRIES = 5


def _queue_finished_race_sessions(events: list[Event]) -> list[int]:
    queued: list[int] = []
    for session in Session.objects.filter(event__in=events).select_related("event__season"):
        if services.is_ingestable(session):
            ingest_session.delay(session.pk)
            queued.append(session.pk)
    return queued


@shared_task(
    autoretry_for=RETRYABLE,
    retry_backoff=RETRY_BACKOFF_S,
    retry_backoff_max=RETRY_BACKOFF_MAX_S,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
def ingest_season(season: int) -> list[int]:
    """Upsert the season calendar, then queue every finished race and sprint."""
    with open_sources() as sources:
        events = services.ingest_calendar(season, sources)
    queued = _queue_finished_race_sessions(events)
    ingest_season_results.delay(season)
    log.info("ingest_season_queued", season=season, sessions=len(queued))
    return queued


@shared_task(
    autoretry_for=RETRYABLE,
    retry_backoff=RETRY_BACKOFF_S,
    retry_backoff_max=RETRY_BACKOFF_MAX_S,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
def ingest_event(season: int, round_: int) -> list[int]:
    """Refresh the calendar and queue the finished race sessions of one round."""
    with open_sources() as sources:
        events = [e for e in services.ingest_calendar(season, sources) if e.round == round_]
    return _queue_finished_race_sessions(events)


@shared_task(
    autoretry_for=RETRYABLE,
    retry_backoff=RETRY_BACKOFF_S,
    retry_backoff_max=RETRY_BACKOFF_MAX_S,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
def ingest_session(session_id: int) -> dict[str, int]:
    session = Session.objects.select_related("event__season").get(pk=session_id)
    with open_sources() as sources:
        report = services.ingest_session(session, sources)
    return report.counts


RESULTS_DELAY = timedelta(hours=1)
"""OpenF1 publishes timing about 30 minutes after a session; Jolpica within a few hours."""
REFRESH_WINDOW = timedelta(days=3)
"""Keep refreshing a finished session this long: penalties and corrections arrive late."""
REFRESH_EVERY = timedelta(hours=6)
"""Minimum gap between two imports of the same session inside the refresh window."""


@shared_task(
    autoretry_for=RETRYABLE,
    retry_backoff=RETRY_BACKOFF_S,
    retry_backoff_max=RETRY_BACKOFF_MAX_S,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
def ingest_season_results(season: int) -> dict[str, int]:
    """Race and sprint classifications, qualifying and championship standings."""
    with open_sources() as sources:
        return history.ingest_season_results(season, sources).counts


@shared_task(
    autoretry_for=RETRYABLE,
    retry_backoff=RETRY_BACKOFF_S,
    retry_backoff_max=RETRY_BACKOFF_MAX_S,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
def refresh_calendar() -> int:
    """Daily: keep the current season's calendar and OpenF1 session links up to date."""
    with open_sources() as sources:
        return len(services.ingest_calendar(timezone.now().year, sources))


@shared_task(acks_late=True)
def refresh_recent(now_iso: str | None = None) -> list[int]:
    """Every 30 minutes: import races and sprints that finished recently, then refresh the
    season's results and standings. Safe to run often: imports are idempotent and a
    session is not re-imported more than once per ``REFRESH_EVERY``."""
    now = datetime.fromisoformat(now_iso) if now_iso else timezone.now()
    due = Session.objects.filter(
        kind__in=RACE_KINDS,
        openf1_session_key__isnull=False,
        ends_at__lte=now - RESULTS_DELAY,
        ends_at__gte=now - REFRESH_WINDOW,
    ).filter(Q(ingested_at__isnull=True) | Q(ingested_at__lte=now - REFRESH_EVERY))
    queued = []
    seasons: set[int] = set()
    for session in due.select_related("event__season"):
        ingest_session.delay(session.pk)
        queued.append(session.pk)
        seasons.add(session.event.season.year)
    for season in sorted(seasons):
        ingest_season_results.delay(season)
    log.info("refresh_recent_queued", sessions=len(queued), seasons=sorted(seasons))
    return queued


@shared_task(
    autoretry_for=RETRYABLE,
    retry_backoff=RETRY_BACKOFF_S,
    retry_backoff_max=RETRY_BACKOFF_MAX_S,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
def refresh_portraits() -> dict[str, int]:
    """Weekly: driver portraits from Wikipedia (new drivers, replaced photos)."""
    with open_sources() as sources:
        return portraits.ingest_portraits(sources).counts

"""Celery tasks. Thin wrappers around :mod:`stintline.ingestion.services`; every task is
idempotent, so retries and re-runs are safe."""

from __future__ import annotations

import structlog
from celery import shared_task

from racedata.errors import RateLimitedError, UpstreamUnavailableError
from stintline.ingestion import services
from stintline.ingestion.sources import open_sources
from stintline.racing.models import Event, Session

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

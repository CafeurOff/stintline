"""Celery tasks. Thin wrappers around :mod:`stintline.ingestion.services`; every task is
idempotent, so retries and re-runs are safe."""

from __future__ import annotations

from datetime import datetime, timedelta

import structlog
from celery import shared_task
from django.db.models import Max, Q
from django.utils import timezone

from racedata.errors import ProviderError, RateLimitedError, UpstreamUnavailableError
from stintline.ingestion import history, portraits, services, telemetry
from stintline.ingestion.sources import open_sources
from stintline.racing.models import RACE_KINDS, Event, Season, Session

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
    ingest_telemetry.delay(session.pk)
    return report.counts


@shared_task(
    autoretry_for=RETRYABLE,
    retry_backoff=RETRY_BACKOFF_S,
    retry_backoff_max=RETRY_BACKOFF_MAX_S,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
def ingest_telemetry(session_id: int) -> int:
    """Fastest-lap telemetry of every car (about 40 bounded requests, ADR 0013)."""
    session = Session.objects.get(pk=session_id)
    with open_sources() as sources:
        return telemetry.ingest_telemetry(session, sources, timezone.now())


TELEMETRY_BACKFILL_PER_RUN = 4
"""Older races given telemetry per ``refresh_recent`` run: ~160 requests, about 6 minutes
of the OpenF1 budget every 30 minutes, so new races are never held up behind the backlog."""


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
    """On demand: refresh the current season's calendar and OpenF1 session links now."""
    now = timezone.now()
    with open_sources() as sources:
        events = services.ingest_calendar(now.year, sources)
    Season.objects.filter(year=now.year).update(calendar_synced_at=now)
    return len(events)


CALENDAR_MAX_AGE = timedelta(hours=12)
"""The current season's calendar is refreshed at least this often (dates move, sprint
weekends are announced, OpenF1 links appear once a session exists)."""


def _sync_calendar_if_stale(year: int, now: datetime) -> None:
    season = Season.objects.filter(year=year).first()
    synced = season.calendar_synced_at if season else None
    if synced is not None and synced > now - CALENDAR_MAX_AGE:
        return
    try:
        with open_sources() as sources:
            services.ingest_calendar(year, sources)
    except ProviderError as exc:
        log.warning("calendar_sync_failed", season=year, error=type(exc).__name__)
        return
    Season.objects.filter(year=year).update(calendar_synced_at=now)


@shared_task(acks_late=True)
def refresh_recent(now_iso: str | None = None) -> list[int]:
    """Every 30 minutes, and when a worker starts: keep the data up to date.

    1. Refresh the current season's calendar when it is older than ``CALENDAR_MAX_AGE``.
    2. Import every finished race and sprint never imported (catch-up after downtime),
       and re-import those that finished within ``REFRESH_WINDOW`` (penalties arrive late),
       at most once per ``REFRESH_EVERY``.
    3. Re-import results and standings of seasons with new sessions, and of the current
       season when a race finished after its last results import.

    Idempotent: safe to run as often as needed.
    """
    now = datetime.fromisoformat(now_iso) if now_iso else timezone.now()
    _sync_calendar_if_stale(now.year, now)

    finished = Session.objects.filter(
        kind__in=RACE_KINDS,
        openf1_session_key__isnull=False,
        ends_at__lte=now - RESULTS_DELAY,
    )
    missing = Q(ingested_at__isnull=True)
    stale = Q(ends_at__gte=now - REFRESH_WINDOW, ingested_at__lte=now - REFRESH_EVERY)
    due = finished.filter(missing | stale).select_related("event__season").order_by("ends_at")
    queued = []
    seasons: set[int] = set()
    for session in due:
        ingest_session.delay(session.pk)
        queued.append(session.pk)
        seasons.add(session.event.season.year)

    last_end = finished.filter(event__season__year=now.year).aggregate(last=Max("ends_at"))["last"]
    current = Season.objects.filter(year=now.year).first()
    if (
        last_end is not None
        and current is not None
        and (current.results_ingested_at is None or current.results_ingested_at < last_end)
    ):
        seasons.add(now.year)
    for season in sorted(seasons):
        ingest_season_results.delay(season)
    backlog = telemetry.missing_telemetry().exclude(pk__in=queued)[:TELEMETRY_BACKFILL_PER_RUN]
    for session in backlog:
        ingest_telemetry.delay(session.pk)
    log.info(
        "refresh_recent_queued",
        sessions=len(queued),
        seasons=sorted(seasons),
        telemetry=len(backlog),
    )
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

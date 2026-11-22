"""Celery tasks. Thin wrappers around the ingestion modules; every task is
idempotent, so retries and re-runs are safe."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import structlog
from celery import current_app, shared_task
from django.conf import settings
from django.core.cache import cache
from django.db.models import Max, Q
from django.utils import timezone
from kombu.exceptions import ChannelError

from racedata.errors import (
    LiveSessionLockedError,
    ProviderError,
    RateLimitedError,
    UpstreamUnavailableError,
)
from racedata.radio import TranscriptionUnavailableError
from stintline.analysis.tasks import build_race_analysis, build_stale_analysis
from stintline.ingestion import history, portraits, radio, schedule, telemetry, timing
from stintline.ingestion.sources import open_sources
from stintline.racing.models import INGESTED_KINDS, RACE_KINDS, Event, Season, Session

log = structlog.get_logger(__name__)

RETRYABLE = (UpstreamUnavailableError, RateLimitedError)
RETRY_BACKOFF_S = 30
"""First retry delay for upstream outages; doubles on each attempt (with jitter)."""
RETRY_BACKOFF_MAX_S = 600
MAX_RETRIES = 5


OPENF1_LOCK_KEY = "ingestion:openf1-live-lock"
OPENF1_LOCK_COOLDOWN = timedelta(minutes=10)
"""After OpenF1 answered with its live-session lock, other tasks skip their requests for
this long instead of each collecting the same 401 (ADR 0028)."""
LIVE_LOCK_GRACE = timedelta(minutes=45)
"""OpenF1 keeps its lock after the official end of a session (Las Vegas FP3 2026 ended at
01:30 UTC, OpenF1 answered again between 01:59 and 02:04): ``refresh_recent`` waits this
long before asking again."""


def openf1_locked() -> bool:
    return cache.get(OPENF1_LOCK_KEY) is not None


def _defer(task: str, exc: LiveSessionLockedError | None = None, **context: object) -> None:
    """A live session is not a failure: note it, keep quiet for a while, try again later.
    ``ingested_at`` is left as it was, so ``refresh_recent`` takes the work up again."""
    if exc is not None:
        cache.set(OPENF1_LOCK_KEY, 1, int(OPENF1_LOCK_COOLDOWN.total_seconds()))
    log.info("ingest_deferred_live_session", task=task, **context)


def live_session(now: datetime) -> Session | None:
    """A session running now by the calendar, or ended less than ``LIVE_LOCK_GRACE`` ago."""
    return (
        Session.objects.filter(starts_at__lte=now, ends_at__gte=now - LIVE_LOCK_GRACE)
        .order_by("starts_at")
        .first()
    )


def _queue_finished_sessions(events: list[Event]) -> list[int]:
    queued: list[int] = []
    for session in Session.objects.filter(event__in=events).select_related("event__season"):
        if timing.is_ingestable(session):
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
    """Upsert the season calendar, then queue every finished session (all kinds)."""
    try:
        with open_sources() as sources:
            events = schedule.ingest_calendar(season, sources)
    except LiveSessionLockedError as exc:
        _defer("ingest_season", exc, season=season)
        return []
    queued = _queue_finished_sessions(events)
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
    """Refresh the calendar and queue the finished sessions of one round."""
    try:
        with open_sources() as sources:
            events = [e for e in schedule.ingest_calendar(season, sources) if e.round == round_]
    except LiveSessionLockedError as exc:
        _defer("ingest_event", exc, season=season, round=round_)
        return []
    return _queue_finished_sessions(events)


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
    if openf1_locked():
        _defer("ingest_session", session_id=session_id)
        return {}
    try:
        with open_sources() as sources:
            report = timing.ingest_session(session, sources)
    except LiveSessionLockedError as exc:
        _defer("ingest_session", exc, session_id=session_id)
        return {}
    except timing.ClassificationPendingError:
        log.info("ingest_waiting_for_classification", session_id=session_id)
        return {}
    if session.kind in RACE_KINDS:
        build_race_analysis.delay(session.pk)
    ingest_telemetry.delay(session.pk)
    if radio.enabled() and radio.pending(session).exists():
        queue_transcription(session.pk)
    return report.counts


RADIO_CLIPS_PER_TASK = 25
"""Clips transcribed per task (about a minute with ``base.en`` on one core). A race holds
100 to 300 clips: the backlog is cut into short tasks that queue the next one, so imports
queued meanwhile never wait long behind it on the single worker process."""


@shared_task(
    autoretry_for=RETRYABLE,
    retry_backoff=RETRY_BACKOFF_S,
    retry_backoff_max=RETRY_BACKOFF_MAX_S,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
def transcribe_radio(session_id: int) -> int:
    """Transcribe the next team radio clips of a session (ADR 0029), then queue the rest.

    Runs on the ``radio`` queue (its own worker). Start a session with
    :func:`queue_transcription`, which keeps one chain per session."""
    if not radio.enabled():
        _end_chain(session_id)
        return 0
    session = Session.objects.get(pk=session_id)
    with open_sources() as sources:
        if sources.radio is None:
            log.info("radio_transcription_offline", session_id=session_id)
            _end_chain(session_id)
            return 0
        try:
            report = radio.transcribe_session(
                session,
                sources.radio,
                radio.build_transcriber(),
                limit=RADIO_CLIPS_PER_TASK,
                now=timezone.now(),
            )
        except TranscriptionUnavailableError:
            log.warning("radio_transcription_unavailable", session_id=session_id)
            _end_chain(session_id)
            return 0
    if report.remaining and not report.refused:
        cache.set(_chain_key(session_id), 1, int(RADIO_CHAIN_TTL.total_seconds()))
        transcribe_radio.delay(session_id)
    else:
        _end_chain(session_id)
    return report.transcribed


RADIO_CHAIN_KEY = "ingestion:radio-chain:{}"
RADIO_CHAIN_TTL = timedelta(hours=3)
"""A session's transcription chain holds its key while it runs, renewed at each batch. It
expires on its own if the chain dies (worker killed, retries exhausted)."""


def _chain_key(session_id: int) -> str:
    return RADIO_CHAIN_KEY.format(session_id)


def _end_chain(session_id: int) -> None:
    cache.delete(_chain_key(session_id))


def queue_transcription(session_id: int) -> bool:
    """Start transcribing a session unless a chain already runs for it. Without this, every
    ``refresh_recent`` started the same sessions again and the chains piled up."""
    if not cache.add(_chain_key(session_id), 1, int(RADIO_CHAIN_TTL.total_seconds())):
        return False
    transcribe_radio.delay(session_id)
    return True


def radio_queue_waiting() -> int:
    """Transcription batches waiting on the ``radio`` queue (0 when the broker cannot say)."""
    try:
        with current_app.connection_for_read() as conn:
            channel: Any = conn.default_channel
            ok = channel.queue_declare(settings.RADIO_QUEUE, passive=True)
    except ChannelError:
        return 0  # Redis drops an empty queue: "no queue 'radio'" means nothing waits
    except Exception:  # an unknown size must not stop refresh_recent
        log.warning("radio_queue_size_unknown")
        return 0
    return int(ok.message_count)


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
    if openf1_locked():
        _defer("ingest_telemetry", session_id=session_id)
        return 0
    try:
        with open_sources() as sources:
            stored = telemetry.ingest_telemetry(session, sources, timezone.now())
    except LiveSessionLockedError as exc:
        _defer("ingest_telemetry", exc, session_id=session_id)
        return 0
    if stored and session.kind in RACE_KINDS:
        build_race_analysis.delay(session.pk)
    return stored


@shared_task(
    autoretry_for=RETRYABLE,
    retry_backoff=RETRY_BACKOFF_S,
    retry_backoff_max=RETRY_BACKOFF_MAX_S,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
def add_telemetry_altitude(session_id: int) -> int:
    """Altitude for laps stored before it was kept (one bounded request per lap)."""
    session = Session.objects.get(pk=session_id)
    if openf1_locked():
        _defer("add_telemetry_altitude", session_id=session_id)
        return 0
    try:
        with open_sources() as sources:
            return telemetry.add_altitude(session, sources)
    except LiveSessionLockedError as exc:
        _defer("add_telemetry_altitude", exc, session_id=session_id)
        return 0


TELEMETRY_BACKFILL_PER_RUN = 4
"""Older races given telemetry per ``refresh_recent`` run: ~160 requests, about 6 minutes
of the OpenF1 budget every 30 minutes, so new races are never held up behind the backlog."""
ALTITUDE_BACKFILL_PER_RUN = 4
"""Races whose stored laps get their altitude per ``refresh_recent`` run (ADR 0021): one
``location`` request per lap, ~80 requests, under 3 minutes of the OpenF1 budget."""
SESSION_BACKFILL_PER_RUN = 4
"""Older practice and qualifying sessions imported per ``refresh_recent`` run (ADR 0028):
~10 timing requests each, then ~40 for telemetry, so ~200 requests every 30 minutes,
most recent first. The ~350 sessions since 2023 take about 45 hours."""
RADIO_BACKFILL_PER_RUN = 2
"""Sessions with clips still to transcribe started per ``refresh_recent`` run (ADR 0029),
most recent first, and only while the radio queue is empty. Each one then queues itself
until its clips are done, on the radio worker (imports never wait behind it)."""


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
    try:
        with open_sources() as sources:
            events = schedule.ingest_calendar(now.year, sources)
    except LiveSessionLockedError as exc:
        _defer("refresh_calendar", exc, season=now.year)
        return 0
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
            schedule.ingest_calendar(year, sources)
    except LiveSessionLockedError as exc:
        _defer("calendar_sync", exc, season=year)
        return
    except ProviderError as exc:
        log.warning("calendar_sync_failed", season=year, error=type(exc).__name__)
        return
    Season.objects.filter(year=year).update(calendar_synced_at=now)


@shared_task(acks_late=True)
def refresh_recent(now_iso: str | None = None) -> list[int]:
    """Every 30 minutes, and when a worker starts: keep the data up to date.

    0. While a session is live (calendar, or OpenF1's lock seen recently), queue no OpenF1
       work: every request would get a 401 until it ends (ADR 0028).
    1. Refresh the current season's calendar when it is older than ``CALENDAR_MAX_AGE``.
    2. Import every finished race and sprint never imported (catch-up after downtime), and
       every other session that ended within ``REFRESH_WINDOW``; re-import those at most
       once per ``REFRESH_EVERY`` within the window (penalties and deletions arrive late).
    3. Older practice and qualifying sessions never imported: ``SESSION_BACKFILL_PER_RUN``
       per run, most recent first (so the current season comes first).
    4. Re-import results and standings of seasons with new races, and of the current season
       when a race finished after its last results import.

    Idempotent: safe to run as often as needed.
    """
    now = datetime.fromisoformat(now_iso) if now_iso else timezone.now()
    running = live_session(now)
    if running is not None or openf1_locked():
        _defer("refresh_recent", session_id=running.pk if running else None)
        build_stale_analysis.delay()
        return []
    _sync_calendar_if_stale(now.year, now)

    finished = Session.objects.filter(
        kind__in=INGESTED_KINDS,
        openf1_session_key__isnull=False,
        ends_at__lte=now - RESULTS_DELAY,
    )
    missing = Q(ingested_at__isnull=True)
    stale = Q(ends_at__gte=now - REFRESH_WINDOW, ingested_at__lte=now - REFRESH_EVERY)
    recent = Q(ends_at__gte=now - REFRESH_WINDOW)
    races = Q(kind__in=RACE_KINDS)
    due = list(
        finished.filter((races & (missing | stale)) | (~races & recent & (missing | stale)))
        .select_related("event__season")
        .order_by("ends_at")
    )
    due += list(
        finished.filter(~races & missing & ~recent)
        .select_related("event__season")
        .order_by("-ends_at")[:SESSION_BACKFILL_PER_RUN]
    )
    queued = []
    seasons: set[int] = set()
    for session in due:
        ingest_session.delay(session.pk)
        queued.append(session.pk)
        if session.kind in RACE_KINDS:
            seasons.add(session.event.season.year)

    last_end = finished.filter(races, event__season__year=now.year).aggregate(last=Max("ends_at"))[
        "last"
    ]
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
    flat = telemetry.missing_altitude().exclude(pk__in=queued)[:ALTITUDE_BACKFILL_PER_RUN]
    for session in flat:
        add_telemetry_altitude.delay(session.pk)
    unheard: list[int] = []
    # The backlog only starts when the radio queue is drained: new races go first.
    if radio.enabled() and radio_queue_waiting() == 0:
        candidates = radio.sessions_with_pending_radio().exclude(pk__in=queued)
        for session_id in candidates.values_list("pk", flat=True)[: RADIO_BACKFILL_PER_RUN * 4]:
            if len(unheard) == RADIO_BACKFILL_PER_RUN:
                break
            if queue_transcription(session_id):
                unheard.append(session_id)
    build_stale_analysis.delay()
    log.info(
        "refresh_recent_queued",
        sessions=len(queued),
        seasons=sorted(seasons),
        telemetry=len(backlog),
        altitude=len(flat),
        radio=len(unheard),
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

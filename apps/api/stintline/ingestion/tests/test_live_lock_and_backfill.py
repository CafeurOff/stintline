"""OpenF1's live-session lock and the capped catch-up of practice and qualifying (ADR 0028)."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from unittest import mock

import httpx
import pytest
from django.core.cache import cache

from racedata.errors import LiveSessionLockedError
from racedata.fixtures import FIXTURES_ROOT
from racedata.http import HttpClient
from racedata.providers.openf1 import OpenF1Source
from racedata.sources import Sources
from racedata.testing import FakeClock
from stintline.analysis.tasks import build_race_analysis, build_stale_analysis
from stintline.ingestion import schedule, tasks, telemetry, timing
from stintline.racing.models import Season, Session, SessionKind
from stintline.racing.tests.factories import SessionFactory

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 11, 21, 2, 0, tzinfo=UTC)
LOCK_BODY = (FIXTURES_ROOT / "openf1" / "_errors" / "live_session_lock.json").read_bytes()


@pytest.fixture(autouse=True)
def _no_lock() -> Iterator[None]:
    cache.delete(tasks.OPENF1_LOCK_KEY)
    yield
    cache.delete(tasks.OPENF1_LOCK_KEY)


def locked_sources() -> Sources:
    """OpenF1 answering every request with the 401 recorded during Las Vegas FP3 2026."""
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(401, content=LOCK_BODY)

    client = HttpClient(
        "openf1", "https://api.test/v1", transport=httpx.MockTransport(handler), clock=FakeClock()
    )
    source = OpenF1Source(client)
    return Sources(schedule=mock.Mock(), results=mock.Mock(), timing=source, clients=(client,))


class _Opened:
    def __init__(self, sources: Sources) -> None:
        self.sources = sources

    def __enter__(self) -> Sources:
        return self.sources

    def __exit__(self, *exc: object) -> None:
        return None


def test_timing_import_raises_the_lock_and_writes_nothing() -> None:
    session = SessionFactory.create(kind=SessionKind.PRACTICE_1)

    with pytest.raises(LiveSessionLockedError):
        timing.ingest_session(session, locked_sources())

    session.refresh_from_db()
    assert session.ingested_at is None
    assert not session.entries.exists()


def test_ingest_session_task_defers_quietly_and_sets_the_cooldown() -> None:
    session = SessionFactory.create(kind=SessionKind.QUALIFYING)
    with (
        mock.patch.object(tasks, "open_sources", return_value=_Opened(locked_sources())),
        mock.patch.object(tasks.ingest_telemetry, "delay") as telemetry_delay,
        mock.patch.object(tasks.log, "info") as info,
        mock.patch.object(tasks.log, "error") as error,
    ):
        counts = tasks.ingest_session(session.pk)

    assert counts == {}
    telemetry_delay.assert_not_called()
    error.assert_not_called()
    info.assert_called_once_with(
        "ingest_deferred_live_session", task="ingest_session", session_id=session.pk
    )
    assert tasks.openf1_locked()
    session.refresh_from_db()
    assert session.ingested_at is None


def test_ingest_session_task_waits_quietly_for_the_classification() -> None:
    session = SessionFactory.create(kind=SessionKind.RACE)
    with (
        mock.patch.object(tasks, "open_sources", return_value=_Opened(mock.Mock())),
        mock.patch.object(
            timing, "ingest_session", side_effect=timing.ClassificationPendingError("x")
        ),
        mock.patch.object(tasks.ingest_telemetry, "delay") as telemetry_delay,
        mock.patch.object(build_race_analysis, "delay") as analysis_delay,
        mock.patch.object(tasks.log, "info") as info,
    ):
        counts = tasks.ingest_session(session.pk)

    assert counts == {}
    telemetry_delay.assert_not_called()
    analysis_delay.assert_not_called()
    info.assert_called_once_with("ingest_waiting_for_classification", session_id=session.pk)
    assert not tasks.openf1_locked()


def test_tasks_skip_their_requests_during_the_cooldown() -> None:
    session = SessionFactory.create(kind=SessionKind.PRACTICE_2)
    cache.set(tasks.OPENF1_LOCK_KEY, 1)

    with mock.patch.object(tasks, "open_sources") as opened:
        assert tasks.ingest_session(session.pk) == {}
        assert tasks.ingest_telemetry(session.pk) == 0
        assert tasks.add_telemetry_altitude(session.pk) == 0

    opened.assert_not_called()


def test_telemetry_and_altitude_tasks_defer_on_the_lock() -> None:
    session = SessionFactory.create(kind=SessionKind.PRACTICE_3)
    for task in (tasks.ingest_telemetry, tasks.add_telemetry_altitude):
        cache.delete(tasks.OPENF1_LOCK_KEY)
        with (
            mock.patch.object(tasks, "open_sources", return_value=_Opened(locked_sources())),
            mock.patch.object(telemetry, "ingest_telemetry", side_effect=lock()),
            mock.patch.object(telemetry, "add_altitude", side_effect=lock()),
        ):
            assert task(session.pk) == 0
        assert tasks.openf1_locked()


def lock() -> LiveSessionLockedError:
    return LiveSessionLockedError("openf1", "laps: withheld while a session is live")


def test_calendar_sync_defers_without_marking_the_calendar_fresh() -> None:
    Season.objects.create(year=2026)
    with (
        mock.patch.object(tasks, "open_sources", return_value=_Opened(locked_sources())),
        mock.patch.object(schedule, "ingest_calendar", side_effect=lock()),
        mock.patch.object(tasks.log, "warning") as warning,
    ):
        tasks._sync_calendar_if_stale(2026, NOW)
        assert tasks.refresh_calendar() == 0
        assert tasks.ingest_season(2026) == []
        assert tasks.ingest_event(2026, 21) == []

    warning.assert_not_called()
    assert Season.objects.get(year=2026).calendar_synced_at is None


def test_refresh_recent_queues_nothing_while_a_session_is_live() -> None:
    SessionFactory.create(
        kind=SessionKind.PRACTICE_3,
        starts_at=NOW - timedelta(hours=1, minutes=30),
        ends_at=NOW - timedelta(minutes=30),  # ended, but OpenF1 keeps its lock a while
    )
    SessionFactory.create(kind=SessionKind.RACE, ends_at=NOW - timedelta(days=30))
    with (
        mock.patch.object(tasks.ingest_session, "delay") as session_delay,
        mock.patch.object(tasks, "_sync_calendar_if_stale") as sync,
        mock.patch.object(build_stale_analysis, "delay"),
    ):
        queued = tasks.refresh_recent(NOW.isoformat())

    assert queued == []
    session_delay.assert_not_called()
    sync.assert_not_called()


def test_refresh_recent_resumes_after_the_grace_period() -> None:
    ended = SessionFactory.create(
        kind=SessionKind.PRACTICE_3,
        starts_at=NOW - timedelta(hours=2),
        ends_at=NOW - tasks.LIVE_LOCK_GRACE - tasks.RESULTS_DELAY,
    )
    with (
        mock.patch.object(tasks.ingest_session, "delay") as session_delay,
        mock.patch.object(tasks, "_sync_calendar_if_stale"),
        mock.patch.object(build_stale_analysis, "delay"),
    ):
        queued = tasks.refresh_recent(NOW.isoformat())

    assert queued == [ended.pk]
    session_delay.assert_called_once_with(ended.pk)


def test_refresh_recent_caps_the_backlog_of_older_sessions() -> None:
    def old(days: int, kind: SessionKind = SessionKind.PRACTICE_1) -> Session:
        end = NOW - timedelta(days=days)
        return SessionFactory.create(kind=kind, starts_at=end - timedelta(hours=1), ends_at=end)

    race = old(400, SessionKind.RACE)  # races are never capped
    backlog = [old(days) for days in (10, 20, 30, 40, 50, 60, 370)]
    recent = [
        old(1, SessionKind.QUALIFYING),
        old(2, SessionKind.SPRINT_QUALIFYING),
        old(2, SessionKind.PRACTICE_1),
    ]
    imported = old(5, SessionKind.PRACTICE_2)
    Session.objects.filter(pk=imported.pk).update(ingested_at=NOW - timedelta(days=4))
    with (
        mock.patch.object(tasks.ingest_session, "delay"),
        mock.patch.object(tasks.ingest_season_results, "delay") as results_delay,
        mock.patch.object(tasks, "_sync_calendar_if_stale"),
        mock.patch.object(build_stale_analysis, "delay"),
    ):
        queued = tasks.refresh_recent(NOW.isoformat())

    expected_backlog = [s.pk for s in backlog[: tasks.SESSION_BACKFILL_PER_RUN]]
    assert set(queued) == {race.pk, *(s.pk for s in recent), *expected_backlog}
    assert queued[-tasks.SESSION_BACKFILL_PER_RUN :] == expected_backlog  # most recent first
    results_delay.assert_called_once_with(race.event.season.year)  # races only


def test_practice_import_queues_telemetry_but_no_race_analysis() -> None:
    session = SessionFactory.create(kind=SessionKind.PRACTICE_1)
    with (
        mock.patch.object(tasks, "open_sources", return_value=_Opened(mock.Mock())),
        mock.patch.object(timing, "ingest_session") as ingest,
        mock.patch.object(tasks.ingest_telemetry, "delay") as telemetry_delay,
        mock.patch.object(build_race_analysis, "delay") as analysis_delay,
    ):
        ingest.return_value.counts = {"laps": 1}
        tasks.ingest_session(session.pk)

    telemetry_delay.assert_called_once_with(session.pk)
    analysis_delay.assert_not_called()

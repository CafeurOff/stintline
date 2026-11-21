from io import StringIO
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from django.core.management import call_command
from django.test import override_settings

from stintline.ingestion import tasks
from stintline.ingestion.sources import build_sources
from stintline.racing.models import Session, SessionKind

pytestmark = pytest.mark.django_db


def finished_linked_sessions() -> int:
    return Session.objects.filter(openf1_session_key__isnull=False).count()


def test_ingest_season_task_upserts_calendar_and_queues_every_finished_session() -> None:
    with patch.object(tasks.ingest_session, "delay") as delay:
        queued = tasks.ingest_season.delay(2025).get()

    assert Session.objects.filter(event__season__year=2025).count() > 100
    assert len(queued) == finished_linked_sessions() == delay.call_count
    # 18 conventional weekends (FP1-FP3, Q, R) and 6 sprint weekends (FP1, SQ, sprint, Q, R)
    assert finished_linked_sessions() == 18 * 5 + 6 * 5


def test_ingest_event_task_only_queues_the_requested_round() -> None:
    with patch.object(tasks.ingest_session, "delay") as delay:
        queued = tasks.ingest_event.delay(2025, 14).get()

    kinds = set(Session.objects.filter(pk__in=queued).values_list("kind", flat=True))
    assert kinds == {"FP1", "FP2", "FP3", "Q", "R"}
    assert delay.call_count == len(queued) == 5


def test_ingest_session_task_returns_counts(seeded: None) -> None:
    session = Session.objects.get(event__round=16, kind=SessionKind.RACE)

    with patch.object(tasks.ingest_telemetry, "delay") as telemetry_delay:
        counts = tasks.ingest_session.delay(session.pk).get()

    assert counts["laps"] == 976
    assert counts["track_status"] == 0
    telemetry_delay.assert_called_once_with(session.pk)


def test_ingest_command_queues_tasks_by_default() -> None:
    out = StringIO()
    fake = MagicMock(id="task-123")
    with (
        patch.object(tasks.ingest_season, "delay", return_value=fake) as season_delay,
        patch.object(tasks.ingest_event, "delay", return_value=fake) as event_delay,
    ):
        call_command("ingest", "--season", "2025", stdout=out)
        call_command("ingest", "--season", "2025", "--round", "4", stdout=out)

    season_delay.assert_called_once_with(2025)
    event_delay.assert_called_once_with(2025, 4)
    assert "task-123" in out.getvalue()


def test_ingest_command_sync_mode_runs_in_process() -> None:
    out = StringIO()

    call_command("ingest", "--season", "2025", "--round", "14", "--sync", stdout=out)

    assert "Hungarian Grand Prix" in out.getvalue()
    assert Session.objects.get(event__round=14, kind=SessionKind.RACE).ingested_at is not None


def test_build_sources_modes(tmp_path: Path) -> None:
    with override_settings(RACEDATA={"MODE": "http", "CACHE_DIR": str(tmp_path)}):
        sources = build_sources()
        assert sources.clients[0].base_url == "https://api.openf1.org/v1"
        sources.close()
    with pytest.raises(ValueError, match="Unknown RACEDATA mode"):
        build_sources("ftp")

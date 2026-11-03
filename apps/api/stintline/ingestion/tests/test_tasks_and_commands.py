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


def finished_linked_races() -> int:
    return Session.objects.filter(
        kind__in=[SessionKind.RACE, SessionKind.SPRINT], openf1_session_key__isnull=False
    ).count()


def test_ingest_season_task_upserts_calendar_and_queues_finished_races() -> None:
    with patch.object(tasks.ingest_session, "delay") as delay:
        queued = tasks.ingest_season.delay(2025).get()

    assert Session.objects.filter(event__season__year=2025).count() > 100
    assert len(queued) == finished_linked_races() == delay.call_count
    assert finished_linked_races() == 24 + 6  # 24 races and 6 sprints in 2025


def test_ingest_event_task_only_queues_the_requested_round() -> None:
    with patch.object(tasks.ingest_session, "delay") as delay:
        queued = tasks.ingest_event.delay(2025, 14).get()

    assert len(queued) == 1
    delay.assert_called_once_with(queued[0])


def test_ingest_session_task_returns_counts() -> None:
    call_command("seed_demo", stdout=StringIO())
    session = Session.objects.get(event__round=16, kind=SessionKind.RACE)

    counts = tasks.ingest_session.delay(session.pk).get()

    assert counts["laps"] == 976
    assert counts["track_status"] == 0


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

"""Team radio transcription (ADR 0029): service, task, command and API. No network, no
Whisper: clips come from a scripted transport, text from a fake transcriber."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import replace
from datetime import UTC, datetime
from io import StringIO
from unittest.mock import patch

import httpx
import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings
from rest_framework.test import APIClient

from racedata.errors import UpstreamUnavailableError
from racedata.http import HttpClient, RetryPolicy
from racedata.radio import RadioClipSource, Transcript, TranscriptionUnavailableError
from racedata.sources import Sources, build_fixture_sources
from racedata.testing import FakeClock
from stintline.ingestion import radio, tasks, timing
from stintline.racing.models import Session, SessionKind, TeamRadio

NOW = datetime(2025, 8, 4, tzinfo=UTC)
ENABLED = {"ENABLED": True, "MODEL": "tiny.en", "MODEL_DIR": "", "CPU_THREADS": 0}


class FakeTranscriber:
    """Says what the clip's bytes say; ``silent`` clips have no speech."""

    def __init__(self, silent: frozenset[bytes] = frozenset()) -> None:
        self.silent = silent
        self.heard: list[bytes] = []

    def transcribe(self, audio: bytes) -> Transcript:
        self.heard.append(audio)
        text = "" if audio in self.silent else f"Box box ({len(self.heard)})"
        return Transcript(text=text, language="en", confidence=0.9 if text else None, model="fake")


class Unavailable:
    def transcribe(self, audio: bytes) -> Transcript:
        raise TranscriptionUnavailableError("whisper", "not installed")


def clips(status: dict[str, int] | None = None) -> RadioClipSource:
    """Clips whose bytes are their file name; ``status`` overrides the answer per name."""

    def handler(request: httpx.Request) -> httpx.Response:
        name = request.url.path.rsplit("/", 1)[-1]
        return httpx.Response((status or {}).get(name, 200), content=name.encode())

    client = HttpClient(
        "livetiming",
        "https://livetiming.formula1.com",
        transport=httpx.MockTransport(handler),
        retry=RetryPolicy(max_attempts=1),
        clock=FakeClock(),
    )
    return RadioClipSource(client)


def race() -> Session:
    return Session.objects.get(event__season__year=2025, event__round=14, kind=SessionKind.RACE)


@contextmanager
def online(source: RadioClipSource) -> Iterator[Sources]:
    sources = replace(build_fixture_sources(), radio=source)
    try:
        yield sources
    finally:
        sources.close()


def first_clip_name(session: Session) -> str:
    url = TeamRadio.objects.filter(session=session).order_by("recorded_at").first()
    assert url is not None
    return url.url.rsplit("/", 1)[-1]


# ---------------------------------------------------------------- service


def test_transcribe_session_stores_the_text_of_the_oldest_clips(seeded: None) -> None:
    # Arrange
    session = race()

    # Act
    report = radio.transcribe_session(session, clips(), FakeTranscriber(), limit=5, now=NOW)

    # Assert
    assert (report.transcribed, report.empty, report.remaining) == (5, 0, 32)
    done = TeamRadio.objects.filter(session=session, transcribed_at=NOW).order_by("recorded_at")
    assert [r.transcript for r in done] == [f"Box box ({i})" for i in range(1, 6)]
    first = done[0]
    assert (first.transcript_language, first.transcript_confidence) == ("en", 0.9)
    assert first.transcript_model == "fake"


def test_transcribe_session_marks_silent_and_missing_clips_as_done(seeded: None) -> None:
    # Arrange
    session = race()
    rows = list(TeamRadio.objects.filter(session=session).order_by("recorded_at")[:2])
    gone, quiet = (r.url.rsplit("/", 1)[-1] for r in rows)
    transcriber = FakeTranscriber(silent=frozenset({quiet.encode()}))

    # Act
    report = radio.transcribe_session(session, clips({gone: 404}), transcriber, limit=2, now=NOW)

    # Assert
    assert (report.transcribed, report.empty) == (0, 2)
    missing, silent = TeamRadio.objects.filter(pk__in=[r.pk for r in rows]).order_by("recorded_at")
    assert (missing.transcript, missing.transcript_model) == ("", radio.UNREADABLE)
    assert (silent.transcript, silent.transcript_model) == ("", "fake")
    assert missing.transcribed_at == silent.transcribed_at == NOW


def test_transcribe_session_keeps_earlier_clips_when_the_cdn_fails(seeded: None) -> None:
    # Arrange
    session = race()
    second = TeamRadio.objects.filter(session=session).order_by("recorded_at")[1]

    # Act / Assert
    with pytest.raises(UpstreamUnavailableError):
        radio.transcribe_session(
            session,
            clips({second.url.rsplit("/", 1)[-1]: 503}),
            FakeTranscriber(),
            limit=5,
            now=NOW,
        )
    assert radio.pending(session).count() == 36


def test_reimport_keeps_the_transcripts(seeded: None) -> None:
    # Arrange
    session = race()
    radio.transcribe_session(session, clips(), FakeTranscriber(), limit=37, now=NOW)

    # Act
    with online(clips()) as sources:
        timing.ingest_session(session, sources)

    # Assert
    assert not radio.pending(session).exists()
    assert TeamRadio.objects.filter(session=session, transcript="").count() == 0


def test_sessions_with_pending_radio_lists_recent_sessions_first(seeded: None) -> None:
    # Act
    sessions = list(radio.sessions_with_pending_radio())

    # Assert
    assert race() in sessions
    starts = [s.scheduled_start for s in sessions if s.scheduled_start is not None]
    assert starts == sorted(starts, reverse=True)


# ---------------------------------------------------------------- task


def test_transcribe_radio_task_does_nothing_when_disabled(seeded: None) -> None:
    # Act
    done = tasks.transcribe_radio.delay(race().pk).get()

    # Assert
    assert done == 0
    assert radio.pending(race()).count() == 37


@override_settings(RADIO_TRANSCRIPTION=ENABLED)
def test_transcribe_radio_task_transcribes_a_batch_then_queues_the_rest(seeded: None) -> None:
    # Arrange
    session = race()

    # Act
    with (
        patch.object(tasks, "open_sources", lambda: online(clips())),
        patch.object(radio, "build_transcriber", FakeTranscriber),
        patch.object(tasks.transcribe_radio, "delay") as delay,
    ):
        done = tasks.transcribe_radio(session.pk)

    # Assert
    assert done == tasks.RADIO_CLIPS_PER_TASK
    delay.assert_called_once_with(session.pk)


@override_settings(RADIO_TRANSCRIPTION=ENABLED)
def test_transcribe_radio_task_skips_without_clips_or_engine(seeded: None) -> None:
    # Act
    offline = tasks.transcribe_radio.delay(race().pk).get()
    with (
        patch.object(tasks, "open_sources", lambda: online(clips())),
        patch.object(radio, "build_transcriber", Unavailable),
    ):
        no_engine = tasks.transcribe_radio.delay(race().pk).get()

    # Assert
    assert offline == no_engine == 0
    assert radio.pending(race()).count() == 37


@override_settings(RADIO_TRANSCRIPTION=ENABLED)
def test_ingest_session_queues_the_transcription(seeded: None) -> None:
    # Arrange
    session = race()

    # Act
    with (
        patch.object(tasks.ingest_telemetry, "delay"),
        patch.object(tasks.transcribe_radio, "delay") as delay,
    ):
        tasks.ingest_session.delay(session.pk).get()

    # Assert
    delay.assert_called_once_with(session.pk)


@override_settings(RADIO_TRANSCRIPTION=ENABLED)
def test_refresh_recent_starts_the_radio_backlog(seeded: None) -> None:
    # Act
    with (
        patch.object(tasks.ingest_session, "delay"),
        patch.object(tasks.ingest_season_results, "delay"),
        patch.object(tasks.ingest_telemetry, "delay"),
        patch.object(tasks.add_telemetry_altitude, "delay"),
        patch("stintline.ingestion.tasks.build_stale_analysis.delay"),
        patch.object(tasks, "_sync_calendar_if_stale"),
        patch.object(tasks.transcribe_radio, "delay") as delay,
    ):
        tasks.refresh_recent.delay("2030-01-01T00:00:00+00:00").get()

    # Assert
    assert delay.call_count == tasks.RADIO_BACKFILL_PER_RUN


# ---------------------------------------------------------------- command


def test_transcribe_radio_command_runs_here_with_sync(seeded: None) -> None:
    # Arrange
    out = StringIO()

    # Act
    with (
        patch(
            "stintline.ingestion.management.commands.transcribe_radio.open_sources",
            lambda: online(clips()),
        ),
        patch.object(radio, "build_transcriber", FakeTranscriber),
    ):
        call_command("transcribe_radio", "--session", str(race().pk), "--sync", stdout=out)

    # Assert
    assert "37 said, 0 silent" in out.getvalue()
    assert not radio.pending(race()).exists()


def test_transcribe_radio_command_redoes_and_queues_a_season(seeded: None) -> None:
    # Arrange
    session = race()
    radio.transcribe_session(session, clips(), FakeTranscriber(), limit=37, now=NOW)
    out, err = StringIO(), StringIO()

    # Act
    with patch.object(tasks.transcribe_radio, "delay") as delay:
        call_command("transcribe_radio", "--season", "2025", "--redo", stdout=out, stderr=err)

    # Assert
    assert radio.pending(session).count() == 37
    assert any(call.args == (session.pk,) for call in delay.call_args_list)
    assert "ENABLED is off" in err.getvalue()


def test_transcribe_radio_command_reports_missing_clips_or_engine(seeded: None) -> None:
    # Arrange
    pk = str(race().pk)

    # Act / Assert
    with pytest.raises(CommandError, match="fixtures mode"):
        call_command("transcribe_radio", "--session", pk, "--sync", stdout=StringIO())
    with (
        patch(
            "stintline.ingestion.management.commands.transcribe_radio.open_sources",
            lambda: online(clips()),
        ),
        patch.object(radio, "build_transcriber", Unavailable),
        pytest.raises(CommandError, match="transcription"),
    ):
        call_command("transcribe_radio", "--session", pk, "--sync", stdout=StringIO())


def test_build_transcriber_uses_the_settings() -> None:
    # Act
    with override_settings(RADIO_TRANSCRIPTION={**ENABLED, "MODEL_DIR": "/models"}):
        transcriber = radio.build_transcriber()

    # Assert
    assert transcriber.settings.model == "tiny.en"  # type: ignore[attr-defined]
    assert transcriber.settings.model_dir == "/models"  # type: ignore[attr-defined]


# ---------------------------------------------------------------- API


def test_radio_endpoint_places_each_message_on_its_lap_with_its_transcript(
    seeded: None,
) -> None:
    # Arrange
    session = race()
    radio.transcribe_session(session, clips(), FakeTranscriber(), limit=1, now=NOW)

    # Act
    body = APIClient().get(f"/api/v1/sessions/{session.pk}/radio").json()

    # Assert
    assert body[0]["transcript"] == "Box box (1)"
    assert body[0]["transcript_confidence"] == 0.9
    assert body[1]["transcript"] is None
    laps = [m["lap"] for m in body]
    assert all(lap is None or 1 <= lap <= 70 for lap in laps)
    assert any(lap is not None and lap > 1 for lap in laps)


def test_radio_endpoint_etag_changes_when_clips_are_transcribed(seeded: None) -> None:
    # Arrange
    session = race()
    url = f"/api/v1/sessions/{session.pk}/radio"
    before = APIClient().get(url)["ETag"]

    # Act
    radio.transcribe_session(session, clips(), FakeTranscriber(), limit=1, now=NOW)
    after = APIClient().get(url, HTTP_IF_NONE_MATCH=before)

    # Assert
    assert after.status_code == 200
    assert after["ETag"] != before

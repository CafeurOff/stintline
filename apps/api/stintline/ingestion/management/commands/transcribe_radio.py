"""``manage.py transcribe_radio [--session ID | --season YEAR] [--limit N] [--redo] [--sync]``

Transcribe team radio clips with Whisper on this machine (ADR 0029). Queues Celery tasks
unless ``--sync``. Without a session or season, takes every session with clips still to
transcribe, most recent first. ``--redo`` transcribes the chosen sessions again (after a
model change, with ``RADIO_WHISPER_MODEL``).
"""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db.models import F, QuerySet
from django.utils import timezone

from racedata.radio import TranscriptionUnavailableError
from stintline.ingestion import radio, tasks
from stintline.ingestion.sources import open_sources
from stintline.racing.models import Session, TeamRadio


class Command(BaseCommand):
    help = "Transcribe team radio clips (Whisper, local)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--session", type=int, help="one stored session id")
        parser.add_argument("--season", type=int, help="every session of a season")
        parser.add_argument("--limit", type=int, help="at most this many sessions")
        parser.add_argument("--redo", action="store_true", help="transcribe done clips again")
        parser.add_argument("--sync", action="store_true", help="run here instead of queuing")

    def handle(
        self,
        *args: Any,
        session: int | None = None,
        season: int | None = None,
        limit: int | None = None,
        redo: bool = False,
        sync: bool = False,
        **options: Any,
    ) -> None:
        sessions = _chosen(session, season, redo=redo)
        ids = list(sessions.values_list("pk", flat=True)[:limit])
        if redo:
            TeamRadio.objects.filter(session_id__in=ids).update(transcribed_at=None)
        if not sync:
            if not radio.enabled():
                self.stderr.write("RADIO_TRANSCRIPTION_ENABLED is off: queued tasks do nothing")
            started = sum(tasks.queue_transcription(pk) for pk in ids)
            running = f" ({len(ids) - started} already running)" if started < len(ids) else ""
            self.stdout.write(self.style.SUCCESS(f"{started} sessions queued{running}"))
            return
        total = 0
        transcriber = radio.build_transcriber()
        with open_sources() as sources:
            if sources.radio is None:
                raise CommandError("Radio clips cannot be fetched in fixtures mode")
            for item in Session.objects.filter(pk__in=ids).order_by(
                F("scheduled_start").desc(nulls_last=True), "-pk"
            ):
                count = radio.pending(item).count()
                try:
                    report = radio.transcribe_session(
                        item, sources.radio, transcriber, limit=count, now=timezone.now()
                    )
                except TranscriptionUnavailableError as exc:
                    raise CommandError("Install stintline-racedata[transcription]") from exc
                total += report.transcribed
                self.stdout.write(f"{item}: {report.transcribed} said, {report.empty} silent")
        self.stdout.write(self.style.SUCCESS(f"{total} clips transcribed"))


def _chosen(session: int | None, season: int | None, *, redo: bool) -> QuerySet[Session]:
    if session is not None:
        return Session.objects.filter(pk=session)
    if season is not None:
        with_radio = Session.objects.filter(
            event__season__year=season, team_radio__isnull=False
        ).distinct()
        return (
            with_radio
            if redo
            else radio.sessions_with_pending_radio().filter(event__season__year=season)
        )
    return radio.sessions_with_pending_radio()

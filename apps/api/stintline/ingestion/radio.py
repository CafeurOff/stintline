"""Transcribe team radio clips (ADR 0029).

Each clip not yet transcribed is fetched once, handed to the speech-to-text engine running
in this process, and dropped: only the text is stored. A clip gone upstream, refused or
undecodable is marked transcribed with an empty text, so it is never fetched again. A clip
the CDN refuses (HTTP 403, often this server's address rather than the clip) stays pending:
the batch stops and the backlog waits for the next run.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import structlog
from django.conf import settings
from django.db.models import F, QuerySet

from racedata.errors import (
    ForbiddenError,
    ProviderError,
    RateLimitedError,
    UpstreamUnavailableError,
)
from racedata.radio import (
    RadioClipSource,
    Transcriber,
    TranscriptionUnavailableError,
    WhisperSettings,
    WhisperTranscriber,
)
from stintline.racing.models import RADIO_TRANSCRIPT_FIELDS, Session, TeamRadio

log = structlog.get_logger(__name__)

UNREADABLE = "unreadable"
"""``transcript_model`` of a clip that could not be fetched or decoded."""


@dataclass(frozen=True, slots=True)
class RadioReport:
    transcribed: int
    empty: int
    """Clips with no intelligible speech, gone upstream or undecodable."""
    remaining: int
    refused: bool = False
    """The CDN refused a clip: the batch stopped early, the rest waits for a later run."""


def enabled() -> bool:
    return bool(settings.RADIO_TRANSCRIPTION["ENABLED"])


def build_transcriber() -> Transcriber:
    """Whisper as configured in ``RADIO_TRANSCRIPTION``. The model loads on the first clip
    and is released with the object at the end of the task."""
    cfg = settings.RADIO_TRANSCRIPTION
    return WhisperTranscriber(
        WhisperSettings(
            model=cfg["MODEL"], model_dir=cfg["MODEL_DIR"] or None, cpu_threads=cfg["CPU_THREADS"]
        )
    )


def pending(session: Session) -> QuerySet[TeamRadio]:
    return TeamRadio.objects.filter(session=session, transcribed_at__isnull=True)


def sessions_with_pending_radio() -> QuerySet[Session]:
    """Sessions holding clips not transcribed yet, most recent first."""
    return (
        Session.objects.filter(team_radio__transcribed_at__isnull=True)
        .distinct()
        .order_by(F("scheduled_start").desc(nulls_last=True), "-pk")
    )


def transcribe_session(
    session: Session,
    clips: RadioClipSource,
    transcriber: Transcriber,
    *,
    limit: int,
    now: datetime,
) -> RadioReport:
    """Transcribe at most ``limit`` clips of ``session``, oldest first.

    Raises:
        TranscriptionUnavailableError: no speech-to-text engine is installed.
        UpstreamUnavailableError, RateLimitedError: the clips cannot be fetched right now
            (what was done before is kept).
    """
    transcribed = empty = 0
    refused = False
    for radio in pending(session).order_by("recorded_at")[:limit]:
        try:
            transcript = transcriber.transcribe(clips.clip(radio.url))
        except (TranscriptionUnavailableError, UpstreamUnavailableError, RateLimitedError):
            raise
        except ForbiddenError:
            # This server is refused, not the clip: keep it pending and stop the batch.
            log.warning("radio_clips_refused", session_id=session.pk, radio_id=radio.pk)
            refused = True
            break
        except ProviderError as exc:
            # Gone upstream, refused or undecodable: never fetched again.
            log.info("radio_clip_unreadable", radio_id=radio.pk, error=type(exc).__name__)
            radio.transcript, radio.transcript_language = "", ""
            radio.transcript_confidence, radio.transcript_model = None, UNREADABLE
        else:
            radio.transcript = transcript.text
            radio.transcript_language = transcript.language
            radio.transcript_confidence = transcript.confidence
            radio.transcript_model = transcript.model
        radio.transcribed_at = now
        radio.save(update_fields=list(RADIO_TRANSCRIPT_FIELDS))
        if radio.transcript:
            transcribed += 1
        else:
            empty += 1
    report = RadioReport(
        transcribed=transcribed,
        empty=empty,
        remaining=pending(session).count(),
        refused=refused,
    )
    log.info(
        "radio_transcribed",
        session_id=session.pk,
        transcribed=report.transcribed,
        empty=report.empty,
        remaining=report.remaining,
        refused=report.refused,
    )
    return report

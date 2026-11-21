"""Transcribe the team radio of the live session as it arrives (ADR 0029).

The live process runs on a home machine (ADR 0002): new clips are fetched and transcribed
there, a few seconds after they are published, well inside the TV delay the page applies.
Only the text is kept, in memory, and published with the next snapshot.
"""

from __future__ import annotations

import structlog

from racedata.errors import ProviderError, RateLimitedError, UpstreamUnavailableError
from racedata.radio import RadioClipSource, Transcriber, TranscriptionUnavailableError
from stintline.live.publisher import Publisher

log = structlog.get_logger(__name__)

LIVE_RADIO_INTERVAL_S = 2.0
"""Pause between two looks for new clips. A clip takes one to two seconds to transcribe
with ``base.en``: the text follows the clip by a few seconds."""


class RadioListener:
    def __init__(
        self, publisher: Publisher, clips: RadioClipSource, transcriber: Transcriber
    ) -> None:
        self._publisher = publisher
        self._clips = clips
        self._transcriber = transcriber

    def step(self) -> int:
        """Transcribe the clips of the latest snapshot not transcribed yet, newest first.
        Returns how many were handled. A clip that cannot be fetched right now is tried
        again on the next step; one gone, refused or undecodable gets an empty text.

        Raises:
            TranscriptionUnavailableError: no speech-to-text engine is installed.
        """
        done = 0
        for url in [u for u in self._publisher.radio_urls if u not in self._publisher.transcripts]:
            try:
                text = self._transcriber.transcribe(self._clips.clip(url)).text
            except TranscriptionUnavailableError:
                raise
            except (UpstreamUnavailableError, RateLimitedError) as exc:
                log.info("live_radio_deferred", url=url, error=type(exc).__name__)
                continue
            except ProviderError as exc:
                # Gone, undecodable or refused: never asked again.
                log.info("live_radio_unreadable", url=url, error=type(exc).__name__)
                text = ""
            self._publisher.add_transcript(url, text)
            done += 1
        return done

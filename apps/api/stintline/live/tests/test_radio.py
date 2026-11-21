"""Live team radio transcription (ADR 0029). No network, no Whisper."""

from __future__ import annotations

import asyncio
import json
from io import StringIO

import httpx

from racedata.fixtures import FIXTURES_ROOT
from racedata.http import HttpClient, RetryPolicy
from racedata.live.protocol import Snapshot
from racedata.radio import RadioClipSource, Transcript, TranscriptionUnavailableError
from racedata.testing import FakeClock
from stintline.live.circuit import CircuitContext
from stintline.live.management.commands.live import Command
from stintline.live.publisher import Publisher
from stintline.live.radio import RadioListener

SNAPSHOT = json.loads(
    (FIXTURES_ROOT / "livetiming" / "snapshot-mexico-2026.json").read_text(encoding="utf-8")
)
CONTEXT = CircuitContext(reference_session_id=None, pit_loss_s=None, pit_loss_sigma_s=None)


class Echo:
    def transcribe(self, audio: bytes) -> Transcript:
        return Transcript(text=f"heard {len(audio)}", language="en", confidence=0.8, model="fake")


class Unavailable:
    def transcribe(self, audio: bytes) -> Transcript:
        raise TranscriptionUnavailableError("whisper", "not installed")


def clips(statuses: list[int]) -> RadioClipSource:
    """Answers the clip requests with ``statuses`` in order, then 200."""
    queue = list(statuses)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(queue.pop(0) if queue else 200, content=b"mp3")

    client = HttpClient(
        "livetiming",
        "https://livetiming.formula1.com",
        transport=httpx.MockTransport(handler),
        retry=RetryPolicy(max_attempts=1),
        clock=FakeClock(),
    )
    return RadioClipSource(client)


def live_publisher() -> Publisher:
    pub = Publisher(clock=lambda: 1.0, context=lambda key: CONTEXT)
    pub.apply(Snapshot(SNAPSHOT))
    pub.snapshot()
    return pub


def test_snapshot_radio_has_no_transcript_until_one_is_added() -> None:
    # Arrange
    pub = live_publisher()
    url = pub.radio_urls[0]

    # Act
    before = pub.snapshot()["team_radio"][0]["transcript"]
    pub.add_transcript(url, "Box box")
    after = pub.snapshot()["team_radio"][0]["transcript"]

    # Assert
    assert (before, after) == (None, "Box box")


def test_listener_transcribes_each_new_clip_once() -> None:
    # Arrange
    pub = live_publisher()
    listener = RadioListener(pub, clips([]), Echo())

    # Act
    first = listener.step()
    second = listener.step()

    # Assert
    assert first == len(pub.radio_urls) > 0
    assert second == 0
    assert set(pub.transcripts.values()) == {"heard 3"}


def test_listener_retries_later_when_the_cdn_fails_and_gives_up_on_missing_clips() -> None:
    # Arrange
    pub = live_publisher()
    count = len(pub.radio_urls)
    listener = RadioListener(pub, clips([503, 404]), Echo())

    # Act
    done = listener.step()

    # Assert
    assert done == count - 1
    assert pub.radio_urls[0] not in pub.transcripts
    assert pub.transcripts[pub.radio_urls[1]] == ""


def test_listen_stops_when_no_engine_is_installed() -> None:
    # Arrange
    pub = live_publisher()
    err = StringIO()
    command = Command(stdout=StringIO(), stderr=err)

    # Act
    asyncio.run(command._listen(RadioListener(pub, clips([]), Unavailable())))

    # Assert
    assert "faster-whisper is not installed" in err.getvalue()

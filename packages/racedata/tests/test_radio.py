"""Team radio clips and their transcription (ADR 0029). No network, no Whisper model."""

from __future__ import annotations

import importlib
import sys
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, BinaryIO

import httpx
import pytest

from racedata.errors import ForbiddenError, NotFoundError, ProviderError
from racedata.http import HttpClient
from racedata.radio import (
    RadioClipSource,
    TranscriptionFailedError,
    TranscriptionUnavailableError,
    WhisperSettings,
    WhisperTranscriber,
    load_whisper,
)
from racedata.sources import build_fixture_sources, build_http_sources
from racedata.testing import sequence_transport

CLIP = (
    "https://livetiming.formula1.com/static/2025/2025-04-13_Bahrain_Grand_Prix/"
    "2025-04-13_Race/TeamRadio/MAXVER01_1_20250413_171213.mp3"
)


def _source(*responses: httpx.Response) -> tuple[RadioClipSource, list[httpx.Request]]:
    transport, calls = sequence_transport(*responses)
    client = HttpClient("livetiming", "https://livetiming.formula1.com", transport=transport)
    return RadioClipSource(client), calls


def test_clip_downloads_the_recording_from_the_live_timing_cdn() -> None:
    # Arrange
    source, calls = _source(httpx.Response(200, content=b"ID3audio"))

    # Act
    audio = source.clip(CLIP)

    # Assert
    assert audio == b"ID3audio"
    assert str(calls[0].url) == CLIP


@pytest.mark.parametrize(
    "url",
    [
        "http://livetiming.formula1.com/static/a.mp3",
        "https://example.com/static/a.mp3",
        "https://livetiming.formula1.com/signalr/a.mp3",
        "https://livetiming.formula1.com/static/a.json",
    ],
)
def test_clip_refuses_anything_but_a_radio_clip(url: str) -> None:
    # Arrange
    source, calls = _source()

    # Act / Assert
    with pytest.raises(ProviderError, match="not a team radio clip"):
        source.clip(url)
    assert calls == []


def test_clip_reports_a_missing_recording() -> None:
    # Arrange
    source, _ = _source(httpx.Response(404))

    # Act / Assert
    with pytest.raises(NotFoundError):
        source.clip(CLIP)


def test_clip_reports_a_refused_download_apart_from_a_missing_one() -> None:
    # Arrange
    source, _ = _source(httpx.Response(403))

    # Act / Assert
    with pytest.raises(ForbiddenError):
        source.clip(CLIP)


def test_http_sources_fetch_the_clips_through_the_relay_with_its_token() -> None:
    # Arrange
    sources = build_http_sources(radio_relay_url="https://relay.test/", radio_relay_token="s3cret")
    client = sources.clients[-1]
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, content=b"ID3audio")

    client._client._transport = httpx.MockTransport(handler)

    # Act
    assert sources.radio is not None
    audio = sources.radio.clip(CLIP)
    sources.close()

    # Assert
    assert audio == b"ID3audio"
    assert str(seen[0].url) == "https://relay.test" + CLIP.removeprefix(
        "https://livetiming.formula1.com"
    )
    assert seen[0].headers["Authorization"] == "Bearer s3cret"


def test_http_sources_send_no_token_to_the_cdn() -> None:
    # Act
    sources = build_http_sources(radio_relay_token="s3cret")
    client = sources.clients[-1]
    sources.close()

    # Assert
    assert client.base_url == "https://livetiming.formula1.com"
    assert "Authorization" not in client._client.headers


def test_http_sources_include_the_radio_clips_and_fixtures_do_not() -> None:
    # Act
    live = build_http_sources()
    offline = build_fixture_sources()
    live.close()
    offline.close()

    # Assert
    assert live.radio is not None
    assert offline.radio is None


@dataclass
class _Segment:
    text: str
    avg_logprob: float = -0.2
    no_speech_prob: float = 0.05


@dataclass
class _Info:
    language: str = "en"


class _Model:
    def __init__(self, segments: list[_Segment] | Exception) -> None:
        self.segments = segments
        self.calls: list[dict[str, Any]] = []

    def transcribe(
        self,
        audio: BinaryIO,
        *,
        language: str,
        beam_size: int,
        initial_prompt: str,
        vad_filter: bool,
        condition_on_previous_text: bool,
    ) -> tuple[Iterable[_Segment], _Info]:
        self.calls.append({"audio": audio.read(), "language": language, "vad": vad_filter})
        if isinstance(self.segments, Exception):
            raise self.segments
        return iter(self.segments), _Info()


def _transcriber(model: _Model, loads: list[WhisperSettings] | None = None) -> WhisperTranscriber:
    def loader(settings: WhisperSettings) -> _Model:
        if loads is not None:
            loads.append(settings)
        return model

    return WhisperTranscriber(WhisperSettings(model="tiny.en"), loader=loader)


def test_transcribe_joins_the_segments_and_rates_them() -> None:
    # Arrange
    model = _Model([_Segment(" Box box. "), _Segment("Box this lap.", avg_logprob=-0.4)])

    # Act
    transcript = _transcriber(model).transcribe(b"mp3")

    # Assert
    assert transcript.text == "Box box. Box this lap."
    assert transcript.language == "en"
    assert transcript.model == "tiny.en"
    assert transcript.confidence is not None
    assert 0.6 < transcript.confidence < 0.85
    assert model.calls == [{"audio": b"mp3", "language": "en", "vad": True}]


def test_transcribe_drops_silence_and_invented_phrases() -> None:
    # Arrange
    model = _Model(
        [
            _Segment(" Thank you.", avg_logprob=-0.3),
            _Segment(" BEEP."),
            _Segment(" mumble", avg_logprob=-1.5, no_speech_prob=0.8),
            _Segment("   "),
        ]
    )

    # Act
    transcript = _transcriber(model).transcribe(b"mp3")

    # Assert
    assert transcript.text == ""
    assert transcript.confidence is None


def test_transcribe_loads_the_model_once() -> None:
    # Arrange
    loads: list[WhisperSettings] = []
    transcriber = _transcriber(_Model([_Segment("Copy.")]), loads)

    # Act
    transcriber.transcribe(b"a")
    transcriber.transcribe(b"b")

    # Assert
    assert len(loads) == 1


def test_transcribe_reports_undecodable_audio() -> None:
    # Arrange
    model = _Model(ValueError("invalid data found when processing input"))

    # Act / Assert
    with pytest.raises(TranscriptionFailedError):
        _transcriber(model).transcribe(b"not audio")


def test_load_whisper_reports_a_missing_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    # Arrange: a ``None`` entry makes the import fail as if the package were absent.
    monkeypatch.setitem(sys.modules, "faster_whisper", None)

    # Act / Assert
    with pytest.raises(TranscriptionUnavailableError):
        load_whisper(WhisperSettings())


def test_load_whisper_builds_a_cpu_int8_model(monkeypatch: pytest.MonkeyPatch) -> None:
    # Arrange
    built: dict[str, Any] = {}

    class FakeWhisperModel:
        def __init__(self, name: str, **kwargs: Any) -> None:
            built.update(kwargs, name=name)

    monkeypatch.setattr(importlib.import_module("faster_whisper"), "WhisperModel", FakeWhisperModel)

    # Act
    load_whisper(WhisperSettings(model_dir="/models"))

    # Assert
    assert built == {
        "name": "base.en",
        "device": "cpu",
        "compute_type": "int8",
        "download_root": "/models",
        "cpu_threads": 0,
    }

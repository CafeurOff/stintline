"""Team radio clips and their transcription (ADR 0029).

A clip is fetched once from the official live timing CDN, handed to a speech-to-text
model running on this machine, and dropped: only the text is kept by callers. The audio
is never stored or re-hosted; pages keep playing it from its source.

Transcription uses Whisper through ``faster-whisper`` (CTranslate2, CPU, int8). The
package is an optional extra (``stintline-racedata[transcription]``) imported on first
use, so code that never transcribes does not pay for it.
"""

from __future__ import annotations

import importlib
import io
import math
import re
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import BinaryIO, Protocol
from urllib.parse import urlsplit

from racedata.errors import ProviderError
from racedata.http import HttpClient
from racedata.models import _DTO

RADIO_HOST = "livetiming.formula1.com"
RADIO_PATH_PREFIX = "/static/"
RADIO_SUFFIXES = frozenset({".mp3"})
"""Where team radio clips live (OpenF1 ``recording_url`` and the live ``TeamRadio`` topic).
Anything else is refused: the fetcher is not an open proxy."""


class TranscriptionUnavailableError(ProviderError):
    """No speech-to-text engine is installed (the ``transcription`` extra is missing)."""


class TranscriptionFailedError(ProviderError):
    """The clip could not be decoded or transcribed (corrupt or empty audio)."""


class RadioClipSource:
    """Downloads team radio clips, for transcription only."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def clip(self, url: str) -> bytes:
        """The MP3 bytes of one clip.

        Raises:
            ProviderError: the URL is not a team radio clip on the live timing CDN.
            NotFoundError: the clip is gone upstream.
            UpstreamUnavailableError: timeouts or 5xx after every retry.
        """
        parts = urlsplit(url)
        if (
            parts.scheme != "https"
            or parts.netloc != RADIO_HOST
            or not parts.path.startswith(RADIO_PATH_PREFIX)
            or PurePosixPath(parts.path).suffix.lower() not in RADIO_SUFFIXES
        ):
            raise ProviderError("livetiming", "not a team radio clip URL")
        return self._client.get_bytes(parts.path, accept="audio/mpeg")


class Transcript(_DTO):
    """What was said in one clip. ``text`` is empty when nothing intelligible was said."""

    text: str
    language: str
    confidence: float | None
    """Mean token probability of the kept text (0 to 1), ``None`` when the text is empty."""
    model: str


class Transcriber(Protocol):
    def transcribe(self, audio: bytes) -> Transcript: ...


# ---------------------------------------------------------------- Whisper


WHISPER_MODEL = "base.en"
"""English-only Whisper checkpoint. Team radio is almost always English, and English-only
checkpoints beat multilingual ones of the same size on English. ``base`` (74 M parameters,
about 150 MB in int8) fits the production worker's memory cap (900 MB, shared with
Django) and runs faster than real time on one CPU core; ``small.en`` is more accurate on
radio noise for about three times the CPU and memory. Override with
``RADIO_WHISPER_MODEL``."""
WHISPER_COMPUTE_TYPE = "int8"
"""8-bit weights: about four times less memory than float32 for a negligible word error
rate change on CPU (CTranslate2 benchmarks)."""
WHISPER_LANGUAGE = "en"
"""Forced language. Language detection on a few seconds of engine noise is unreliable and
sends some clips through the wrong decoder."""
WHISPER_BEAM_SIZE = 5
"""Whisper's reference decoding setting; greedy decoding (1) is faster but drops words."""
WHISPER_PROMPT = (
    "Formula 1 team radio. Box box. Push now. Copy. Tyres, softs, mediums, hards, "
    "inters. Safety car, virtual safety car, DRS, undercut, gap, delta, P1."
)
"""Vocabulary hint given to the decoder: racing words it would otherwise spell as common
English ("box" heard as "books", "DRS" as "the arrest")."""
NO_SPEECH_MAX = 0.6
LOGPROB_MIN = -1.0
"""A segment is dropped as silence when its no-speech probability is above
``NO_SPEECH_MAX`` and its mean log probability below ``LOGPROB_MIN``: the thresholds
Whisper itself uses to skip silent windows."""
HALLUCINATIONS = frozenset(
    {"thank you", "thanks for watching", "thank you for watching", "you", "bye", "beep"}
)
"""Phrases Whisper invents on noise (they come from video subtitles in its training data).
A segment made of one of them alone is dropped."""


class _Segment(Protocol):
    text: str
    avg_logprob: float
    no_speech_prob: float


class _Info(Protocol):
    language: str


class WhisperModelLike(Protocol):
    def transcribe(
        self,
        audio: BinaryIO,
        *,
        language: str,
        beam_size: int,
        initial_prompt: str,
        vad_filter: bool,
        condition_on_previous_text: bool,
    ) -> tuple[Iterable[_Segment], _Info]: ...


ModelLoader = Callable[["WhisperSettings"], WhisperModelLike]


@dataclass(frozen=True, slots=True)
class WhisperSettings:
    model: str = WHISPER_MODEL
    compute_type: str = WHISPER_COMPUTE_TYPE
    language: str = WHISPER_LANGUAGE
    model_dir: str | None = None
    """Where checkpoints are downloaded on first use (Hugging Face cache when ``None``)."""
    cpu_threads: int = 0
    """0 lets CTranslate2 pick the number of cores."""


def load_whisper(settings: WhisperSettings) -> WhisperModelLike:
    """Load the model (downloading the checkpoint on first use).

    Raises:
        TranscriptionUnavailableError: ``faster-whisper`` is not installed.
    """
    try:
        module = importlib.import_module("faster_whisper")
    except ImportError as exc:
        raise TranscriptionUnavailableError(
            "whisper", "faster-whisper is not installed (stintline-racedata[transcription])"
        ) from exc
    model: WhisperModelLike = module.WhisperModel(
        settings.model,
        device="cpu",
        compute_type=settings.compute_type,
        download_root=settings.model_dir,
        cpu_threads=settings.cpu_threads,
    )
    return model


class WhisperTranscriber:
    """Whisper on the CPU. The model loads on the first clip and stays loaded for the life
    of this object: build one per batch of clips so the memory is given back after it."""

    def __init__(
        self, settings: WhisperSettings | None = None, loader: ModelLoader = load_whisper
    ) -> None:
        self.settings = settings or WhisperSettings()
        self._loader = loader
        self._model: WhisperModelLike | None = None

    def transcribe(self, audio: bytes) -> Transcript:
        """Raises:
        TranscriptionUnavailableError: no engine installed.
        TranscriptionFailedError: the audio could not be decoded.
        """
        if self._model is None:
            self._model = self._loader(self.settings)
        try:
            segments, _info = self._model.transcribe(
                io.BytesIO(audio),
                language=self.settings.language,
                beam_size=WHISPER_BEAM_SIZE,
                initial_prompt=WHISPER_PROMPT,
                vad_filter=True,
                condition_on_previous_text=False,
            )
            kept = [s for s in segments if _is_speech(s)]
        except (ValueError, RuntimeError, OSError, IndexError) as exc:
            # PyAV and CTranslate2 raise these on corrupt or empty audio.
            raise TranscriptionFailedError("whisper", type(exc).__name__) from exc
        return _transcript(kept, self.settings)


def _is_speech(segment: _Segment) -> bool:
    if segment.no_speech_prob > NO_SPEECH_MAX and segment.avg_logprob < LOGPROB_MIN:
        return False
    return _normalise(segment.text) not in HALLUCINATIONS and bool(segment.text.strip())


def _normalise(text: str) -> str:
    return re.sub(r"[^a-z ]+", "", text.lower()).strip()


def _transcript(segments: list[_Segment], settings: WhisperSettings) -> Transcript:
    text = " ".join(s.text.strip() for s in segments).strip()
    confidence: float | None = None
    if text:
        weights = [max(len(s.text.strip()), 1) for s in segments]
        mean = sum(w * s.avg_logprob for w, s in zip(weights, segments, strict=True))
        confidence = round(math.exp(mean / sum(weights)), 3)
    return Transcript(
        text=text, language=settings.language, confidence=confidence, model=settings.model
    )

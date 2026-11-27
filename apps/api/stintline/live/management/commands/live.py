"""``manage.py live [--record DIR] [--replay FILE --speed 10]``

Live mode (ADR 0011, 0030): connect to the official live timing feed,
keep the session state, and broadcast a snapshot every second to ``/ws/live``. With
``--replay`` a recording is played back instead, at ``--speed`` times real time (for
development, demos and checking a recorded weekend). Team radio is transcribed as it
arrives (ADR 0029) unless ``--no-transcribe`` or ``RADIO_TRANSCRIPTION_ENABLED`` is off.

On a server the hub refuses, ``RADIO_RELAY_URL`` / ``RADIO_RELAY_TOKEN`` (the relay that
already serves the team radio clips) carry the connection too (ADR 0030).
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import structlog
from asgiref.sync import sync_to_async
from django.conf import settings
from django.core.management.base import BaseCommand, CommandParser

from racedata.live import recording
from racedata.live.client import Connection, connect_official, run_forever
from racedata.live.protocol import Event
from racedata.radio import TranscriptionUnavailableError
from stintline.ingestion import radio
from stintline.ingestion.sources import MODE_HTTP, build_sources
from stintline.live.publisher import PUBLISH_INTERVAL_S, Publisher
from stintline.live.radio import LIVE_RADIO_INTERVAL_S, RadioListener

log = structlog.get_logger(__name__)


async def _connect() -> Connection:
    """The official hub, through the configured relay when there is one."""
    cfg = settings.RACEDATA
    return await connect_official(
        relay_url=cfg.get("RADIO_RELAY_URL") or None,
        relay_token=cfg.get("RADIO_RELAY_TOKEN") or None,
    )


class Command(BaseCommand):
    help = "Follow the live timing feed (personal use, local only) and broadcast it."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--record", type=Path, help="directory for raw recordings")
        parser.add_argument("--replay", type=Path, help="play a recording instead of the feed")
        parser.add_argument("--speed", type=float, default=1.0, help="replay speed factor")
        parser.add_argument(
            "--no-transcribe", action="store_true", help="do not transcribe team radio"
        )

    def handle(
        self,
        *args: Any,
        record: Path | None = None,
        replay: Path | None = None,
        speed: float = 1.0,
        no_transcribe: bool = False,
        **options: Any,
    ) -> None:
        asyncio.run(self._run(record, replay, speed, transcribe=not no_transcribe))

    async def _run(
        self, record: Path | None, replay: Path | None, speed: float, *, transcribe: bool
    ) -> None:
        publisher = Publisher()
        recorder = None
        if record is not None and replay is None:
            path = record / f"{datetime.now(UTC):%Y%m%dT%H%M%SZ}.jsonl"
            try:
                recorder = recording.Recorder(path)
                self.stdout.write(f"Recording to {path}")
            except OSError as exc:
                # Recording is a bonus: the live view must run without it.
                log.warning("live_recording_disabled", path=str(path), error=str(exc))
                self.stderr.write(f"Cannot record to {path} ({exc}); continuing without")
        send = sync_to_async(publisher.send)
        load_circuit = sync_to_async(publisher.load_circuit)

        async def flush(*, force: bool = False) -> None:
            if publisher.needs_circuit():
                await load_circuit()
            data = publisher.take_if_due(force=force)
            if data is not None:
                await send(data)

        async def on_event(event: Event) -> None:
            publisher.apply(event)
            if recorder is not None:
                recorder.write(event)

        async def heartbeat() -> None:
            while True:
                await asyncio.sleep(PUBLISH_INTERVAL_S)
                await flush()

        ticker = asyncio.create_task(heartbeat())
        listener = None
        sources = build_sources(MODE_HTTP) if transcribe and radio.enabled() else None
        if sources is not None and sources.radio is not None:
            listener = asyncio.create_task(
                self._listen(RadioListener(publisher, sources.radio, radio.build_transcriber()))
            )
        try:
            if replay is not None:
                self.stdout.write(f"Replaying {replay} at x{speed}")
                async for event in recording.replay(replay, speed=speed):
                    await on_event(event)
                await flush(force=True)
                self.stdout.write(self.style.SUCCESS("Replay finished"))
            else:
                self.stdout.write("Following the live timing feed (Ctrl+C to stop)")
                await run_forever(on_event, connect=_connect)
                await flush(force=True)
        finally:
            ticker.cancel()
            if listener is not None:
                listener.cancel()
            if sources is not None:
                sources.close()
            if recorder is not None:
                recorder.close()

    async def _listen(self, listener: RadioListener) -> None:
        """Transcribe new team radio clips in a thread, so the feed is never held up."""
        while True:
            try:
                await asyncio.to_thread(listener.step)
            except TranscriptionUnavailableError:
                log.warning("live_radio_transcription_unavailable")
                self.stderr.write("Team radio not transcribed: faster-whisper is not installed")
                return
            await asyncio.sleep(LIVE_RADIO_INTERVAL_S)

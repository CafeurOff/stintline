"""``manage.py live [--record DIR] [--replay FILE --speed 10]``

Local live mode (ADR 0002): connect to the official live timing feed from this machine,
keep the session state, and broadcast a snapshot every second to ``/ws/live``. With
``--replay`` a recording is played back instead, at ``--speed`` times real time (for
development, demos and checking a recorded weekend).

Personal use only. Never run this from a public server: the feed is for personal use
and cloud addresses are blocked.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import structlog
from asgiref.sync import sync_to_async
from django.core.management.base import BaseCommand, CommandParser

from racedata.live import recording
from racedata.live.client import run_forever
from racedata.live.protocol import Event
from stintline.live.publisher import PUBLISH_INTERVAL_S, Publisher

log = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Follow the live timing feed (personal use, local only) and broadcast it."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--record", type=Path, help="directory for raw recordings")
        parser.add_argument("--replay", type=Path, help="play a recording instead of the feed")
        parser.add_argument("--speed", type=float, default=1.0, help="replay speed factor")

    def handle(
        self,
        *args: Any,
        record: Path | None = None,
        replay: Path | None = None,
        speed: float = 1.0,
        **options: Any,
    ) -> None:
        asyncio.run(self._run(record, replay, speed))

    async def _run(self, record: Path | None, replay: Path | None, speed: float) -> None:
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
        flush = sync_to_async(publisher.publish_if_due)

        async def on_event(event: Event) -> None:
            publisher.apply(event)
            if recorder is not None:
                recorder.write(event)
            await flush()

        async def heartbeat() -> None:
            while True:
                await asyncio.sleep(PUBLISH_INTERVAL_S)
                await flush()

        ticker = asyncio.create_task(heartbeat())
        try:
            if replay is not None:
                self.stdout.write(f"Replaying {replay} at x{speed}")
                async for event in recording.replay(replay, speed=speed):
                    await on_event(event)
                await sync_to_async(publisher.publish_if_due)(force=True)
                self.stdout.write(self.style.SUCCESS("Replay finished"))
            else:
                self.stdout.write("Following the live timing feed (Ctrl+C to stop)")
                await run_forever(on_event)
        finally:
            ticker.cancel()
            if recorder is not None:
                recorder.close()

"""SignalR Core client for the official live timing hub (no authentication).

Run from a personal connection only (ADR 0002): cloud addresses are reportedly blocked,
and the formula1.com terms restrict live timing to personal use.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable, Sequence
from typing import Protocol

import httpx
import structlog
import websockets

from racedata.live.protocol import (
    HANDSHAKE,
    PING,
    TOPICS,
    Closed,
    Event,
    classify,
    decode,
    encode,
    subscribe,
)

NEGOTIATE_URL = "https://livetiming.formula1.com/signalrcore/negotiate"
HUB_URL = "wss://livetiming.formula1.com/signalrcore"
USER_AGENT = "StintLine/0.1 (+https://github.com/CafeurOff/stintline)"
KEEP_ALIVE_S = 15.0
"""The hub drops clients silent for 30 s: a ping every 15 s keeps the connection open."""
RETRY_DELAYS_S: tuple[float, ...] = (2.0, 5.0, 10.0, 30.0, 60.0)
"""Back-off between reconnections; the last delay repeats."""

log = structlog.get_logger(__name__)


class Connection(Protocol):
    async def send(self, message: str) -> None: ...

    async def recv(self) -> str | bytes: ...

    async def close(self) -> None: ...


Connect = Callable[[], Awaitable[Connection]]


class HubError(RuntimeError):
    """The hub refused the handshake or closed the connection with an error."""


async def connect_official(timeout_s: float = 20.0) -> Connection:
    """Negotiate with the hub, then open the WebSocket.

    The load balancer requires its ``AWSALBCORS`` cookie, set by a pre-flight request.
    """
    headers = {"User-Agent": USER_AGENT}
    async with httpx.AsyncClient(timeout=timeout_s, headers=headers) as http:
        await http.options(NEGOTIATE_URL)
        response = await http.post(NEGOTIATE_URL, params={"negotiateVersion": 1})
        response.raise_for_status()
        token = response.json().get("connectionToken")
        cookie = "; ".join(f"{k}={v}" for k, v in http.cookies.items())
    url = f"{HUB_URL}?id={token}" if token else HUB_URL
    return await websockets.connect(
        url,
        additional_headers={**headers, **({"Cookie": cookie} if cookie else {})},
        open_timeout=timeout_s,
        max_size=None,
    )


async def stream(connection: Connection, topics: Sequence[str] = TOPICS) -> AsyncIterator[Event]:
    """Handshake, subscribe, then yield the snapshot and every feed update."""
    await connection.send(encode(HANDSHAKE))
    handshake = decode(_text(await connection.recv()))
    if handshake and handshake[0].get("error"):
        raise HubError(str(handshake[0]["error"]))
    await connection.send(encode(subscribe(tuple(topics))))
    while True:
        try:
            frame = await asyncio.wait_for(connection.recv(), timeout=KEEP_ALIVE_S)
        except TimeoutError:
            await connection.send(encode({"type": PING}))
            continue
        for message in decode(_text(frame)):
            event = classify(message)
            if isinstance(event, Closed):
                if event.error:
                    raise HubError(event.error)
                return
            if event is not None:
                yield event


def _text(frame: str | bytes) -> str:
    return frame.decode("utf-8") if isinstance(frame, bytes) else frame


async def run_forever(
    on_event: Callable[[Event], Awaitable[None]],
    *,
    connect: Connect = connect_official,
    topics: Sequence[str] = TOPICS,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    max_attempts: int | None = None,
) -> None:
    """Stream events to ``on_event``, reconnecting with back-off after any failure.

    A fresh snapshot follows every reconnection, so no update is lost for long.
    ``max_attempts`` bounds the connections made (tests); ``None`` runs until cancelled.
    """
    attempt = 0
    while max_attempts is None or attempt < max_attempts:
        try:
            connection = await connect()
            attempt = 0 if max_attempts is None else attempt
            try:
                async for event in stream(connection, topics):
                    await on_event(event)
            finally:
                await connection.close()
            log.info("live_connection_closed")
        except (OSError, HubError, httpx.HTTPError, websockets.WebSocketException) as exc:
            log.warning("live_connection_failed", error=type(exc).__name__)
        attempt += 1
        await sleep(RETRY_DELAYS_S[min(attempt, len(RETRY_DELAYS_S)) - 1])

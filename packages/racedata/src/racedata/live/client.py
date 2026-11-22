"""SignalR Core client for the official live timing hub (no authentication).

The hub refuses some datacenter addresses: a server reaches it through a relay that serves
the same ``/signalrcore`` paths behind a bearer token (ADR 0030).
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

HUB_ORIGIN = "https://livetiming.formula1.com"
NEGOTIATE_PATH = "/signalrcore/negotiate"
HUB_PATH = "/signalrcore"
NEGOTIATE_URL = HUB_ORIGIN + NEGOTIATE_PATH
HUB_URL = "wss://livetiming.formula1.com" + HUB_PATH
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


def hub_urls(relay_url: str | None = None) -> tuple[str, str]:
    """The negotiate and WebSocket URLs: the official hub, or a relay serving its paths."""
    origin = (relay_url or HUB_ORIGIN).rstrip("/")
    ws_origin = (
        "wss://" + origin.removeprefix("https://")
        if origin.startswith("https://")
        else ("ws://" + origin.removeprefix("http://"))
    )
    return origin + NEGOTIATE_PATH, ws_origin + HUB_PATH


async def connect_official(
    timeout_s: float = 20.0, *, relay_url: str | None = None, relay_token: str | None = None
) -> Connection:
    """Negotiate with the hub, then open the WebSocket.

    The load balancer requires its ``AWSALBCORS`` cookie, set by a pre-flight request.
    With ``relay_url``, both go through the relay with ``relay_token`` as a bearer token
    (never sent to the hub itself).
    """
    negotiate_url, hub_url = hub_urls(relay_url)
    headers = {"User-Agent": USER_AGENT}
    if relay_url and relay_token:
        headers["Authorization"] = f"Bearer {relay_token}"
    async with httpx.AsyncClient(timeout=timeout_s, headers=headers) as http:
        await http.options(negotiate_url)
        response = await http.post(negotiate_url, params={"negotiateVersion": 1})
        response.raise_for_status()
        token = response.json().get("connectionToken")
        cookie = "; ".join(f"{k}={v}" for k, v in http.cookies.items())
    url = f"{hub_url}?id={token}" if token else hub_url
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

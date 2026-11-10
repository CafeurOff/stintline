"""WebSocket ``/ws/live``: the latest snapshot on connect, then every new one."""

from __future__ import annotations

from typing import Any

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from stintline.live.publisher import GROUP, latest


class LiveConsumer(AsyncJsonWebsocketConsumer):  # type: ignore[misc]
    async def connect(self) -> None:
        await self.channel_layer.group_add(GROUP, self.channel_name)
        await self.accept()
        current = await sync_to_async(latest)()
        if current is not None:
            await self.send_json(current)

    async def disconnect(self, code: int) -> None:
        await self.channel_layer.group_discard(GROUP, self.channel_name)

    async def live_snapshot(self, event: dict[str, Any]) -> None:
        await self.send_json(event["data"])

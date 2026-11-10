"""WebSocket routes."""

from typing import Any

from django.urls import path

from stintline.live.consumers import LiveConsumer

websocket_urlpatterns: list[Any] = [path("ws/live", LiveConsumer.as_asgi())]

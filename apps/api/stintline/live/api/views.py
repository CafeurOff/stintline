from __future__ import annotations

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from stintline.live.api.serializers import LiveStatusSerializer
from stintline.live.publisher import latest
from stintline.racing.models import Session

LIVE_STATUSES = frozenset({"Started", "Aborted"})
WAITING_STATUSES = frozenset({"Inactive"})


def live_state(snapshot: dict[str, object] | None) -> str:
    if snapshot is None:
        return "offline"
    session = snapshot.get("session")
    status = session.get("status") if isinstance(session, dict) else None
    if status in LIVE_STATUSES:
        return "live"
    if status in WAITING_STATUSES:
        return "waiting"
    return "finished"


class LiveStatusView(APIView):
    @extend_schema(
        operation_id="live_retrieve",
        summary="Live session snapshot (local live mode) and the next session",
        responses=LiveStatusSerializer,
        tags=["live"],
    )
    def get(self, request: Request) -> Response:
        snapshot = latest()
        upcoming = (
            Session.objects.filter(scheduled_start__gt=timezone.now())
            .select_related("event")
            .order_by("scheduled_start")
            .first()
        )
        data = {
            "state": live_state(snapshot),
            "snapshot": snapshot,
            "next_session": (
                {
                    "event_id": upcoming.event_id,
                    "event_name": upcoming.event.name,
                    "kind": upcoming.kind,
                    "starts_at": upcoming.scheduled_start,
                }
                if upcoming is not None
                else None
            ),
        }
        response = Response(LiveStatusSerializer(data).data)
        response["Cache-Control"] = "no-store"
        return response

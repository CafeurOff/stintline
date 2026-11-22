from __future__ import annotations

from datetime import datetime, timedelta

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from stintline.live.api.serializers import LiveStatusSerializer
from stintline.live.publisher import latest
from stintline.racing.models import Session

LIVE_STATUSES = frozenset({"Started", "Aborted"})
WAITING_STATUSES = frozenset({"Inactive"})
FINISHED_SHOWN = timedelta(hours=4)
"""How long after its start a finished session stays on the live page. The live process
keeps the last session until the hub moves on, often a day later: past this, the page
shows what comes next instead (ADR 0030)."""


def live_state(snapshot: dict[str, object] | None, now: datetime | None = None) -> str:
    if snapshot is None:
        return "offline"
    session = snapshot.get("session")
    status = session.get("status") if isinstance(session, dict) else None
    if status in LIVE_STATUSES:
        return "live"
    if status in WAITING_STATUSES:
        return "waiting"
    starts = session.get("starts_at") if isinstance(session, dict) else None
    started = parse_datetime(starts) if isinstance(starts, str) else None
    if started is not None and (now or timezone.now()) - started > FINISHED_SHOWN:
        return "offline"
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
        state = live_state(snapshot)
        data = {
            "state": state,
            "snapshot": None if state == "offline" else snapshot,
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

"""Read queries for stored forecasts."""

from __future__ import annotations

import datetime as dt

from django.db.models import QuerySet

from stintline.forecast.models import SessionForecast
from stintline.forecast.services import KEEP_AFTER_START


def forecasts(now: dt.datetime, event_id: int | None = None) -> QuerySet[SessionForecast]:
    """Forecasts of sessions not long started, for one weekend or all of them."""
    rows = SessionForecast.objects.filter(
        session__scheduled_start__gte=now - KEEP_AFTER_START
    ).select_related("session")
    if event_id is not None:
        rows = rows.filter(session__event_id=event_id)
    return rows.order_by("session__scheduled_start")

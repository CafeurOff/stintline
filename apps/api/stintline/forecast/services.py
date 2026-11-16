"""Fetch Open-Meteo forecasts for upcoming sessions and summarise them (ADR 0020).

One request per Grand Prix weekend covers all its sessions. A session's window runs from
its scheduled start over its usual length; the summary keeps what a fan asks before a
session: how warm, will it rain (highest hourly chance and the total), how windy.
"""

from __future__ import annotations

import datetime as dt
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from statistics import fmean
from typing import Any

import structlog
from django.db import transaction

from racedata.errors import ProviderError
from racedata.models import HourlyForecast
from racedata.providers.openmeteo import HORIZON_DAYS
from racedata.sources import Sources
from stintline.forecast.models import SessionForecast
from stintline.racing.models import Session, SessionKind

log = structlog.get_logger(__name__)

SESSION_LENGTH = {
    SessionKind.RACE: dt.timedelta(hours=2),
    SessionKind.SPRINT: dt.timedelta(hours=1),
}
"""Window over which a session's weather is summarised. A race runs up to two hours;
sprints, qualifying and practice about one hour."""
DEFAULT_LENGTH = dt.timedelta(hours=1)
HOURS_AROUND = dt.timedelta(hours=1)
"""Hourly points kept either side of the window, for the small chart."""
KEEP_AFTER_START = dt.timedelta(hours=3)
"""A session keeps being refreshed (and listed) until this long after its start."""


@dataclass(frozen=True, slots=True)
class Summary:
    window_start: dt.datetime
    window_end: dt.datetime
    air_c: float | None
    air_min_c: float | None
    air_max_c: float | None
    rain_probability_pct: float | None
    precipitation_mm: float | None
    wind_ms: float | None
    weather_code: int | None
    hours: list[dict[str, Any]]


def window(session: Session) -> tuple[dt.datetime, dt.datetime]:
    if session.scheduled_start is None:
        raise ValueError("a session without a scheduled start has no forecast window")
    start = session.scheduled_start.astimezone(dt.UTC)
    return start, start + SESSION_LENGTH.get(SessionKind(session.kind), DEFAULT_LENGTH)


def _values(points: Sequence[float | None]) -> list[float]:
    return [p for p in points if p is not None]


def summarise(hours: Sequence[HourlyForecast], start: dt.datetime, end: dt.datetime) -> Summary:
    """Hours whose slot overlaps ``[start, end)``: the hour that holds the start counts."""
    first = start.replace(minute=0, second=0, microsecond=0)
    inside = [h for h in hours if first <= h.at < end]
    air = _values([h.air_c for h in inside])
    rain = _values([h.rain_probability_pct for h in inside])
    wet = _values([h.precipitation_mm for h in inside])
    wind = _values([h.wind_ms for h in inside])
    codes = [h.weather_code for h in inside if h.weather_code is not None]
    around = [h for h in hours if first - HOURS_AROUND <= h.at <= end + HOURS_AROUND]
    return Summary(
        window_start=start,
        window_end=end,
        air_c=round(fmean(air), 1) if air else None,
        air_min_c=min(air) if air else None,
        air_max_c=max(air) if air else None,
        rain_probability_pct=max(rain) if rain else None,
        precipitation_mm=round(sum(wet), 1) if wet else None,
        wind_ms=max(wind) if wind else None,
        weather_code=max(codes) if codes else None,
        hours=[h.model_dump(mode="json") for h in around],
    )


def upcoming_sessions(now: dt.datetime) -> list[Session]:
    """Sessions within Open-Meteo's range, at a circuit with coordinates."""
    return list(
        Session.objects.filter(
            scheduled_start__gte=now - KEEP_AFTER_START,
            scheduled_start__lte=now + dt.timedelta(days=HORIZON_DAYS - 1),
            event__circuit__latitude__isnull=False,
            event__circuit__longitude__isnull=False,
        )
        .select_related("event__circuit")
        .order_by("scheduled_start")
    )


def refresh_forecasts(sources: Sources, now: dt.datetime) -> int:
    """Store the latest forecast of every upcoming session; returns how many were stored.

    A weekend that fails (upstream down, bad payload) is logged and skipped.
    """
    if sources.weather is None:
        return 0
    weekends: dict[int, list[Session]] = defaultdict(list)
    for session in upcoming_sessions(now):
        weekends[session.event_id].append(session)
    stored = 0
    for sessions in weekends.values():
        circuit = sessions[0].event.circuit
        windows = {s.pk: window(s) for s in sessions}
        first = min(start for start, _ in windows.values()).date()
        last = max(end for _, end in windows.values()).date()
        try:
            hours = sources.weather.hourly(
                circuit.latitude or 0.0, circuit.longitude or 0.0, first, last
            )
        except ProviderError as exc:
            log.warning("forecast_fetch_failed", event_id=sessions[0].event_id, error=repr(exc))
            continue
        with transaction.atomic():
            for session in sessions:
                summary = summarise(hours, *windows[session.pk])
                SessionForecast.objects.update_or_create(
                    session=session,
                    defaults={"fetched_at": now, **_fields(summary)},
                )
                stored += 1
    log.info("forecasts_refreshed", sessions=stored, weekends=len(weekends))
    return stored


def _fields(summary: Summary) -> dict[str, Any]:
    return {name: getattr(summary, name) for name in Summary.__slots__}

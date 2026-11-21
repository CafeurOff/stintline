"""Prometheus metrics: what the stored data covers and whether imports keep up (ADR 0027).

Read from the database at scrape time, so every process reports the same numbers and nothing
has to be updated by the ingestion code. The queries are counts over small tables.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta

from django.db.models import Count, Max, Q
from django.utils import timezone
from prometheus_client.core import GaugeMetricFamily
from prometheus_client.registry import Collector

from stintline.news.models import Headline
from stintline.racing.models import RACE_KINDS, Season, Session, TelemetryLap

IMPORT_GRACE = timedelta(hours=6)
"""A race or sprint is overdue once it ended this long ago without being imported:
``refresh_recent`` runs every 30 min and the providers publish laps within a few hours."""

IMPORT_LOOKBACK = timedelta(days=30)
"""Only recent races count as overdue; older gaps are history, filled by ``ingest_history``."""


def _timestamp(value: datetime | None) -> float:
    return value.timestamp() if value is not None else 0.0


def _gauge(name: str, documentation: str, value: float) -> GaugeMetricFamily:
    return GaugeMetricFamily(name, documentation, value=value)


class StintlineCollector(Collector):
    """Data coverage and freshness, collected on each scrape."""

    def collect(self) -> Iterator[GaugeMetricFamily]:
        now = timezone.now()
        sessions = Session.objects.aggregate(
            total=Count("id"),
            ingested=Count("id", filter=Q(ingested_at__isnull=False)),
            last_ingest=Max("ingested_at"),
        )
        overdue = Session.objects.filter(
            kind__in=RACE_KINDS,
            ingested_at__isnull=True,
            ends_at__lt=now - IMPORT_GRACE,
            ends_at__gte=now - IMPORT_LOOKBACK,
        ).count()
        telemetry_races = TelemetryLap.objects.values("entry__session_id").distinct().count()
        last_headline = Headline.objects.aggregate(last=Max("fetched_at"))["last"]

        yield _gauge("stintline_seasons", "Seasons stored.", Season.objects.count())
        yield _gauge("stintline_sessions", "Sessions stored.", sessions["total"])
        yield _gauge(
            "stintline_sessions_ingested", "Sessions with imported timing.", sessions["ingested"]
        )
        yield _gauge(
            "stintline_races_with_telemetry",
            "Races and sprints with telemetry (replays and 3D view).",
            telemetry_races,
        )
        yield _gauge(
            "stintline_races_overdue",
            "Races and sprints of the last 30 days, ended over 6 h ago, still not imported.",
            overdue,
        )
        yield _gauge(
            "stintline_last_ingest_timestamp_seconds",
            "Time of the latest session import (0 if none).",
            _timestamp(sessions["last_ingest"]),
        )
        yield _gauge(
            "stintline_last_headlines_timestamp_seconds",
            "Time of the latest news headline fetch (0 if none).",
            _timestamp(last_headline),
        )

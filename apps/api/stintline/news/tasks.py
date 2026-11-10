"""Celery task: read the news feeds (every 30 minutes, and when a worker starts)."""

from __future__ import annotations

from celery import shared_task
from django.utils import timezone

from stintline.ingestion.sources import open_sources
from stintline.news import services


@shared_task(acks_late=True)
def refresh_headlines() -> int:
    """Feeds fail one by one without failing the task (``racedata.providers.feeds``)."""
    with open_sources() as sources:
        return services.refresh_headlines(sources, timezone.now())

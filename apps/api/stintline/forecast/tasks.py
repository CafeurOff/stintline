"""Celery task: refresh the forecasts of upcoming sessions (every 3 hours, and on start)."""

from __future__ import annotations

from celery import shared_task
from django.utils import timezone

from stintline.forecast import services
from stintline.ingestion.sources import open_sources


@shared_task(acks_late=True)
def refresh_forecasts() -> int:
    """A weekend that fails is skipped without failing the task."""
    with open_sources() as sources:
        return services.refresh_forecasts(sources, timezone.now())

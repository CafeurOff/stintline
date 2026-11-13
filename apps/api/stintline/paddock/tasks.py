"""Celery task: keep the FIA documents of the configured seasons current (ADR 0018)."""

from __future__ import annotations

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from stintline.ingestion.sources import open_sources
from stintline.paddock import refresh


@shared_task(acks_late=True)
def refresh_fia_documents() -> dict[str, int]:
    """Every 30 minutes: active weekends, events never listed, then a batch of PDFs."""
    with open_sources() as sources:
        if sources.fia is None:
            return {"events": 0, "texts": 0}
        seasons = [s for s in settings.FIA_SEASONS if s in sources.fia.seasons]
        report = refresh.refresh(sources.fia, seasons, timezone.now())
    return {"events": len(report.events), "texts": report.texts, "errors": report.errors}

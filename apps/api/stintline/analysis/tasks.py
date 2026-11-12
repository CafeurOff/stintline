"""Celery tasks: compute the analysis figures of a race after its import (ADR 0017)."""

from __future__ import annotations

import structlog
from celery import shared_task

from stintline.analysis import build
from stintline.racing.models import Session

log = structlog.get_logger(__name__)

STALE_PER_RUN = 30
"""Races rebuilt per ``build_stale_analysis`` run. A race takes about a second of CPU, so a
full backfill (four seasons) spreads over a few runs without blocking imports."""


@shared_task(acks_late=True)
def build_race_analysis(session_id: int) -> bool:
    session = Session.objects.select_related("event").get(pk=session_id)
    return build.build_race_stats(session) is not None


@shared_task(acks_late=True)
def build_stale_analysis(limit: int = STALE_PER_RUN) -> int:
    """Rebuild the races whose figures are missing or out of date, newest first."""
    done = 0
    for session in build.stale_sessions().select_related("event")[:limit]:
        if build.build_race_stats(session) is not None:
            done += 1
    log.info("analysis_stale_built", sessions=done)
    return done

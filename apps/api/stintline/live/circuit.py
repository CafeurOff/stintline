"""What the live view borrows from stored races at the same circuit."""

from __future__ import annotations

from dataclasses import dataclass

import structlog
from django.core.cache import cache

from stintline.racing.models import Session, SessionKind, TrackOutline
from stintline.strategy_api import services

log = structlog.get_logger(__name__)
CACHE_S = 6 * 60 * 60


@dataclass(frozen=True)
class CircuitContext:
    reference_session_id: int | None
    """Latest stored race at this circuit with a circuit outline (drawn by the UI)."""
    pit_loss_s: float | None
    pit_loss_sigma_s: float | None


def circuit_context(circuit_key: int | None) -> CircuitContext:
    """Outline and pit loss from the latest stored race at the circuit (OpenF1 key)."""
    empty = CircuitContext(None, None, None)
    if circuit_key is None:
        return empty
    key = f"live:circuit:{circuit_key}"
    cached: CircuitContext | None = cache.get(key)
    if cached is not None:
        return cached
    outline = (
        TrackOutline.objects.filter(
            session__event__circuit__openf1_circuit_key=circuit_key,
            session__kind=SessionKind.RACE,
        )
        .select_related("session")
        .order_by("-session__event__race_date")
        .first()
    )
    context = empty
    if outline is not None:
        session: Session = outline.session
        loss = None
        try:
            loss = services.race_context(session).pit_loss
        except services.StrategyInputError:
            log.warning("live_pit_loss_unavailable", session_id=session.pk)
        context = CircuitContext(
            reference_session_id=session.pk,
            pit_loss_s=loss.green_s if loss else None,
            pit_loss_sigma_s=loss.green_sigma_s if loss else None,
        )
    cache.set(key, context, CACHE_S)
    return context

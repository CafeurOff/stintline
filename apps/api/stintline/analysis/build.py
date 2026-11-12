"""Compute and store the per-race figures of the analysis pages (ADR 0017).

Runs after each import (``stintline.ingestion.tasks``) and from ``manage.py build_analysis``.
Idempotent: rebuilding a race overwrites its rows.
"""

from __future__ import annotations

from collections import Counter
from statistics import median

import structlog
from django.db import transaction
from django.db.models import F, Max, Q, QuerySet
from django.utils import timezone

from stintline.analysis.models import EntryRaceStats, RaceStats
from stintline.racing.models import (
    RACE_KINDS,
    PitStop,
    Session,
    SessionEntry,
    Stint,
    TelemetryLap,
    TrackStatus,
)
from stintline.strategy_api.services import (
    LOW_CONFIDENCE_MIN_STINTS,
    RaceContext,
    StrategyInputError,
    race_context,
)
from stintline.strategy_api.telemetry import lap_samples
from stintline_strategy import analysis as engine
from stintline_strategy import telemetry as tele

log = structlog.get_logger(__name__)

ANALYSIS_FORMAT = 1
"""Bump when a stored figure changes meaning: every race is rebuilt on the next run."""

MIN_CLEAN_LAPS = 5
"""Clean laps a car needs before its median pace is stored. Fewer laps (an early
retirement, a race behind the safety car) say more about traffic than about pace."""

MIN_STATIONARY_S = 1.6
"""Stationary times below this are timing glitches: the record is about 1.8 s."""


def _median_or_none(values: list[float]) -> float | None:
    return median(values) if values else None


def _neutralisations(session: Session) -> Counter[str]:
    return Counter(TrackStatus.objects.filter(session=session).values_list("status", flat=True))


def _telemetry_figures(session: Session) -> dict[str, float | int | None]:
    """Lap length, top speed, full-throttle share and braking zones of the race's fastest
    stored lap. Empty when no telemetry is stored yet."""
    lap = TelemetryLap.objects.filter(entry__session=session).order_by("lap_time_s").first()
    blank: dict[str, float | int | None] = {
        "lap_length_m": None,
        "top_speed_kph": None,
        "full_throttle_share": None,
        "braking_zones": None,
    }
    if lap is None:
        return blank
    try:
        samples = lap_samples(lap)
        length = tele.natural_length(samples)
        trace = tele.trace(samples, length)
    except tele.TelemetryError:
        return blank
    return {
        "lap_length_m": round(length, 1),
        "top_speed_kph": round(float(trace.speed_kph.max()), 1),
        "full_throttle_share": tele.full_throttle_share(trace),
        "braking_zones": len(tele.braking_zones(trace)),
    }


def tyre_strategy(stints: list[Stint], pit_laps: set[int]) -> list[str]:
    """Compounds of a car's race, one per set fitted at a stop. Timing feeds sometimes
    split a stint without a stop (a red flag, a data gap): such a split continues the
    previous set."""
    out: list[str] = []
    for stint in sorted(stints, key=lambda s: s.stint_number):
        after_stop = stint.lap_start is not None and stint.lap_start - 1 in pit_laps
        if not out or after_stop or stint.compound != out[-1]:
            out.append(stint.compound)
    return out


def _winner_strategy(session: Session) -> list[str]:
    winner = session.entries.filter(finish_position=1).first()
    if winner is None:
        return []
    pit_laps = set(winner.pit_stops.values_list("lap_number", flat=True))
    return tyre_strategy(list(winner.stints.all()), pit_laps)


WET_COMPOUNDS = ("INTERMEDIATE", "WET")


def _is_wet(session: Session) -> bool:
    """Intermediate or wet tyres were fitted. A few rain samples alone (a shower that
    never needed other tyres) leave a race dry: the tyres say whether rain mattered."""
    return Stint.objects.filter(entry__session=session, compound__in=WET_COMPOUNDS).exists()


def _entry_rows(
    context: RaceContext, entries: dict[int, SessionEntry]
) -> tuple[list[EntryRaceStats], float | None]:
    race = context.race
    kept = engine.kept_by_car(context.cleaned)
    ordered = has_running_order(context)
    led = engine.laps_led(race) if ordered else {}
    passes = engine.on_track_passes(race) if ordered else []
    made = Counter(p.car for p in passes)
    lost = Counter(p.passed for p in passes)
    stops: dict[int, list[PitStop]] = {}
    for stop in PitStop.objects.filter(entry__session_id=next(iter(entries.values())).session_id):
        stops.setdefault(stop.entry_id, []).append(stop)

    rows: list[EntryRaceStats] = []
    for car, entry in entries.items():
        laps = kept.get(car, [])
        raw = [lap.time_s for lap in laps if lap.time_s is not None]
        corrected = [
            context.fuel.correct(lap.time_s, lap.lap, race.total_laps)
            for lap in laps
            if lap.time_s is not None
        ]
        enough = len(raw) >= MIN_CLEAN_LAPS
        own_stops = stops.get(entry.pk, [])
        stationary = [
            s.stationary_duration_s
            for s in own_stops
            if s.stationary_duration_s is not None and s.stationary_duration_s >= MIN_STATIONARY_S
        ]
        lane = [s.pit_lane_duration_s for s in own_stops if s.pit_lane_duration_s is not None]
        rows.append(
            EntryRaceStats(
                entry=entry,
                clean_laps=len(raw),
                median_s=median(raw) if enough else None,
                median_corrected_s=median(corrected) if enough else None,
                spread_s=engine.consistency_s(laps, race, context.fuel) if enough else None,
                laps_led=led.get(car, 0) if ordered else None,
                passes_made=made.get(car, 0) if ordered else None,
                passes_lost=lost.get(car, 0) if ordered else None,
                stops=len(own_stops),
                best_stationary_s=min(stationary, default=None),
                best_lane_s=min(lane, default=None),
            )
        )
    medians = [r.median_corrected_s for r in rows if r.median_corrected_s is not None]
    return rows, _median_or_none(medians)


def has_running_order(context: RaceContext) -> bool:
    """Lap end times exist (some upstream sessions lack lap start times entirely)."""
    return any(lap.end_time_s is not None for lap in context.race.laps)


def build_race_stats(session: Session) -> RaceStats | None:
    """Compute and store the figures of one race or sprint. ``None`` when the session has
    no usable laps (not imported yet, or cancelled)."""
    try:
        context = race_context(session)
    except StrategyInputError:
        log.info("analysis_skipped", session_id=session.pk, reason="no_laps")
        return None
    race = context.race
    entries = {e.car_number: e for e in session.entries.all()}
    entries = {car: e for car, e in entries.items() if car in set(race.cars)}
    if not entries:
        return None
    entry_rows, field_median = _entry_rows(context, entries)
    flags = _neutralisations(session)
    timed = [lap.time_s for lap in race.laps if lap.time_s is not None]
    loss = context.pit_loss
    degradation = {
        c.compound.value: round(c.slope_s_per_lap, 4)
        for c in context.compounds.values()
        if c.n_stints >= LOW_CONFIDENCE_MIN_STINTS
    }
    undercuts = [
        {
            "attacker": u.attacker,
            "defender": u.defender,
            "attacker_lap": u.attacker_lap,
            "defender_lap": u.defender_lap,
            "gap_before_s": round(u.gap_before_s, 3),
            "gap_after_s": round(u.gap_after_s, 3),
        }
        for u in engine.undercut_attempts(race)
    ]
    values = {
        "format_version": ANALYSIS_FORMAT,
        "built_at": timezone.now(),
        "total_laps": race.total_laps,
        "field_median_s": field_median,
        "fastest_lap_s": min(timed, default=None),
        "pit_loss_s": loss.green_s if loss else None,
        "pit_loss_sigma_s": loss.green_sigma_s if loss else None,
        "pit_loss_stops": loss.n_green if loss else 0,
        "safety_cars": flags.get("SC", 0),
        "virtual_safety_cars": flags.get("VSC", 0),
        "red_flags": flags.get("RED", 0),
        "neutralised_laps": sum(
            1 for n in range(1, race.total_laps + 1) if race.neutralised(n) is not None
        ),
        "passes": (
            sum(r.passes_made or 0 for r in entry_rows) if has_running_order(context) else None
        ),
        "wet": _is_wet(session),
        "degradation": degradation,
        "undercuts": undercuts,
        "winner_strategy": _winner_strategy(session),
        **_telemetry_figures(session),
    }
    with transaction.atomic():
        stats, _ = RaceStats.objects.update_or_create(session=session, defaults=values)
        EntryRaceStats.objects.filter(entry__session=session).delete()
        EntryRaceStats.objects.bulk_create(entry_rows)
    log.info("analysis_built", session_id=session.pk, cars=len(entry_rows))
    return stats


def stale_sessions() -> QuerySet[Session]:
    """Imported races and sprints whose figures are missing, out of date or older than
    their data (a re-import, telemetry stored after the build)."""
    newest_telemetry = Max("entries__telemetry__fetched_at")
    return (
        Session.objects.filter(kind__in=RACE_KINDS, ingested_at__isnull=False)
        .annotate(telemetry_at=newest_telemetry)
        .filter(
            Q(stats__isnull=True)
            | Q(stats__format_version__lt=ANALYSIS_FORMAT)
            | Q(stats__built_at__lt=F("ingested_at"))
            | Q(telemetry_at__gt=F("stats__built_at"))
        )
        .order_by("-ends_at")
    )

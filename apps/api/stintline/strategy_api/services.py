"""Strategy computations for the API, with the per-session race model cached.

Building a race context (cleaning, degradation fits, pace model, pit loss) costs ~100 ms.
It is cached per session and per engine version, keyed on the ingestion timestamp, so
every slider move in the simulator only runs the cheap simulation itself.
"""

from __future__ import annotations

import dataclasses
import json
import re
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

import structlog
from django.core.cache import cache as django_cache

from stintline.racing.models import Session
from stintline.strategy_api.adapters import race_from_session
from stintline_strategy import __version__ as engine_version
from stintline_strategy.degradation import (
    CompoundDegradation,
    DegradationConfig,
    DegradationFit,
    compound_degradation,
    stint_degradation,
)
from stintline_strategy.domain import Compound, Lap, Neutralisation, Race
from stintline_strategy.fuel import FuelModel
from stintline_strategy.laps import CleaningConfig, CleanLap, clean_laps
from stintline_strategy.pace import PaceModel, build_pace_model
from stintline_strategy.pit_exit import PitExitConfig, PitExitPrediction, predict_pit_exit
from stintline_strategy.pit_loss import PitLossConfig, PitLossEstimate, estimate_pit_loss
from stintline_strategy.undercut import CarState, ExchangeResult, undercut
from stintline_strategy.whatif import (
    Strategy,
    WhatIfConfig,
    WhatIfError,
    WhatIfResult,
    replay_strategy,
)
from stintline_strategy.window import WindowConfig

log = structlog.get_logger(__name__)

CONTEXT_CACHE_TIMEOUT_S = 24 * 3600
MODEL_REVISION = "1"
"""Bump when engine behaviour changes without a package version change."""
LOW_CONFIDENCE_MIN_STINTS = 3
DATA_DIR = Path(__file__).resolve().parent / "data"


class StrategyInputError(ValueError):
    """The request is valid in shape but not for this session (unknown car, lap, compound)."""


@dataclass(frozen=True)
class RaceContext:
    race: Race
    cleaned: tuple[CleanLap, ...]
    stint_fits: tuple[DegradationFit, ...]
    compounds: dict[Compound, CompoundDegradation]
    pace: PaceModel
    pit_loss: PitLossEstimate | None
    fuel: FuelModel


def context_version(session: Session) -> str:
    stamp = session.ingested_at.isoformat() if session.ingested_at else "none"
    return f"{engine_version}-{MODEL_REVISION}-{stamp}"


def race_context(session: Session) -> RaceContext:
    key = f"strategy:context:{session.pk}:{context_version(session)}"
    cached: RaceContext | None = django_cache.get(key)
    if cached is not None:
        return cached
    context = _build_context(session)
    django_cache.set(key, context, CONTEXT_CACHE_TIMEOUT_S)
    return context


def _build_context(session: Session) -> RaceContext:
    try:
        race = race_from_session(session)
    except ValueError as exc:
        raise StrategyInputError(str(exc)) from exc
    fuel = FuelModel()
    try:
        pit_loss: PitLossEstimate | None = estimate_pit_loss(race)
    except ValueError:
        pit_loss = None
    log.info("strategy_context_built", session_id=session.pk, laps=len(race.laps))
    return RaceContext(
        race=race,
        cleaned=tuple(clean_laps(race)),
        stint_fits=tuple(stint_degradation(race, fuel=fuel)),
        compounds=compound_degradation(race, fuel=fuel),
        pace=build_pace_model(race, fuel=fuel),
        pit_loss=pit_loss,
        fuel=fuel,
    )


# ------------------------------------------------------------------------- queries


def _require_cars(context: RaceContext, cars: list[int]) -> None:
    unknown = sorted(set(cars) - set(context.race.cars))
    if unknown:
        raise StrategyInputError(f"unknown car number(s) for this session: {unknown}")


def laps(context: RaceContext, cars: list[int]) -> list[dict[str, Any]]:
    _require_cars(context, cars)
    total = context.race.total_laps
    return [
        {
            "car_number": c.lap.car,
            "lap": c.lap.lap,
            "time_s": c.lap.time_s,
            "corrected_time_s": (
                context.fuel.correct(c.lap.time_s, c.lap.lap, total) if c.lap.time_s else None
            ),
            "compound": c.lap.compound.value,
            "tyre_age": c.lap.tyre_age,
            "stint": c.lap.stint,
            "is_pit_in": c.lap.is_pit_in,
            "is_pit_out": c.lap.is_pit_out,
            "race_time_s": c.lap.end_time_s,
            "excluded": c.excluded.value if c.excluded else None,
        }
        for c in context.cleaned
        if c.lap.car in cars
    ]


def replay(context: RaceContext) -> dict[str, Any]:
    """Per car and per lap: race time at the line, compound and tyre age. Enough for the
    UI to place every car on the circuit at any instant (interpolating within a lap) and
    to show what each car is running. Lists are indexed by ``lap - 1``; a lap the car
    did not complete is ``None``."""
    total = context.race.total_laps
    cars: list[dict[str, Any]] = []
    for car in context.race.cars:
        line: list[float | None] = [None] * total
        compounds: list[str | None] = [None] * total
        ages: list[int | None] = [None] * total
        pit_in: list[int] = []
        for lap in context.race.laps_of(car):
            if not 1 <= lap.lap <= total:
                continue
            line[lap.lap - 1] = lap.end_time_s
            compounds[lap.lap - 1] = lap.compound.value
            ages[lap.lap - 1] = lap.tyre_age
            if lap.is_pit_in:
                pit_in.append(lap.lap)
        cars.append(
            {
                "car_number": car,
                "line_times_s": line,
                "compounds": compounds,
                "tyre_ages": ages,
                "pit_in_laps": pit_in,
            }
        )
    return {"total_laps": total, "cars": cars}


def degradation(context: RaceContext, cars: list[int] | None) -> dict[str, Any]:
    if cars:
        _require_cars(context, cars)
    fits = [f for f in context.stint_fits if not cars or f.car in cars]
    return {
        "compounds": [
            {
                "compound": c.compound.value,
                "slope_s_per_lap": c.slope_s_per_lap,
                "slope_ci": list(c.slope_ci),
                "n_laps": c.n_laps,
                "n_stints": c.n_stints,
                "new_tyre_pace_s": c.new_tyre_pace_s,
                "low_confidence": c.n_stints < LOW_CONFIDENCE_MIN_STINTS,
            }
            for c in sorted(context.compounds.values(), key=lambda c: c.compound.value)
        ],
        "stints": [
            {
                "car_number": f.car,
                "stint": f.stint,
                "compound": f.compound.value,
                "model": f.model.value,
                "coefficients": list(f.coefficients),
                "slope_s_per_lap": f.slope_s_per_lap,
                "slope_ci": list(f.slope_ci),
                "r_squared": f.r_squared,
                "rmse_s": f.rmse_s,
                "n_laps": f.n_laps,
                "points": [
                    {"tyre_age": a, "corrected_time_s": t}
                    for a, t in zip(f.ages, f.corrected_times_s, strict=True)
                ],
            }
            for f in fits
        ],
        "fuel": {
            "seconds_per_kg": context.fuel.seconds_per_kg,
            "gain_per_lap_s": context.fuel.gain_per_lap_s(context.race.total_laps),
        },
    }


def pit_loss(context: RaceContext) -> dict[str, Any]:
    estimate = _require_pit_loss(context)
    return {
        "green_s": estimate.green_s,
        "green_sigma_s": estimate.green_sigma_s,
        "n_green": estimate.n_green,
        "neutralised": [
            {"status": k.value, "loss_s": v} for k, v in sorted(estimate.neutralised_s.items())
        ],
        "assumed_sc_s": estimate.under(Neutralisation.SAFETY_CAR),
        "assumed_vsc_s": estimate.under(Neutralisation.VIRTUAL_SAFETY_CAR),
        "stops": [
            {
                "car_number": s.car,
                "lap": s.lap,
                "loss_s": s.loss_s,
                "neutralisation": s.neutralisation.value if s.neutralisation else None,
                "outlier": s.outlier,
            }
            for s in estimate.stops
        ],
    }


def _require_pit_loss(context: RaceContext) -> PitLossEstimate:
    if context.pit_loss is None:
        raise StrategyInputError("no measurable pit stop in this session")
    return context.pit_loss


def compare(context: RaceContext, a: int, b: int) -> dict[str, Any]:
    _require_cars(context, [a, b])
    laps_a = {lap.lap: lap for lap in context.race.laps_of(a)}
    laps_b = {lap.lap: lap for lap in context.race.laps_of(b)}
    rows = []
    for n in sorted(set(laps_a) & set(laps_b)):
        la, lb = laps_a[n], laps_b[n]
        rows.append(
            {
                "lap": n,
                "time_a_s": la.time_s,
                "time_b_s": lb.time_s,
                "gap_s": (
                    lb.end_time_s - la.end_time_s
                    if la.end_time_s is not None and lb.end_time_s is not None
                    else None
                ),
                "compound_a": la.compound.value,
                "compound_b": lb.compound.value,
            }
        )
    return {
        "car_a": a,
        "car_b": b,
        "laps": rows,
        "pace_offset_a_s": context.pace.car_offsets_s.get(a),
        "pace_offset_b_s": context.pace.car_offsets_s.get(b),
    }


def _state_at(context: RaceContext, car: int, lap: int) -> CarState:
    by_lap: dict[int, Lap] = {x.lap: x for x in context.race.laps_of(car)}
    current = by_lap.get(lap)
    if current is None or current.end_time_s is None:
        raise StrategyInputError(f"car {car} has no timing at the end of lap {lap}")
    if current.compound not in context.pace.tyres or current.tyre_age is None:
        raise StrategyInputError(f"no tyre model for car {car}'s {current.compound} at lap {lap}")
    return CarState(car, current.end_time_s, current.compound, current.tyre_age + 1)


def simulate_undercut(
    context: RaceContext,
    *,
    attacker: int,
    defender: int,
    stop_lap: int,
    attacker_compound: str,
    defender_compound: str,
    defender_reaction_laps: int,
) -> ExchangeResult:
    _require_cars(context, [attacker, defender])
    if attacker == defender:
        raise StrategyInputError("attacker and defender must be different cars")
    last = context.race.total_laps - defender_reaction_laps - 2
    if not 2 <= stop_lap <= last:
        raise StrategyInputError(f"stop_lap must be between 2 and {last}")
    for compound in (attacker_compound, defender_compound):
        if Compound(compound) not in context.pace.tyres:
            raise StrategyInputError(f"no degradation model for {compound} in this race")
    return undercut(
        _state_at(context, attacker, stop_lap - 1),
        _state_at(context, defender, stop_lap - 1),
        stop_lap,
        context.pace,
        _require_pit_loss(context),
        attacker_compound=Compound(attacker_compound),
        defender_compound=Compound(defender_compound),
        defender_reaction_laps=defender_reaction_laps,
    )


def simulate_pit_exit(
    context: RaceContext,
    *,
    car: int,
    pit_lap: int,
    neutralisation: str | None,
    rival_stops: dict[int, int],
) -> PitExitPrediction:
    _require_cars(context, [car, *rival_stops])
    if not 2 <= pit_lap <= context.race.total_laps - 1:
        raise StrategyInputError(f"pit_lap must be between 2 and {context.race.total_laps - 1}")
    try:
        return predict_pit_exit(
            context.race,
            car,
            pit_lap,
            _require_pit_loss(context),
            neutralisation=Neutralisation(neutralisation) if neutralisation else None,
            rival_stops=rival_stops or None,
        )
    except ValueError as exc:
        raise StrategyInputError(str(exc)) from exc


@dataclass(frozen=True)
class StrategyOutcome:
    result: WhatIfResult
    points_by_position: dict[int, float]


def simulate_strategy(
    session: Session,
    context: RaceContext,
    *,
    car: int,
    start_compound: str,
    stops: list[dict[str, Any]],
) -> StrategyOutcome:
    """Replay ``car``'s race with another tyre strategy (``stintline_strategy.whatif``).

    The finishing order uses the official classification (race times include time
    penalties); cars without an official time keep their timing.
    """
    _require_cars(context, [car])
    entries = list(session.entries.all())
    results = {
        e.car_number: (e.laps_completed, e.race_time_s)
        for e in entries
        if e.race_time_s is not None and e.laps_completed
    }
    timing = {
        c: (laps[-1].lap, laps[-1].end_time_s)
        for c in context.race.cars
        for laps in [[x for x in context.race.laps_of(c) if x.end_time_s is not None]]
        if laps and laps[-1].end_time_s is not None
    }
    merged = {**timing, **results}
    strategy = Strategy(
        Compound(start_compound),
        tuple((stop["lap"], Compound(stop["compound"])) for stop in stops),
    )
    try:
        result = replay_strategy(
            context.race,
            car,
            strategy,
            context.pace,
            _require_pit_loss(context),
            results=merged,
        )
    except WhatIfError as exc:
        raise StrategyInputError(str(exc)) from exc
    points = {e.finish_position: e.points for e in entries if e.finish_position is not None}
    return StrategyOutcome(result=result, points_by_position=points)


# ------------------------------------------------------------------------- model card

# Python 3.13 dedents docstrings: attribute names sit at 0-4 spaces, continuations deeper.
_ATTRIBUTE = re.compile(r"^\s{0,4}(\w+):\s+(.*)$")


def _attribute_docs(cls: type) -> dict[str, str]:
    """Parse the ``Attributes:`` section of a config dataclass docstring."""
    docs: dict[str, str] = {}
    current: str | None = None
    for line in (cls.__doc__ or "").splitlines():
        match = _ATTRIBUTE.match(line)
        if match:
            current = match.group(1)
            docs[current] = match.group(2).strip()
        elif current and line.strip() and not line.strip().endswith(":"):
            docs[current] += " " + line.strip()
        elif not line.strip():
            current = None
    return docs


CONFIG_CLASSES: tuple[tuple[str, type], ...] = (
    ("Lap cleaning", CleaningConfig),
    ("Fuel", FuelModel),
    ("Degradation", DegradationConfig),
    ("Pit loss", PitLossConfig),
    ("Pit exit", PitExitConfig),
    ("Pit window", WindowConfig),
    ("What-if", WhatIfConfig),
)


@cache
def model_card() -> dict[str, Any]:
    assumptions = []
    for group, cls in CONFIG_CLASSES:
        docs = _attribute_docs(cls)
        instance = cls()
        for f in dataclasses.fields(instance):
            assumptions.append(
                {
                    "group": group,
                    "name": f.name,
                    "value": str(getattr(instance, f.name)),
                    "description": docs.get(f.name, ""),
                }
            )
    backtest = {
        name: json.loads((DATA_DIR / f"backtest-2025-{name}.json").read_text(encoding="utf-8"))
        for name in ("reference", "held-out")
    }
    return {"engine_version": engine_version, "assumptions": assumptions, "backtest": backtest}

"""Undercut / overcut simulator for two cars.

Both cars are simulated lap by lap from the decision point with the race pace model.
Each stop adds the measured pit loss, which already contains the in-lap, the pit lane
and the out-lap warm-up, so the out-lap itself is simulated at the old-tyre pace and new
tyres start contributing from the next lap. The outcome is the gap once both cars have
stopped.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from scipy import stats

from stintline_strategy.domain import Compound
from stintline_strategy.pace import PaceModel
from stintline_strategy.pit_loss import PitLossEstimate


@dataclass(frozen=True, slots=True)
class CarState:
    """A car at the end of the decision lap."""

    car: int
    race_time_s: float
    compound: Compound
    tyre_age: int
    """Tyre age at the start of the next lap."""


@dataclass(frozen=True, slots=True)
class StopPlan:
    car: CarState
    stop_lap: int
    """In-lap of the stop (the first simulated lap is ``decision_lap + 1``)."""
    new_compound: Compound


@dataclass(frozen=True, slots=True)
class ExchangeResult:
    gap_before_s: float
    """Attacker race time minus defender race time at the decision point (> 0 = behind)."""
    gap_after_s: float
    """Same, at the end of the lap after the later stop."""
    net_gain_s: float
    sigma_s: float
    p_attacker_ahead: float
    lap_gaps_s: tuple[tuple[int, float], ...]
    """``(lap, gap)`` after each simulated lap, for charts."""

    @property
    def attacker_ahead(self) -> bool:
        return self.gap_after_s < 0


def _car_time(
    plan: StopPlan,
    decision_lap: int,
    until_lap: int,
    pace: PaceModel,
    pit_loss_s: float,
) -> tuple[list[float], float]:
    """Cumulative race time per lap and the degradation variance accumulated."""
    t = plan.car.race_time_s
    compound, age = plan.car.compound, plan.car.tyre_age
    times, variance = [], 0.0
    for lap in range(decision_lap + 1, until_lap + 1):
        t += pace.lap_time(plan.car.car, compound, age)
        variance += (age * pace.tyres[compound].slope_se_s) ** 2
        if lap == plan.stop_lap:
            t += pit_loss_s
        if lap == plan.stop_lap + 1:
            compound, age = plan.new_compound, 1  # out-lap counted on old pace, see module doc
        else:
            age += 1
        times.append(t)
    return times, variance


def simulate_exchange(
    attacker: StopPlan,
    defender: StopPlan,
    pace: PaceModel,
    pit_loss: PitLossEstimate,
    *,
    extra_laps: int = 1,
) -> ExchangeResult:
    """Simulate both plans from the decision lap (one before the earlier stop)."""
    decision_lap = min(attacker.stop_lap, defender.stop_lap) - 1
    until = max(attacker.stop_lap, defender.stop_lap) + 1 + extra_laps
    loss = pit_loss.green_s
    a_times, a_var = _car_time(attacker, decision_lap, until, pace, loss)
    d_times, d_var = _car_time(defender, decision_lap, until, pace, loss)
    gap_before = attacker.car.race_time_s - defender.car.race_time_s
    gaps = [a - d for a, d in zip(a_times, d_times, strict=True)]
    gap_after = gaps[-1]
    # Two independent pit-loss draws plus propagated degradation-slope uncertainty.
    sigma = math.sqrt(2 * pit_loss.green_sigma_s**2 + a_var + d_var)
    return ExchangeResult(
        gap_before_s=gap_before,
        gap_after_s=gap_after,
        net_gain_s=gap_before - gap_after,
        sigma_s=sigma,
        p_attacker_ahead=float(stats.norm.cdf(-gap_after / sigma))
        if sigma > 0
        else float(gap_after < 0),
        lap_gaps_s=tuple(zip(range(decision_lap + 1, until + 1), gaps, strict=True)),
    )


def undercut(
    attacker: CarState,
    defender: CarState,
    stop_lap: int,
    pace: PaceModel,
    pit_loss: PitLossEstimate,
    *,
    attacker_compound: Compound,
    defender_compound: Compound,
    defender_reaction_laps: int = 1,
) -> ExchangeResult:
    """Attacker pits on ``stop_lap``, defender reacts ``defender_reaction_laps`` later."""
    return simulate_exchange(
        StopPlan(attacker, stop_lap, attacker_compound),
        StopPlan(defender, stop_lap + defender_reaction_laps, defender_compound),
        pace,
        pit_loss,
    )


def overcut(
    attacker: CarState,
    defender: CarState,
    defender_stop_lap: int,
    pace: PaceModel,
    pit_loss: PitLossEstimate,
    *,
    attacker_compound: Compound,
    defender_compound: Compound,
    attacker_extra_laps: int = 3,
) -> ExchangeResult:
    """Defender pits first; attacker stays out ``attacker_extra_laps`` longer."""
    return simulate_exchange(
        StopPlan(attacker, defender_stop_lap + attacker_extra_laps, attacker_compound),
        StopPlan(defender, defender_stop_lap, defender_compound),
        pace,
        pit_loss,
    )

"""What-if: replay a whole race for one car with a different tyre strategy.

The car's real race is kept and only the modelled effect of the change is added, lap by
lap (a counterfactual "delta replay"):

    alt_time(lap) = real_time(lap) + Σ_{k ≤ lap} [tyre delta(k) + stop delta(k)]

- **Tyre delta**: pace on the alternative compound and age minus pace on the real one,
  from the race's pooled tyre models (``pace.TyreModel``). The car offset and fuel are
  identical in both versions and cancel. On neutralised laps (SC, VSC, red flag) every
  car runs the imposed delta, so the tyre delta is zero.
- **Stop delta**: each alternative stop adds the measured pit loss for the conditions of
  that lap (``PitLossEstimate.under``), each real stop that disappears removes it. The
  loss already includes the in-lap and out-lap effect (see ``pit_loss``).

Everything else stays as it happened: the other cars, their stops, safety cars, the
car's own traffic and mistakes. The other cars do not react to the new strategy and
overtaking on track costs nothing (both stated as limitations in ``docs/model.md``).

Uncertainty combines the pit-loss spread of every added or removed stop with the
uncertainty of the degradation slopes. A slope error applies to every lap on that
compound, so it scales with the total tyre age run on it (correlated, not per lap).
"""

from __future__ import annotations

import math
from bisect import bisect_left
from dataclasses import dataclass, field
from enum import StrEnum

from scipy import stats

from stintline_strategy.domain import Compound, Race
from stintline_strategy.pace import PaceModel
from stintline_strategy.pit_loss import PitLossEstimate


@dataclass(frozen=True, slots=True)
class WhatIfConfig:
    """Attributes:
    min_stint_laps: shorter stints are rejected (a stop every few laps is never a plan).
    long_stint_margin_laps: a stint longer than the longest stint run on that compound in
        this race, plus this margin, gets a warning: linear wear is extrapolated beyond
        what was observed, and real tyres may fall off a cliff before that.
    require_two_dry_compounds: dry-race rule (two different dry compounds must be used).
    """

    min_stint_laps: int = 3
    long_stint_margin_laps: int = 3
    require_two_dry_compounds: bool = True


class StrategyWarning(StrEnum):
    TWO_COMPOUND_RULE = "two_compound_rule"
    """A dry race run on a single compound: not allowed by the sporting regulations."""
    LONG_STINT = "long_stint"
    """A stint longer than any observed on that compound in this race."""


@dataclass(frozen=True, slots=True)
class Strategy:
    start_compound: Compound
    stops: tuple[tuple[int, Compound], ...] = ()
    """``(in-lap, compound fitted)``, in lap order. New tyres from the next lap."""


@dataclass(frozen=True, slots=True)
class TyreLap:
    compound: Compound
    age: int
    """Laps already run on the set when the lap starts."""


@dataclass(frozen=True, slots=True)
class WhatIfResult:
    car: int
    strategy: Strategy
    real_strategy: Strategy
    line_times_s: tuple[float, ...]
    """Alternative race time at the end of each lap (index = lap - 1)."""
    tyres: tuple[TyreLap, ...]
    """Alternative compound and age on each lap."""
    deltas_s: tuple[float, ...]
    """Cumulative time gained (< 0) or lost (> 0) against the real race, per lap."""
    real_time_s: float
    """Official race time (with penalties) of the real race."""
    final_time_s: float
    sigma_s: float
    laps: int
    real_position: int
    position: int
    """Most likely finishing position."""
    position_probabilities: dict[int, float]
    """Finishing position -> probability (only positions above 1 %)."""
    warnings: tuple[StrategyWarning, ...] = field(default=())

    @property
    def gain_s(self) -> float:
        return self.real_time_s - self.final_time_s


class WhatIfError(ValueError):
    """The strategy cannot be simulated for this car in this race."""


def real_strategy(race: Race, car: int) -> tuple[Strategy, list[TyreLap]]:
    """The strategy the car actually ran, and its compound and age on every lap.

    Uses the same convention as the alternative (new set from the lap after the in-lap),
    so the two schedules are compared like for like.
    """
    laps = race.laps_of(car)
    if not laps:
        raise WhatIfError(f"car {car} has no laps in this race")
    first = laps[0]
    stops: list[tuple[int, Compound]] = []
    by_lap = {lap.lap: lap for lap in laps}
    for lap in laps:
        nxt = by_lap.get(lap.lap + 1)
        if lap.is_pit_in and nxt is not None:
            stops.append((lap.lap, nxt.compound))
    strategy = Strategy(first.compound, tuple(stops))
    return strategy, schedule(strategy, len(laps), first.tyre_age or 0)


def schedule(strategy: Strategy, laps: int, start_age: int = 0) -> list[TyreLap]:
    """Compound and tyre age on each lap of a strategy."""
    out: list[TyreLap] = []
    stops = dict(strategy.stops)
    compound, age = strategy.start_compound, start_age
    for lap in range(1, laps + 1):
        out.append(TyreLap(compound, age))
        if lap in stops:
            compound, age = stops[lap], 0
        else:
            age += 1
    return out


def _validate(strategy: Strategy, laps: int, pace: PaceModel, config: WhatIfConfig) -> None:
    previous = 0
    for lap, compound in strategy.stops:
        if not 1 <= lap < laps:
            raise WhatIfError(f"stop lap {lap} is outside the race (1-{laps - 1})")
        if lap - previous < config.min_stint_laps:
            raise WhatIfError(f"stints must last at least {config.min_stint_laps} laps")
        if compound not in pace.tyres:
            raise WhatIfError(f"no tyre model for {compound} in this race")
        previous = lap
    if laps - previous < config.min_stint_laps:
        raise WhatIfError(f"stints must last at least {config.min_stint_laps} laps")
    if strategy.start_compound not in pace.tyres:
        raise WhatIfError(f"no tyre model for {strategy.start_compound} in this race")


def _warnings(
    race: Race, strategy: Strategy, tyres: list[TyreLap], config: WhatIfConfig
) -> tuple[StrategyWarning, ...]:
    out: list[StrategyWarning] = []
    used = {t.compound for t in tyres}
    if config.require_two_dry_compounds and all(c.is_dry for c in used) and len(used) < 2:
        out.append(StrategyWarning.TWO_COMPOUND_RULE)
    longest: dict[Compound, int] = {}
    for lap in race.laps:
        if lap.tyre_age is not None:
            longest[lap.compound] = max(longest.get(lap.compound, 0), lap.tyre_age + 1)
    for tyre in tyres:
        if tyre.age + 1 > longest.get(tyre.compound, 0) + config.long_stint_margin_laps:
            out.append(StrategyWarning.LONG_STINT)
            break
    return tuple(out)


Result = tuple[int, float]
"""``(laps completed, race time)`` of one car."""


def timing_results(race: Race) -> dict[int, Result]:
    """Results read from the timing: last lap completed and race time at that line."""
    out: dict[int, Result] = {}
    for car in race.cars:
        timed = [lap for lap in race.laps_of(car) if lap.end_time_s is not None]
        if timed:
            out[car] = (timed[-1].lap, timed[-1].end_time_s or 0.0)
    return out


def _positions(rivals: list[Result], laps: int, time: float, sigma: float) -> dict[int, float]:
    """Probability of each finishing position for a car finishing ``laps`` laps in a time
    ~ N(``time``, ``sigma``) against fixed rival results."""
    ahead = sum(1 for n, _ in rivals if n > laps)
    same = sorted(t for n, t in rivals if n == laps)
    if sigma <= 0:
        return {ahead + bisect_left(same, time) + 1: 1.0}
    edges = [-math.inf, *same, math.inf]
    out: dict[int, float] = {}
    for i in range(len(edges) - 1):
        low = stats.norm.cdf((edges[i] - time) / sigma)
        high = stats.norm.cdf((edges[i + 1] - time) / sigma)
        p = float(high - low)
        if p > 0:
            out[ahead + i + 1] = p
    return out


MIN_REPORTED_PROBABILITY = 0.01


def replay_strategy(
    race: Race,
    car: int,
    strategy: Strategy,
    pace: PaceModel,
    pit_loss: PitLossEstimate,
    *,
    config: WhatIfConfig | None = None,
    results: dict[int, Result] | None = None,
) -> WhatIfResult:
    """Replay ``car``'s race with ``strategy`` instead of the one it ran.

    ``results`` are the official ``(laps, race time)`` of each car, which include time
    penalties; the finishing order is computed from them. Default: the timing.
    """
    config = config or WhatIfConfig()
    results = results or timing_results(race)
    laps = [lap for lap in race.laps_of(car) if lap.end_time_s is not None]
    if not laps or laps[-1].lap != len(laps):
        raise WhatIfError(f"car {car} has gaps in its timing: cannot replay it")
    n = len(laps)
    real, real_tyres = real_strategy(race, car)
    for tyre in real_tyres:
        if tyre.compound not in pace.tyres:
            raise WhatIfError(f"no tyre model for the {tyre.compound} tyres car {car} ran")
    _validate(strategy, n, pace, config)
    alt_tyres = schedule(
        strategy, n, real_tyres[0].age if strategy.start_compound == real.start_compound else 0
    )

    real_stops, alt_stops = dict(real.stops), dict(strategy.stops)
    total, line, deltas = 0.0, [], []
    pit_variance = 0.0
    age_sums: dict[Compound, float] = {}
    for lap, tyre_real, tyre_alt in zip(laps, real_tyres, alt_tyres, strict=True):
        neutralised = race.neutralised(lap.lap)
        if neutralised is None:
            total += pace.tyres[tyre_alt.compound].lap_time(tyre_alt.age)
            total -= pace.tyres[tyre_real.compound].lap_time(tyre_real.age)
            age_sums[tyre_alt.compound] = age_sums.get(tyre_alt.compound, 0.0) + tyre_alt.age
            age_sums[tyre_real.compound] = age_sums.get(tyre_real.compound, 0.0) - tyre_real.age
        added, removed = lap.lap in alt_stops, lap.lap in real_stops
        if added != removed:
            loss = pit_loss.under(neutralised)
            total += loss if added else -loss
            pit_variance += pit_loss.green_sigma_s**2
        deltas.append(total)
        line.append((lap.end_time_s or 0.0) + total)

    slope_variance = sum(
        (pace.tyres[c].slope_se_s * age_sum) ** 2 for c, age_sum in age_sums.items()
    )
    sigma = math.sqrt(pit_variance + slope_variance)
    rivals = [result for other, result in results.items() if other != car]
    real_laps, real_time = results.get(car, (n, laps[-1].end_time_s or 0.0))
    if real_laps != n:
        raise WhatIfError(f"car {car} has no official time over its {n} timed laps")
    final_time = real_time + total
    probabilities = _positions(rivals, n, final_time, sigma)
    position = max(probabilities, key=lambda p: probabilities[p])
    real_position = next(iter(_positions(rivals, n, real_time, 0.0)))
    return WhatIfResult(
        car=car,
        strategy=strategy,
        real_strategy=real,
        line_times_s=tuple(line),
        tyres=tuple(alt_tyres),
        deltas_s=tuple(deltas),
        real_time_s=real_time,
        final_time_s=final_time,
        sigma_s=sigma,
        laps=n,
        real_position=real_position,
        position=position,
        position_probabilities={
            p: v for p, v in probabilities.items() if v >= MIN_REPORTED_PROBABILITY
        },
        warnings=_warnings(race, strategy, alt_tyres, config),
    )

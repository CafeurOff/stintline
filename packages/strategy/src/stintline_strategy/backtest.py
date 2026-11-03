"""Backtest of pit-exit predictions against what actually happened.

For every measurable green-flag stop, the pit loss is estimated from the *other* stops of
the same race (leave-one-out), the rejoin position is predicted from the gaps at the
decision point, and compared with the observed position at the end of the out-lap.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from statistics import mean

from stintline_strategy.domain import Race
from stintline_strategy.pit_exit import (
    PitExitConfig,
    PitExitPrediction,
    actual_position_after_stop,
    predict_pit_exit,
    race_order_at,
)
from stintline_strategy.pit_loss import PitLossConfig, estimate_pit_loss


@dataclass(frozen=True, slots=True)
class BacktestCase:
    race: str
    car: int
    pit_lap: int
    prediction: PitExitPrediction
    actual_position: int

    @property
    def error(self) -> int:
        return self.prediction.most_likely_position - self.actual_position

    @property
    def baseline_error(self) -> int:
        """Naive baseline: the car keeps the position it had before stopping."""
        return self.prediction.position_before - self.actual_position

    @property
    def in_interval(self) -> bool:
        lo, hi = self.prediction.interval
        return lo <= self.actual_position <= hi


@dataclass(frozen=True, slots=True)
class Metrics:
    n: int
    mae: float
    mae_expected: float
    exact_rate: float
    within_one_rate: float
    interval_coverage: float
    baseline_mae: float

    @classmethod
    def of(cls, cases: list[BacktestCase]) -> Metrics:
        if not cases:
            raise ValueError("no backtest cases")
        return cls(
            n=len(cases),
            mae=mean(abs(c.error) for c in cases),
            mae_expected=mean(
                abs(c.prediction.expected_position - c.actual_position) for c in cases
            ),
            exact_rate=mean(c.error == 0 for c in cases),
            within_one_rate=mean(abs(c.error) <= 1 for c in cases),
            interval_coverage=mean(c.in_interval for c in cases),
            baseline_mae=mean(abs(c.baseline_error) for c in cases),
        )


@dataclass(frozen=True, slots=True)
class BacktestReport:
    cases: tuple[BacktestCase, ...]
    overall: Metrics
    per_race: dict[str, Metrics] = field(default_factory=dict)
    skipped: tuple[str, ...] = ()


def backtest_pit_exits(
    races: list[Race],
    *,
    pit_loss_config: PitLossConfig | None = None,
    exit_config: PitExitConfig | None = None,
    known_rival_stops: bool = False,
) -> BacktestReport:
    """``known_rival_stops=False`` (blind): rivals are assumed to stay out, which is all
    a strategist knows for certain. ``True`` (scenario): rival stops within one lap of
    ours are given to the model, which isolates the model's own error from unknowable
    rival decisions."""
    cases: list[BacktestCase] = []
    skipped: list[str] = []
    for race in races:
        for stop in race.pit_stops:
            reason = _skip_reason(race, stop.car, stop.lap)
            if reason:
                skipped.append(f"{race.name} car {stop.car} lap {stop.lap}: {reason}")
                continue
            try:
                loss = estimate_pit_loss(race, pit_loss_config, exclude={(stop.car, stop.lap)})
            except ValueError:
                skipped.append(f"{race.name}: not enough other stops to estimate pit loss")
                continue
            actual = actual_position_after_stop(race, stop.car, stop.lap)
            if actual is None:
                skipped.append(f"{race.name} car {stop.car} lap {stop.lap}: no out-lap position")
                continue
            rivals = (
                {
                    s.car: s.lap
                    for s in race.pit_stops
                    if s.car != stop.car and abs(s.lap - stop.lap) <= 1
                }
                if known_rival_stops
                else None
            )
            prediction = predict_pit_exit(
                race, stop.car, stop.lap, loss, rival_stops=rivals, config=exit_config
            )
            cases.append(BacktestCase(race.name, stop.car, stop.lap, prediction, actual))
    names = sorted({c.race for c in cases})
    return BacktestReport(
        cases=tuple(cases),
        overall=Metrics.of(cases),
        per_race={n: Metrics.of([c for c in cases if c.race == n]) for n in names},
        skipped=tuple(skipped),
    )


def _skip_reason(race: Race, car: int, lap: int) -> str | None:
    if lap < 2:
        return "stop on the first lap"
    if lap >= race.total_laps:
        return "stop on the final lap"
    if race.neutralised(lap) or race.neutralised(lap + 1) or race.neutralised(lap - 1):
        return "neutralised (gaps are not representative)"
    if car not in dict(race_order_at(race, lap - 1)):
        return "no position at the decision point"
    return None

"""Where does a car rejoin if it pits now?

At the end of lap ``L - 1`` (decision point), the car's gap to every car on the same lap
is known. Pitting on lap ``L`` costs the pit loss over the in-lap and out-lap. The car
rejoins ahead of a rival when the gap to that rival exceeds the loss. Uncertainty in the
loss and in the gap's evolution over the two laps is Gaussian, so each rival is
"ahead after the stop" with probability ``Φ(margin / σ)``. The rejoin position follows a
Poisson-binomial distribution, computed exactly.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from scipy import stats

from stintline_strategy.domain import Neutralisation, Race
from stintline_strategy.pit_loss import PitLossEstimate


@dataclass(frozen=True, slots=True)
class PitExitConfig:
    """Attributes:
    gap_noise_s_per_lap: standard deviation of the change in gap between two cars over
        one lap around a stop. Pure green-flag pace noise is ~0.4 s, but in/out-lap
        traffic and the split of a rival's pit loss between laps add variance. 1.5 s was
        calibrated on the reference races (Bahrain, Hungary, Italy 2025) to bring the 90 %
        interval coverage to 87 % (vs 76 % at 0.4 s) without hurting MAE. It holds
        out-of-sample (86 % on the held-out races), see docs/model.md.
    interval: probability mass of the reported position interval.
    """

    gap_noise_s_per_lap: float = 1.5
    interval: float = 0.9


@dataclass(frozen=True, slots=True)
class RivalOutcome:
    car: int
    gap_s: float
    """Rival's race time minus the pitting car's, before the stop (positive = behind)."""
    margin_s: float
    """``gap_s - pit_loss``: positive means the pitting car should stay ahead."""
    p_pitting_car_ahead: float


@dataclass(frozen=True, slots=True)
class PitExitPrediction:
    car: int
    pit_lap: int
    pit_loss_s: float
    sigma_s: float
    position_before: int
    expected_position: float
    most_likely_position: int
    interval: tuple[int, int]
    distribution: tuple[float, ...]
    """``distribution[k]`` = P(rejoin position == k + 1)."""
    rivals: tuple[RivalOutcome, ...]


def race_order_at(race: Race, lap: int) -> list[tuple[int, float]]:
    """Cars that completed ``lap``, as ``(car, race_time)`` sorted by race time."""
    order = [
        (lap_.car, lap_.end_time_s)
        for lap_ in race.laps
        if lap_.lap == lap and lap_.end_time_s is not None
    ]
    return sorted(order, key=lambda x: x[1])


def predict_pit_exit(
    race: Race,
    car: int,
    pit_lap: int,
    pit_loss: PitLossEstimate,
    *,
    neutralisation: Neutralisation | None = None,
    rival_stops: dict[int, int] | None = None,
    config: PitExitConfig | None = None,
) -> PitExitPrediction:
    """Predict the rejoin position of ``car`` pitting on ``pit_lap`` (in-lap).

    ``neutralisation`` uses the reduced pit loss under SC or VSC. Gaps are taken as they
    were at the decision point, so field compression behind a Safety Car is not modelled
    (documented limitation).

    ``rival_stops`` (scenario mode) maps rival car numbers to the in-lap of a stop they
    make around ours. A rival stopping on ``pit_lap`` or ``pit_lap + 1`` also loses the
    full pit loss. One that stopped on the decision lap still has its out-lap to run, so
    it loses half of it (the in-lap share is already in the gap).
    """
    config = config or PitExitConfig()
    decision_lap = pit_lap - 1
    order = race_order_at(race, decision_lap)
    times = dict(order)
    if car not in times:
        raise ValueError(f"car {car} did not complete lap {decision_lap}")
    loss = pit_loss.under(neutralisation)
    sigma = math.sqrt(pit_loss.green_sigma_s**2 + 2 * config.gap_noise_s_per_lap**2)

    rivals = []
    for rival, rival_time in order:
        if rival == car:
            continue
        gap = rival_time - times[car] + _rival_stop_cost(rival_stops, rival, pit_lap, loss)
        margin = gap - loss
        rivals.append(RivalOutcome(rival, gap, margin, float(stats.norm.cdf(margin / sigma))))

    # Poisson-binomial: number of rivals ahead after the stop.
    dist = np.array([1.0])
    for r in rivals:
        p_ahead_of_us = 1.0 - r.p_pitting_car_ahead
        dist = np.convolve(dist, [1.0 - p_ahead_of_us, p_ahead_of_us])
    cdf = np.cumsum(dist)
    tail = (1.0 - config.interval) / 2
    lo = int(np.searchsorted(cdf, tail)) + 1
    hi = int(np.searchsorted(cdf, 1.0 - tail)) + 1
    return PitExitPrediction(
        car=car,
        pit_lap=pit_lap,
        pit_loss_s=loss,
        sigma_s=sigma,
        position_before=[c for c, _ in order].index(car) + 1,
        expected_position=float(np.dot(np.arange(1, len(dist) + 1), dist)),
        most_likely_position=int(np.argmax(dist)) + 1,
        interval=(lo, hi),
        distribution=tuple(float(p) for p in dist),
        rivals=tuple(sorted(rivals, key=lambda r: r.margin_s)),
    )


RIVAL_STOP_SHARE_AFTER_DECISION = 0.5
"""Share of a rival's pit loss still to come when it pitted on the decision lap."""


def _rival_stop_cost(stops: dict[int, int] | None, rival: int, pit_lap: int, loss: float) -> float:
    lap = (stops or {}).get(rival)
    if lap is None:
        return 0.0
    if lap in (pit_lap, pit_lap + 1):
        return loss
    if lap == pit_lap - 1:
        return RIVAL_STOP_SHARE_AFTER_DECISION * loss
    return 0.0


def actual_position_after_stop(race: Race, car: int, pit_lap: int) -> int | None:
    """Observed position at the end of the out-lap (``pit_lap + 1``)."""
    order = [c for c, _ in race_order_at(race, pit_lap + 1)]
    return order.index(car) + 1 if car in order else None

"""Lap cleaning: which laps represent a car's true pace on its tyres.

Every lap gets either ``None`` (kept) or an :class:`Exclusion` reason, so the UI can show
why a point is greyed out and the cleaning stays auditable.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

import numpy as np

from stintline_strategy.domain import Lap, Race, group_by_stint

MAD_TO_SIGMA = 1.4826
"""Scale factor making the median absolute deviation a consistent estimator of the
standard deviation for normally distributed data."""


class Exclusion(StrEnum):
    MISSING_TIME = "missing_time"
    FIRST_LAP = "first_lap"
    PIT_IN = "pit_in"
    PIT_OUT = "pit_out"
    NEUTRALISED = "neutralised"
    RESTART = "restart"
    OUTLIER = "outlier"


@dataclass(frozen=True, slots=True)
class CleaningConfig:
    """Lap filtering assumptions.

    Attributes:
        exclude_first_lap: lap 1 includes the standing start and first-lap traffic.
        restart_buffer_laps: laps excluded after a neutralised period ends. Tyres and
            brakes are cold and the field is bunched at a restart.
        outlier_k: a lap is an outlier when its residual from the stint's rolling median
            exceeds ``outlier_k`` robust standard deviations (MAD times 1.4826). k = 3 keeps
            about 99.7 % of laps under normal noise and drops traffic, mistakes and blue flags.
        outlier_min_sigma_s: floor for the robust sigma, so a perfectly consistent stint
            does not flag normal 0.1 s noise.
        min_laps_for_outliers: below this many candidate laps the trend is too uncertain
            to reject anything.
        rolling_window_laps: width of the centred rolling median used as the local pace.
            Five laps follow degradation closely while a single bad lap cannot move the
            median.
    """

    exclude_first_lap: bool = True
    restart_buffer_laps: int = 1
    outlier_k: float = 3.0
    outlier_min_sigma_s: float = 0.15
    min_laps_for_outliers: int = 5
    rolling_window_laps: int = 5


@dataclass(frozen=True, slots=True)
class CleanLap:
    lap: Lap
    excluded: Exclusion | None

    @property
    def kept(self) -> bool:
        return self.excluded is None


def _structural_reason(lap: Lap, race: Race, config: CleaningConfig) -> Exclusion | None:
    """First matching rule wins, in order of how unrepresentative the lap is."""
    rules: tuple[tuple[bool, Exclusion], ...] = (
        (lap.time_s is None, Exclusion.MISSING_TIME),
        (config.exclude_first_lap and lap.lap == 1, Exclusion.FIRST_LAP),
        (lap.is_pit_in, Exclusion.PIT_IN),
        (lap.is_pit_out, Exclusion.PIT_OUT),
        (race.neutralised(lap.lap) is not None, Exclusion.NEUTRALISED),
        (_after_restart(lap.lap, race, config.restart_buffer_laps), Exclusion.RESTART),
    )
    return next((reason for matched, reason in rules if matched), None)


def _after_restart(lap: int, race: Race, buffer_laps: int) -> bool:
    return any(
        p.lap_end is not None and 0 < lap - p.lap_end <= buffer_laps for p in race.neutralisations
    )


def clean_laps(race: Race, config: CleaningConfig | None = None) -> list[CleanLap]:
    """Label every lap of ``race`` as kept or excluded (with the reason)."""
    config = config or CleaningConfig()
    labelled = {(lap.car, lap.lap): _structural_reason(lap, race, config) for lap in race.laps}

    for stint_laps in group_by_stint(race.laps).values():
        candidates = [lap for lap in stint_laps if labelled[(lap.car, lap.lap)] is None]
        for lap in _outliers(candidates, config):
            labelled[(lap.car, lap.lap)] = Exclusion.OUTLIER

    return [
        CleanLap(lap, labelled[(lap.car, lap.lap)])
        for lap in sorted(race.laps, key=lambda x: (x.car, x.lap))
    ]


def _outliers(laps: list[Lap], config: CleaningConfig) -> list[Lap]:
    """Residuals from a centred rolling median (robust to both outliers and curvature,
    unlike a straight-line trend which flags the ends of a curved stint), then a MAD
    threshold."""
    if len(laps) < config.min_laps_for_outliers:
        return []
    y = np.array([lap.time_s for lap in laps], dtype=float)
    half = config.rolling_window_laps // 2
    trend = np.array([np.median(y[max(0, i - half) : i + half + 1]) for i in range(len(y))])
    residuals = y - trend
    mad = float(np.median(np.abs(residuals - np.median(residuals))))
    sigma = max(MAD_TO_SIGMA * mad, config.outlier_min_sigma_s)
    return [
        lap for lap, r in zip(laps, residuals, strict=True) if abs(r) > config.outlier_k * sigma
    ]


def kept_laps(race: Race, config: CleaningConfig | None = None) -> list[Lap]:
    return [c.lap for c in clean_laps(race, config) if c.kept]

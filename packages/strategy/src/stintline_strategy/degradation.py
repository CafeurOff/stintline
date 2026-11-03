"""Tyre degradation models.

Per stint: fuel-corrected lap time regressed on tyre age, linear by default and
quadratic only when the data clearly supports curvature (AIC). Per compound: a pooled
slope estimated *within* stints, so differences in driver or car pace (each stint's own
intercept) do not bias the degradation rate.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

import numpy as np
from numpy.typing import NDArray
from scipy import stats

from stintline_strategy.domain import Compound, Lap, Race, group_by_stint
from stintline_strategy.fuel import FuelModel
from stintline_strategy.laps import CleaningConfig, kept_laps

FloatArray = NDArray[np.float64]


class ModelKind(StrEnum):
    LINEAR = "linear"
    QUADRATIC = "quadratic"


@dataclass(frozen=True, slots=True)
class DegradationConfig:
    """Fitting assumptions.

    Attributes:
        min_laps: clean laps needed to fit a stint. Fewer laps give unstable slopes.
        min_laps_quadratic: clean laps needed before a quadratic term is considered.
        quadratic_aic_margin: the quadratic model must lower AIC by at least this much.
            A difference of 2 is the usual threshold for meaningful support
            (Burnham & Anderson).
        min_curvature_effect_s: the curvature must also matter in practice. The parabola
            must depart from its chord by at least this much at mid-stint
            (``|c2| · (range/2)²``). AIC alone selected a quadratic on ~7 % of purely
            linear simulated stints. With this guard the rate drops to 0-1 % while real
            curvature is still detected (see docs/model.md).
        confidence: level of the reported confidence intervals.
    """

    min_laps: int = 5
    min_laps_quadratic: int = 10
    quadratic_aic_margin: float = 2.0
    min_curvature_effect_s: float = 0.15
    confidence: float = 0.95


@dataclass(frozen=True, slots=True)
class _OLS:
    coef: FloatArray
    cov: FloatArray
    rss: float
    n: int

    @property
    def k(self) -> int:
        return len(self.coef)

    @property
    def aic(self) -> float:
        rss = max(self.rss, 1e-12)
        return self.n * math.log(rss / self.n) + 2 * self.k


def _ols(design: FloatArray, y: FloatArray) -> _OLS:
    coef, *_ = np.linalg.lstsq(design, y, rcond=None)
    residuals = y - design @ coef
    rss = float(residuals @ residuals)
    dof = max(len(y) - design.shape[1], 1)
    sigma2 = rss / dof
    cov = sigma2 * np.linalg.pinv(design.T @ design)
    return _OLS(coef=coef, cov=cov, rss=rss, n=len(y))


def _t_quantile(confidence: float, dof: int) -> float:
    return float(stats.t.ppf(0.5 + confidence / 2, max(dof, 1)))


@dataclass(frozen=True, slots=True)
class DegradationFit:
    """Degradation of one stint. ``coefficients`` are ``(c0, c1[, c2])`` for
    ``time = c0 + c1·age (+ c2·age²)`` in fuel-corrected seconds."""

    car: int
    stint: int
    compound: Compound
    model: ModelKind
    coefficients: tuple[float, ...]
    slope_s_per_lap: float
    """Degradation rate at the stint's mean tyre age (s/lap)."""
    slope_ci: tuple[float, float]
    r_squared: float
    rmse_s: float
    n_laps: int
    ages: tuple[int, ...]
    corrected_times_s: tuple[float, ...]

    def predict(self, age: float) -> float:
        return float(sum(c * age**i for i, c in enumerate(self.coefficients)))


def fit_stint(
    car: int,
    stint: int,
    compound: Compound,
    points: Sequence[tuple[int, float]],
    config: DegradationConfig | None = None,
) -> DegradationFit | None:
    """Fit ``(tyre_age, corrected_time)`` points. ``None`` when there are too few laps."""
    config = config or DegradationConfig()
    if len(points) < config.min_laps:
        return None
    ages = np.array([p[0] for p in points], dtype=float)
    y = np.array([p[1] for p in points], dtype=float)
    if np.ptp(ages) == 0:
        return None

    linear = _ols(np.column_stack([np.ones_like(ages), ages]), y)
    chosen, kind = linear, ModelKind.LINEAR
    if len(points) >= config.min_laps_quadratic:
        quadratic = _ols(np.column_stack([np.ones_like(ages), ages, ages**2]), y)
        curvature_effect = abs(float(quadratic.coef[2])) * (float(np.ptp(ages)) / 2) ** 2
        if (
            quadratic.aic <= linear.aic - config.quadratic_aic_margin
            and curvature_effect >= config.min_curvature_effect_s
        ):
            chosen, kind = quadratic, ModelKind.QUADRATIC

    mean_age = float(ages.mean())
    if kind is ModelKind.LINEAR:
        slope = float(chosen.coef[1])
        slope_var = float(chosen.cov[1, 1])
    else:
        gradient = np.array([0.0, 1.0, 2 * mean_age])
        slope = float(gradient @ chosen.coef)
        slope_var = float(gradient @ chosen.cov @ gradient)
    half_width = _t_quantile(config.confidence, chosen.n - chosen.k) * math.sqrt(
        max(slope_var, 0.0)
    )
    tss = float(((y - y.mean()) ** 2).sum())
    return DegradationFit(
        car=car,
        stint=stint,
        compound=compound,
        model=kind,
        coefficients=tuple(float(c) for c in chosen.coef),
        slope_s_per_lap=slope,
        slope_ci=(slope - half_width, slope + half_width),
        r_squared=1.0 - chosen.rss / tss if tss > 0 else 0.0,
        rmse_s=math.sqrt(chosen.rss / chosen.n),
        n_laps=chosen.n,
        ages=tuple(int(a) for a in ages),
        corrected_times_s=tuple(float(v) for v in y),
    )


def corrected_points(
    laps: Sequence[Lap], fuel: FuelModel, total_laps: int
) -> list[tuple[int, float]]:
    """``(tyre_age, fuel-corrected time)`` for laps with a time and a known tyre age."""
    return [
        (lap.tyre_age, fuel.correct(lap.time_s, lap.lap, total_laps))
        for lap in laps
        if lap.time_s is not None and lap.tyre_age is not None
    ]


def stint_degradation(
    race: Race,
    *,
    fuel: FuelModel | None = None,
    cleaning: CleaningConfig | None = None,
    config: DegradationConfig | None = None,
) -> list[DegradationFit]:
    """One fit per stint with enough clean laps, ordered by car then stint."""
    fuel = fuel or FuelModel()
    fits: list[DegradationFit] = []
    for (car, stint), laps in sorted(group_by_stint(kept_laps(race, cleaning)).items()):
        compound = laps[0].compound
        fit = fit_stint(car, stint, compound, corrected_points(laps, fuel, race.total_laps), config)
        if fit is not None:
            fits.append(fit)
    return fits


@dataclass(frozen=True, slots=True)
class CompoundDegradation:
    """Pooled linear degradation of one compound across the field."""

    compound: Compound
    slope_s_per_lap: float
    slope_ci: tuple[float, float]
    n_laps: int
    n_stints: int
    new_tyre_pace_s: float
    """Median fuel-corrected pace at age 0 across stints (used for compound offsets)."""


def compound_degradation(
    race: Race,
    *,
    fuel: FuelModel | None = None,
    cleaning: CleaningConfig | None = None,
    config: DegradationConfig | None = None,
) -> dict[Compound, CompoundDegradation]:
    """Within-stint (fixed-effects) estimate: each stint is centred on its own mean, so
    the slope reflects tyre wear only, not who was faster."""
    fuel = fuel or FuelModel()
    config = config or DegradationConfig()
    by_compound: dict[Compound, list[list[tuple[int, float]]]] = {}
    for laps in group_by_stint(kept_laps(race, cleaning)).values():
        points = corrected_points(laps, fuel, race.total_laps)
        if len(points) >= config.min_laps and len({a for a, _ in points}) > 1:
            by_compound.setdefault(laps[0].compound, []).append(points)

    result: dict[Compound, CompoundDegradation] = {}
    for compound, stints in by_compound.items():
        x_parts, y_parts, intercepts = [], [], []
        for points in stints:
            ages = np.array([a for a, _ in points], dtype=float)
            times = np.array([t for _, t in points], dtype=float)
            x_parts.append(ages - ages.mean())
            y_parts.append(times - times.mean())
            slope_i = float(np.polyfit(ages, times, 1)[0])
            intercepts.append(float(times.mean() - slope_i * ages.mean()))
        x, y = np.concatenate(x_parts), np.concatenate(y_parts)
        sxx = float(x @ x)
        slope = float(x @ y) / sxx
        dof = len(x) - 1 - len(stints)
        residuals = y - slope * x
        se = math.sqrt(float(residuals @ residuals) / max(dof, 1) / sxx)
        half = _t_quantile(config.confidence, dof) * se
        result[compound] = CompoundDegradation(
            compound=compound,
            slope_s_per_lap=slope,
            slope_ci=(slope - half, slope + half),
            n_laps=len(x),
            n_stints=len(stints),
            new_tyre_pace_s=float(np.median(intercepts)),
        )
    return result

import numpy as np
import pytest

from stintline_strategy.degradation import (
    DegradationConfig,
    ModelKind,
    compound_degradation,
    fit_stint,
    stint_degradation,
)
from stintline_strategy.domain import Compound
from stintline_strategy.synthetic import CarSpec, RaceSpec, make_race


def test_stint_fits_recover_the_true_slope_within_the_interval() -> None:
    race = make_race(RaceSpec(cars={1: CarSpec(), 2: CarSpec(offset_s=0.4)}, noise_s=0.08, seed=3))

    fits = stint_degradation(race)

    assert {(f.car, f.stint) for f in fits} == {(1, 1), (1, 2), (2, 1), (2, 2)}
    for fit in fits:
        true_slope = {Compound.MEDIUM: 0.07, Compound.HARD: 0.04}[fit.compound]
        assert fit.model is ModelKind.LINEAR
        assert fit.slope_ci[0] <= true_slope <= fit.slope_ci[1]
        assert fit.rmse_s < 0.15
        assert fit.predict(0) == pytest.approx(fit.coefficients[0])


def test_quadratic_is_selected_only_with_clear_curvature() -> None:
    curved = make_race(
        RaceSpec(cars={1: CarSpec(stops=())}, quadratic={Compound.MEDIUM: 0.004}, noise_s=0.05)
    )
    straight = make_race(RaceSpec(cars={1: CarSpec(stops=())}, noise_s=0.05))

    curved_fit = stint_degradation(curved)[0]
    straight_fit = stint_degradation(straight)[0]

    assert curved_fit.model is ModelKind.QUADRATIC
    assert len(curved_fit.coefficients) == 3
    assert straight_fit.model is ModelKind.LINEAR
    assert curved_fit.n_laps == 49  # the stint ends are not mistaken for outliers


@pytest.mark.parametrize(
    ("curvature", "expected_model"), [(0.0, ModelKind.LINEAR), (0.004, ModelKind.QUADRATIC)]
)
def test_slope_confidence_intervals_are_calibrated(
    curvature: float, expected_model: ModelKind
) -> None:
    """Over many simulated stints, the 95 % interval contains the true slope ~95 % of the time."""
    rng = np.random.default_rng(42)
    ages = np.arange(1, 31, dtype=float)
    hits, models = 0, []
    for _ in range(200):
        times = 90 + 0.07 * ages + curvature * ages**2 + rng.normal(0, 0.1, ages.size)
        fit = fit_stint(
            1, 1, Compound.MEDIUM, list(zip(ages.astype(int).tolist(), times.tolist(), strict=True))
        )
        assert fit is not None
        true_slope = (
            0.07 + 2 * curvature * float(np.mean(ages))
            if fit.model is ModelKind.QUADRATIC
            else 0.07 + curvature * 31
        )
        hits += fit.slope_ci[0] <= true_slope <= fit.slope_ci[1]
        models.append(fit.model)
    assert 0.90 <= hits / 200 <= 0.99
    assert models.count(expected_model) >= 190


def test_fit_stint_needs_enough_distinct_laps() -> None:
    assert fit_stint(1, 1, Compound.SOFT, [(1, 90.0)] * 3) is None
    assert fit_stint(1, 1, Compound.SOFT, [(4, 90.0)] * 6) is None
    flat = fit_stint(
        1, 1, Compound.SOFT, [(a, 90.0) for a in range(6)], DegradationConfig(min_laps=5)
    )
    assert flat is not None
    assert flat.slope_s_per_lap == pytest.approx(0.0, abs=1e-9)
    assert flat.r_squared == 0.0


def test_compound_slope_is_unbiased_by_driver_pace_differences() -> None:
    # Faster cars run longer stints here: a naive pooled regression would be biased.
    cars = {
        1: CarSpec(offset_s=-1.5, stops=((30, Compound.HARD),)),
        2: CarSpec(offset_s=0.0, stops=((20, Compound.HARD),)),
        3: CarSpec(offset_s=1.5, stops=((12, Compound.HARD),)),
    }
    race = make_race(RaceSpec(cars=cars, noise_s=0.05, seed=7))

    pooled = compound_degradation(race)

    assert pooled[Compound.MEDIUM].slope_ci[0] <= 0.07 <= pooled[Compound.MEDIUM].slope_ci[1]
    assert pooled[Compound.HARD].slope_s_per_lap == pytest.approx(0.04, abs=0.01)
    assert pooled[Compound.MEDIUM].n_stints == 3

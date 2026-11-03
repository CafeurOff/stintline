import pytest

from stintline_strategy.domain import (
    Compound,
    Lap,
    Neutralisation,
    NeutralisedPeriod,
    group_by_stint,
    require_non_empty,
)
from stintline_strategy.fuel import FuelModel


def test_fuel_gain_scales_with_lap_count() -> None:
    fuel = FuelModel(seconds_per_kg=0.033, start_fuel_kg=100.0)

    assert fuel.burn_per_lap_kg(50) == pytest.approx(2.0)
    assert fuel.gain_per_lap_s(57) == pytest.approx(0.0579, abs=1e-4)  # Bahrain
    assert fuel.gain_per_lap_s(70) == pytest.approx(0.0471, abs=1e-4)  # Hungaroring


def test_fuel_correction_removes_onboard_fuel_cost() -> None:
    fuel = FuelModel(seconds_per_kg=0.03, start_fuel_kg=100.0, burn_mid_lap=False)

    assert fuel.fuel_on_board_kg(1, 50) == pytest.approx(100.0)
    assert fuel.correct(93.0, 1, 50) == pytest.approx(90.0)
    assert fuel.fuel_on_board_kg(60, 50) == 0.0  # never negative


@pytest.mark.parametrize(("seconds_per_kg", "start_fuel_kg"), [(-0.1, 100.0), (0.03, -1.0)])
def test_fuel_model_rejects_negative_parameters(
    seconds_per_kg: float, start_fuel_kg: float
) -> None:
    with pytest.raises(ValueError, match="non-negative"):
        FuelModel(seconds_per_kg=seconds_per_kg, start_fuel_kg=start_fuel_kg)


def test_fuel_model_rejects_non_positive_lap_count() -> None:
    with pytest.raises(ValueError, match="total_laps"):
        FuelModel().burn_per_lap_kg(0)


def test_neutralised_period_bounds() -> None:
    sc = NeutralisedPeriod(Neutralisation.SAFETY_CAR, 10, 12)
    open_ended = NeutralisedPeriod(Neutralisation.RED_FLAG, 40, None)

    assert [sc.covers(n) for n in (9, 10, 12, 13)] == [False, True, True, False]
    assert open_ended.covers(70)


def test_group_by_stint_sorts_and_drops_unknown_stints() -> None:
    laps = [
        Lap(1, 3, 90.0, 1, Compound.SOFT, 2),
        Lap(1, 2, 90.0, 1, Compound.SOFT, 1),
        Lap(1, 4, 90.0, None, Compound.UNKNOWN, None),
    ]

    grouped = group_by_stint(laps)

    assert list(grouped) == [(1, 1)]
    assert [lap.lap for lap in grouped[(1, 1)]] == [2, 3]


def test_compound_dry_flag_and_non_empty_guard() -> None:
    assert Compound.HARD.is_dry
    assert not Compound.INTERMEDIATE.is_dry
    assert require_non_empty([1], "x") == [1]
    with pytest.raises(ValueError, match="must not be empty"):
        require_non_empty([], "races")

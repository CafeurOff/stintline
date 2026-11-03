import pytest

from stintline_strategy.domain import Compound
from stintline_strategy.pace import PaceModel, TyreModel, build_pace_model
from stintline_strategy.pit_loss import PitLossEstimate
from stintline_strategy.synthetic import CarSpec, RaceSpec, make_race
from stintline_strategy.undercut import CarState, StopPlan, overcut, simulate_exchange, undercut

LOSS = PitLossEstimate(green_s=21.0, green_sigma_s=1.0, n_green=20)


def pace(
    slope_medium: float = 0.1, slope_hard: float = 0.05, hard_offset: float = 0.4
) -> PaceModel:
    return PaceModel(
        tyres={
            Compound.MEDIUM: TyreModel(Compound.MEDIUM, 90.0, slope_medium, 0.005),
            Compound.HARD: TyreModel(Compound.HARD, 90.0 + hard_offset, slope_hard, 0.005),
        },
        car_offsets_s={},
    )


def states(gap: float, age: int = 20) -> tuple[CarState, CarState]:
    return (
        CarState(car=4, race_time_s=1000.0 + gap, compound=Compound.MEDIUM, tyre_age=age),
        CarState(car=1, race_time_s=1000.0, compound=Compound.MEDIUM, tyre_age=age),
    )


def test_undercut_works_when_worn_tyres_are_slow_enough() -> None:
    attacker, defender = states(gap=1.0, age=25)

    result = undercut(
        attacker,
        defender,
        30,
        pace(slope_medium=0.15),
        LOSS,
        attacker_compound=Compound.HARD,
        defender_compound=Compound.HARD,
    )

    # One lap on new hards vs 26-lap-old mediums: 0.15 × 26 − 0.4 ≈ 3.5 s gained.
    assert result.net_gain_s == pytest.approx(3.5, abs=0.3)
    assert result.attacker_ahead
    assert result.p_attacker_ahead > 0.9
    assert result.lap_gaps_s[0][0] == 30


def test_undercut_fails_with_low_degradation() -> None:
    attacker, defender = states(gap=2.0, age=10)

    result = undercut(
        attacker,
        defender,
        30,
        pace(slope_medium=0.02),
        LOSS,
        attacker_compound=Compound.HARD,
        defender_compound=Compound.HARD,
    )

    assert not result.attacker_ahead
    assert result.p_attacker_ahead < 0.5


def test_overcut_benefits_from_fresh_tyres_late() -> None:
    attacker, defender = states(gap=1.0, age=5)

    result = overcut(
        attacker,
        defender,
        30,
        pace(slope_medium=0.01, hard_offset=1.5),
        LOSS,
        attacker_compound=Compound.HARD,
        defender_compound=Compound.HARD,
        attacker_extra_laps=3,
    )

    # Defender's slow new hards (offset 1.5 s) let the attacker gain on old mediums.
    assert result.net_gain_s > 0
    assert result.gap_before_s == pytest.approx(1.0)


def test_identical_plans_keep_the_gap() -> None:
    attacker, defender = states(gap=1.5)
    plan_a = StopPlan(attacker, 30, Compound.HARD)
    plan_d = StopPlan(defender, 30, Compound.HARD)

    result = simulate_exchange(plan_a, plan_d, pace(), LOSS)

    assert result.net_gain_s == pytest.approx(0.0, abs=1e-9)
    assert result.gap_after_s == pytest.approx(1.5)


def test_zero_uncertainty_gives_a_hard_decision() -> None:
    attacker, defender = states(gap=1.0, age=0)
    certain = PitLossEstimate(green_s=21.0, green_sigma_s=0.0, n_green=1)
    flat = PaceModel(
        {
            Compound.MEDIUM: TyreModel(Compound.MEDIUM, 90, 0.2, 0.0),
            Compound.HARD: TyreModel(Compound.HARD, 90, 0.0, 0.0),
        },
        {},
    )

    result = undercut(
        attacker,
        defender,
        2,
        flat,
        certain,
        attacker_compound=Compound.HARD,
        defender_compound=Compound.HARD,
    )

    assert result.sigma_s == 0.0
    assert result.p_attacker_ahead in (0.0, 1.0)


def test_pace_model_recovers_car_offsets_and_compounds() -> None:
    cars = {1: CarSpec(offset_s=0.0), 2: CarSpec(offset_s=0.6, stops=((20, 1 and Compound.HARD),))}
    race = make_race(RaceSpec(cars=cars, noise_s=0.03))

    model = build_pace_model(race)

    assert model.car_offsets_s[2] - model.car_offsets_s[1] == pytest.approx(0.6, abs=0.1)
    assert model.tyres[Compound.HARD].slope_s_per_lap == pytest.approx(0.04, abs=0.01)
    assert model.lap_time(99, Compound.MEDIUM, 0) == model.tyres[Compound.MEDIUM].new_tyre_pace_s
    assert model.tyres[Compound.MEDIUM].stint_time(2, 3) == pytest.approx(
        sum(model.tyres[Compound.MEDIUM].lap_time(a) for a in (2, 3, 4))
    )

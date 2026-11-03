"""What-if replay, checked against synthetic races with a known answer.

Two races generated with the same seed differ only by one car's strategy: every lap draws
the same noise, so race B is the exact truth for "race A with B's strategy".
"""

from dataclasses import replace

import pytest

from stintline_strategy.domain import Compound
from stintline_strategy.pace import build_pace_model
from stintline_strategy.pit_loss import estimate_pit_loss
from stintline_strategy.synthetic import CarSpec, RaceSpec, field_of, make_race
from stintline_strategy.whatif import (
    Strategy,
    StrategyWarning,
    WhatIfError,
    real_strategy,
    replay_strategy,
    schedule,
)

CAR = 3


def spec(stops: tuple[tuple[int, Compound], ...], **kwargs: object) -> RaceSpec:
    cars = field_of(10)
    cars[CAR] = replace(cars[CAR], stops=stops)
    return RaceSpec(cars=cars, seed=7, **kwargs)  # type: ignore[arg-type]


def replay(race_spec: RaceSpec, strategy: Strategy):  # type: ignore[no-untyped-def]
    race = make_race(race_spec)
    return replay_strategy(race, CAR, strategy, build_pace_model(race), estimate_pit_loss(race))


def finish(race_spec: RaceSpec, car: int = CAR) -> float:
    laps = make_race(race_spec).laps_of(car)
    return laps[-1].end_time_s or 0.0


def test_replaying_the_real_strategy_changes_nothing() -> None:
    real = spec(((27, Compound.HARD),))

    result = replay(real, Strategy(Compound.MEDIUM, ((27, Compound.HARD),)))

    assert result.final_time_s == pytest.approx(result.real_time_s)
    assert set(result.deltas_s) == {0.0}
    assert result.sigma_s == 0.0
    assert result.position == result.real_position
    assert result.position_probabilities == {result.real_position: 1.0}


@pytest.mark.parametrize(
    "alternative",
    [
        ((15, Compound.HARD),),
        ((38, Compound.HARD),),
        ((18, Compound.HARD), (36, Compound.MEDIUM)),
    ],
)
def test_replay_matches_the_race_actually_run_with_that_strategy(
    alternative: tuple[tuple[int, Compound], ...],
) -> None:
    truth = finish(spec(alternative))

    result = replay(spec(((27, Compound.HARD),)), Strategy(Compound.MEDIUM, alternative))

    assert result.final_time_s == pytest.approx(truth, abs=max(1.0, 2 * result.sigma_s))


def test_extra_stop_costs_about_one_pit_loss_net_of_fresher_tyres() -> None:
    base = spec(((27, Compound.HARD),))

    result = replay(base, Strategy(Compound.MEDIUM, ((20, Compound.HARD), (35, Compound.HARD))))

    assert 10.0 < -result.gain_s < base.pit_loss_s + 2.0
    assert result.sigma_s > 0


def test_stopping_under_the_safety_car_is_cheaper_as_in_the_real_race() -> None:
    # Safety car away from the field's stops (laps 25-29), so the SC loss is the default
    # fraction of the green loss rather than a measurement polluted by slow SC out-laps.
    sc = {"safety_car": (38, 40)}
    base = spec(((27, Compound.HARD),), **sc)

    green = replay(base, Strategy(Compound.MEDIUM, ((36, Compound.HARD),)))
    neutral = replay(base, Strategy(Compound.MEDIUM, ((39, Compound.HARD),)))

    assert neutral.final_time_s < green.final_time_s
    for result, lap in ((green, 36), (neutral, 39)):
        truth = finish(spec(((lap, Compound.HARD),), **sc))
        assert result.final_time_s == pytest.approx(truth, abs=max(1.0, 2 * result.sigma_s))


def test_finishing_position_moves_with_the_time_and_probabilities_sum_to_one() -> None:
    result = replay(
        spec(((27, Compound.HARD),)),
        Strategy(Compound.MEDIUM, ((12, Compound.HARD), (24, Compound.HARD), (36, Compound.HARD))),
    )

    assert result.position > result.real_position
    assert sum(result.position_probabilities.values()) == pytest.approx(1.0, abs=0.03)
    assert result.position in result.position_probabilities


def test_official_results_set_the_finishing_order() -> None:
    race = make_race(spec(((27, Compound.HARD),)))
    times = {
        car: (laps[-1].lap, laps[-1].end_time_s or 0.0)
        for car in race.cars
        for laps in [race.laps_of(car)]
    }
    leader = min(times, key=lambda car: times[car][1])
    times[CAR] = (times[CAR][0], times[leader][1] - 1.0)  # e.g. a rival's time penalty

    result = replay_strategy(
        race,
        CAR,
        Strategy(Compound.MEDIUM, ((27, Compound.HARD),)),
        build_pace_model(race),
        estimate_pit_loss(race),
        results=times,
    )

    assert result.position == result.real_position == 1


def test_warnings_flag_single_compound_and_untested_stint_lengths() -> None:
    result = replay(spec(((27, Compound.HARD),)), Strategy(Compound.HARD, ()))

    assert StrategyWarning.TWO_COMPOUND_RULE in result.warnings
    assert StrategyWarning.LONG_STINT in result.warnings


@pytest.mark.parametrize(
    ("strategy", "message"),
    [
        (Strategy(Compound.MEDIUM, ((60, Compound.HARD),)), "outside the race"),
        (Strategy(Compound.MEDIUM, ((2, Compound.HARD),)), "at least"),
        (Strategy(Compound.MEDIUM, ((48, Compound.HARD),)), "at least"),
        (Strategy(Compound.MEDIUM, ((25, Compound.SOFT),)), "no tyre model"),
        (Strategy(Compound.SOFT, ((25, Compound.HARD),)), "no tyre model"),
    ],
)
def test_invalid_strategies_are_rejected(strategy: Strategy, message: str) -> None:
    with pytest.raises(WhatIfError, match=message):
        replay(spec(((27, Compound.HARD),)), strategy)


def test_real_strategy_and_schedule_follow_the_same_convention() -> None:
    race = make_race(spec(((27, Compound.HARD),)))

    strategy, tyres = real_strategy(race, CAR)

    assert strategy == Strategy(Compound.MEDIUM, ((27, Compound.HARD),))
    assert tyres == schedule(strategy, 50)
    assert (tyres[26].compound, tyres[27]) == (Compound.MEDIUM, replace(tyres[27], age=0))


def test_unknown_car_is_rejected() -> None:
    race = make_race(spec(((27, Compound.HARD),)))

    with pytest.raises(WhatIfError, match="no laps"):
        real_strategy(race, 99)


def test_car_with_gaps_in_its_timing_is_rejected() -> None:
    race = make_race(spec(((27, Compound.HARD),)))
    holed = replace(
        race, laps=tuple(lap for lap in race.laps if not (lap.car == CAR and lap.lap == 10))
    )

    with pytest.raises(WhatIfError, match="gaps"):
        replay_strategy(
            holed,
            CAR,
            Strategy(Compound.MEDIUM, ((27, Compound.HARD),)),
            build_pace_model(holed),
            estimate_pit_loss(holed),
        )


def test_carspec_default_is_one_stop() -> None:
    assert CarSpec().stops == ((25, Compound.HARD),)

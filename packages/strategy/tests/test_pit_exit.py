import pytest

from stintline_strategy.domain import Compound, Lap, Neutralisation, Race
from stintline_strategy.pit_exit import (
    PitExitConfig,
    actual_position_after_stop,
    predict_pit_exit,
    race_order_at,
)
from stintline_strategy.pit_loss import PitLossEstimate

LOSS = PitLossEstimate(green_s=20.0, green_sigma_s=0.5, n_green=10)


def snapshot(gaps: dict[int, float], lap: int = 9) -> Race:
    """Cars at the end of ``lap`` with the given race times."""
    laps = tuple(
        Lap(car, lap, 90.0, 1, Compound.MEDIUM, lap, end_time_s=1000.0 + t)
        for car, t in gaps.items()
    )
    return Race("r", 50, laps)


def test_rejoin_position_from_gaps() -> None:
    # Car 1 leads; rivals are 5, 12, 25 and 40 s behind; a 20 s stop drops it behind two.
    race = snapshot({1: 0.0, 2: 5.0, 3: 12.0, 4: 25.0, 5: 40.0})

    prediction = predict_pit_exit(race, 1, 10, LOSS, config=PitExitConfig(gap_noise_s_per_lap=0.3))

    assert prediction.position_before == 1
    assert prediction.most_likely_position == 3
    assert prediction.interval == (3, 3)
    assert sum(prediction.distribution) == pytest.approx(1.0)
    assert [r.car for r in prediction.rivals][:2] == [2, 3]
    assert prediction.rivals[-1].p_pitting_car_ahead > 0.99


def test_close_calls_widen_the_interval() -> None:
    race = snapshot({1: 0.0, 2: 19.5, 3: 20.5})

    prediction = predict_pit_exit(race, 1, 10, LOSS)

    assert prediction.interval == (1, 3)
    assert 1.5 < prediction.expected_position < 2.5


def test_safety_car_reduces_the_loss() -> None:
    race = snapshot({1: 0.0, 2: 12.0, 3: 18.0})

    green = predict_pit_exit(race, 1, 10, LOSS, config=PitExitConfig(gap_noise_s_per_lap=0.3))
    sc = predict_pit_exit(
        race,
        1,
        10,
        LOSS,
        neutralisation=Neutralisation.SAFETY_CAR,
        config=PitExitConfig(gap_noise_s_per_lap=0.3),
    )

    assert sc.pit_loss_s == pytest.approx(14.0)
    assert green.most_likely_position == 3
    assert sc.most_likely_position == 2


def test_rival_stops_in_the_window_are_accounted_for() -> None:
    race = snapshot({1: 0.0, 2: 5.0, 3: 12.0})
    config = PitExitConfig(gap_noise_s_per_lap=0.3)

    blind = predict_pit_exit(race, 1, 10, LOSS, config=config)
    both_stop = predict_pit_exit(race, 1, 10, LOSS, rival_stops={2: 10, 3: 9}, config=config)
    unrelated = predict_pit_exit(race, 1, 10, LOSS, rival_stops={2: 30}, config=config)

    assert blind.most_likely_position == 3
    # Car 2 loses a full stop (5 + 20 > 20), car 3 half of one (12 + 10 > 20).
    assert both_stop.most_likely_position == 1
    assert unrelated.most_likely_position == 3


def test_unknown_car_and_actual_position() -> None:
    race = Race(
        "r",
        50,
        (
            Lap(1, 11, 110.0, 2, Compound.HARD, 0, end_time_s=1120.0),
            Lap(2, 11, 90.0, 1, Compound.MEDIUM, 10, end_time_s=1100.0),
        ),
    )

    assert race_order_at(race, 11) == [(2, 1100.0), (1, 1120.0)]
    assert actual_position_after_stop(race, 1, 10) == 2
    assert actual_position_after_stop(race, 3, 10) is None
    with pytest.raises(ValueError, match="did not complete lap 9"):
        predict_pit_exit(race, 1, 10, LOSS)

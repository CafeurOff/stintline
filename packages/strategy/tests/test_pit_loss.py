import pytest

from stintline_strategy.domain import Compound, Lap, Neutralisation, PitStop, Race
from stintline_strategy.pit_loss import (
    PitLossConfig,
    PitLossEstimate,
    estimate_pit_loss,
    stop_losses,
)
from stintline_strategy.synthetic import CarSpec, RaceSpec, field_of, make_race


def test_green_pit_loss_is_recovered_from_the_field() -> None:
    race = make_race(RaceSpec(cars=field_of(10), pit_loss_s=22.0, noise_s=0.05))

    estimate = estimate_pit_loss(race)

    # Out-laps on new tyres are faster than the old-tyre reference, so the measured loss
    # is slightly below the injected one: that is the effect strategists care about.
    assert estimate.green_s == pytest.approx(22.0, abs=1.0)
    assert estimate.n_green == 10
    assert estimate.green_sigma_s >= PitLossConfig().min_sigma_s


def test_safety_car_stops_are_measured_against_the_field() -> None:
    cars = field_of(8)
    cars[1] = CarSpec(stops=((20, Compound.HARD),))
    cars[2] = CarSpec(offset_s=0.25, stops=((21, Compound.HARD),))
    race = make_race(RaceSpec(cars=cars, safety_car=(20, 23), sc_pit_loss_s=14.0))

    estimate = estimate_pit_loss(race)

    assert Neutralisation.SAFETY_CAR in estimate.neutralised_s
    assert estimate.under(Neutralisation.SAFETY_CAR) == pytest.approx(14.0, abs=2.5)
    assert estimate.under(None) == estimate.green_s


def test_slow_stops_are_flagged_as_outliers() -> None:
    race = make_race(RaceSpec(cars=field_of(8), pit_loss_s=22.0))
    slow = [
        lap
        if not (lap.car == 3 and lap.is_pit_out)
        else Lap(
            lap.car,
            lap.lap,
            (lap.time_s or 0) + 10,
            lap.stint,
            lap.compound,
            lap.tyre_age,
            lap.is_pit_in,
            True,
            lap.end_time_s,
        )
        for lap in race.laps
    ]
    race = Race(race.name, race.total_laps, tuple(slow), race.pit_stops)

    losses = stop_losses(race)

    assert [s.car for s in losses if s.outlier] == [3]
    assert estimate_pit_loss(race).n_green == 7


def test_default_factors_apply_when_no_neutralised_stop_was_seen() -> None:
    estimate = PitLossEstimate(green_s=20.0, green_sigma_s=1.0, n_green=5)

    assert estimate.under(Neutralisation.SAFETY_CAR) == pytest.approx(14.0)
    assert estimate.under(Neutralisation.VIRTUAL_SAFETY_CAR) == pytest.approx(16.0)


def test_leave_one_out_and_pooling() -> None:
    race = make_race(RaceSpec(cars=field_of(6)))

    all_stops = estimate_pit_loss([race, race])
    without_one = estimate_pit_loss(race, exclude={(1, 25)})

    assert all_stops.n_green == 12
    assert without_one.n_green == 5


def test_unmeasurable_stops_are_ignored() -> None:
    laps = (
        Lap(1, 10, None, 1, Compound.SOFT, 9, is_pit_in=True),
        Lap(1, 11, 110.0, 2, Compound.HARD, 0, is_pit_out=True),
    )
    race = Race("r", 20, laps, (PitStop(1, 10), PitStop(1, 15)))

    assert stop_losses(race) == []
    with pytest.raises(ValueError, match="no measurable"):
        estimate_pit_loss(race)

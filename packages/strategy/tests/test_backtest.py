import pytest

from stintline_strategy.backtest import BacktestCase, Metrics, backtest_pit_exits
from stintline_strategy.domain import Compound
from stintline_strategy.synthetic import CarSpec, RaceSpec, field_of, make_race


def test_backtest_on_a_synthetic_race_is_accurate() -> None:
    race = make_race(RaceSpec(cars=field_of(10, gap_offset_s=0.6), noise_s=0.05))

    report = backtest_pit_exits([race])
    scenario = backtest_pit_exits([race], known_rival_stops=True)

    # Every car stops within a few laps, so the order barely changes: the blind mode
    # (rivals assumed to stay out) is pessimistic, the scenario mode is near exact.
    assert report.overall.n == 10
    assert scenario.overall.mae <= 0.5
    assert scenario.overall.mae < report.overall.mae
    assert set(report.per_race) == {"Synthetic Grand Prix"}


def test_backtest_skips_unrepresentative_stops() -> None:
    cars = {
        1: CarSpec(stops=((1, Compound.HARD),)),
        2: CarSpec(stops=((20, Compound.HARD),)),
        3: CarSpec(stops=((50, Compound.HARD),)),
        4: CarSpec(stops=((30, Compound.HARD),)),
        5: CarSpec(stops=((31, Compound.HARD),)),
        6: CarSpec(stops=((32, Compound.HARD),)),
    }
    race = make_race(RaceSpec(cars=cars, safety_car=(19, 21)))

    report = backtest_pit_exits([race])

    reasons = " ".join(report.skipped)
    assert "first lap" in reasons
    assert "final lap" in reasons
    assert "neutralised" in reasons
    assert report.overall.n == 3


def test_metrics_require_cases() -> None:
    with pytest.raises(ValueError, match="no backtest cases"):
        Metrics.of([])


def test_case_properties() -> None:
    race = make_race(RaceSpec(cars=field_of(4)))
    case: BacktestCase = backtest_pit_exits([race]).cases[0]

    assert case.error == case.prediction.most_likely_position - case.actual_position
    assert isinstance(case.in_interval, bool)

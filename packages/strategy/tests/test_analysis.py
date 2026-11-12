import numpy as np
import pytest

from stintline_strategy.analysis import (
    ConsistencyConfig,
    PaceFilter,
    UndercutConfig,
    box_summary,
    consistency_s,
    kept_by_car,
    laps_led,
    on_track_passes,
    pace_laps,
    undercut_attempts,
)
from stintline_strategy.domain import Compound, Lap, Neutralisation, NeutralisedPeriod, Race
from stintline_strategy.fuel import FuelModel
from stintline_strategy.laps import clean_laps
from stintline_strategy.synthetic import CarSpec, RaceSpec, make_race

NO_FUEL = FuelModel(seconds_per_kg=0.0)


def race_from(
    times: dict[int, list[float]],
    pits: dict[int, list[int]] | None = None,
    neutral: tuple[NeutralisedPeriod, ...] = (),
) -> Race:
    """Cars with the given lap times; a pit-in lap ``n`` makes ``n + 1`` the out-lap and
    starts a new stint."""
    pits = pits or {}
    laps: list[Lap] = []
    total = max(len(t) for t in times.values())
    for car, car_times in times.items():
        clock, stint = 0.0, 1
        for i, time in enumerate(car_times, start=1):
            clock += time
            is_in, is_out = i in pits.get(car, []), (i - 1) in pits.get(car, [])
            laps.append(Lap(car, i, time, stint, Compound.MEDIUM, i, is_in, is_out, clock))
            if is_in:
                stint += 1
    return Race("r", total, tuple(laps), neutralisations=neutral)


def test_box_summary_quartiles_and_outliers() -> None:
    values = [90.0, 90.2, 90.4, 90.6, 90.8, 99.0]

    box = box_summary(values)

    assert box.n == 6
    assert box.median_s == pytest.approx(90.5)
    assert box.q1_s == pytest.approx(90.25)
    assert box.q3_s == pytest.approx(90.75)
    assert box.high_s == pytest.approx(90.8)
    assert box.outliers_s == (99.0,)


def test_box_summary_single_value_has_no_spread() -> None:
    box = box_summary([91.0])

    assert box.std_s == 0.0
    assert box.low_s == box.high_s == 91.0


def test_box_summary_rejects_empty_input() -> None:
    with pytest.raises(ValueError, match="at least one"):
        box_summary([])


def test_pace_filter_rejects_cutoff_below_hundred() -> None:
    with pytest.raises(ValueError, match="cutoff_pct"):
        PaceFilter(cutoff_pct=95)


def test_pace_laps_drops_lap_one_pit_neutralised_and_slow_laps() -> None:
    sc = (NeutralisedPeriod(Neutralisation.SAFETY_CAR, 5, 5),)
    race = race_from({1: [95.0, 90.0, 90.0, 110.0, 120.0, 92.0, 90.0, 100.0]}, {1: [3]}, sc)

    laps = pace_laps(race, NO_FUEL, PaceFilter(cutoff_pct=107))

    kept = [lap.lap for lap in laps if lap.kept]
    assert [lap.lap for lap in laps] == [2, 3, 4, 5, 6, 7, 8]
    # 3 in-lap, 4 out-lap, 5 SC, 6 restart, 8 slower than 107 % of 90 s.
    assert kept == [2, 7]


def test_pace_laps_can_keep_every_lap() -> None:
    sc = (NeutralisedPeriod(Neutralisation.SAFETY_CAR, 5, 5),)
    race = race_from({1: [95.0, 90.0, 90.0, 110.0, 120.0, 92.0]}, {1: [3]}, sc)
    flt = PaceFilter(include_pit_laps=True, include_neutralised=True, cutoff_pct=None)

    laps = pace_laps(race, NO_FUEL, flt)

    assert all(lap.kept for lap in laps)


def test_pace_laps_fuel_correction_removes_the_fuel_effect() -> None:
    fuel = FuelModel()
    spec = RaceSpec(cars={1: CarSpec(stops=())}, noise_s=0.0, slopes=dict.fromkeys(Compound, 0.0))
    race = make_race(spec)

    corrected = pace_laps(race, fuel, PaceFilter())
    raw = pace_laps(race, fuel, PaceFilter(fuel_corrected=False))

    assert np.ptp([lap.value_s for lap in corrected]) == pytest.approx(0.0, abs=1e-9)
    assert np.ptp([lap.value_s for lap in raw]) > 2.0


def test_pace_laps_of_race_without_times_is_empty() -> None:
    race = Race("r", 1, (Lap(1, 1, None, 1, Compound.SOFT, 0),))

    assert pace_laps(race, NO_FUEL, PaceFilter()) == []


def test_consistency_ignores_tyre_degradation() -> None:
    worn = [90.0 + 0.1 * i for i in range(20)]
    race = race_from({1: worn})

    spread = consistency_s(race.laps_of(1), race, NO_FUEL)

    assert spread == pytest.approx(0.0, abs=1e-9)


def test_consistency_measures_lap_to_lap_scatter() -> None:
    rng = np.random.default_rng(3)
    steady = (90 + rng.normal(0, 0.1, 30)).tolist()
    erratic = (90 + rng.normal(0, 0.5, 30)).tolist()
    race = race_from({1: steady, 2: erratic})

    a = consistency_s(race.laps_of(1), race, NO_FUEL)
    b = consistency_s(race.laps_of(2), race, NO_FUEL)

    assert a is not None
    assert b is not None
    assert a < b


def test_consistency_needs_enough_laps() -> None:
    race = race_from({1: [90.0, 90.1, 90.2, 90.3, 90.4]})

    assert consistency_s(race.laps_of(1), race, NO_FUEL, ConsistencyConfig(min_laps=8)) is None


def test_kept_by_car_groups_kept_laps() -> None:
    race = race_from({1: [95.0, 90.0, 90.1], 2: [96.0, 91.0, 91.1]})

    kept = kept_by_car(clean_laps(race))

    assert [lap.lap for lap in kept[1]] == [2, 3]
    assert set(kept) == {1, 2}


def test_on_track_pass_is_counted_once() -> None:
    # Car 2 starts 1 s behind car 1 and is 2 s a lap faster on lap 3.
    race = race_from({1: [90.0, 90.0, 90.0, 90.0], 2: [91.0, 90.0, 88.0, 90.0]})

    passes = on_track_passes(race)

    assert [(p.lap, p.car, p.passed) for p in passes] == [(3, 2, 1)]


def test_place_lost_in_the_pits_is_not_a_pass() -> None:
    race = race_from({1: [90.0, 110.0, 100.0, 90.0], 2: [91.0, 90.0, 90.0, 90.0]}, {1: [2]})

    assert on_track_passes(race) == []


def test_swap_under_safety_car_is_not_a_pass() -> None:
    sc = (NeutralisedPeriod(Neutralisation.SAFETY_CAR, 3, 3),)
    race = race_from({1: [90.0, 90.0, 90.0, 90.0], 2: [91.0, 90.0, 88.0, 90.0]}, neutral=sc)

    assert on_track_passes(race) == []


def test_laps_led_counts_the_leader_at_each_line() -> None:
    race = race_from({1: [90.0, 90.0, 90.0, 90.0], 2: [91.0, 90.0, 88.0, 90.0]})

    assert laps_led(race) == {1: 2, 2: 2}


def _undercut_race(attacker_out_lap_s: float, *, gap_s: float = 1.0) -> Race:
    """Car 2 follows car 1 by ``gap_s``, pits on lap 5; car 1 pits on lap 6."""
    leader = [90.0] * 4 + [90.5, 110.0, 105.0, 90.0]
    chaser = [90.0 + gap_s] + [90.0] * 3 + [110.0, attacker_out_lap_s, 90.0, 90.0]
    return race_from({1: leader, 2: chaser}, {1: [6], 2: [5]})


def test_undercut_that_works() -> None:
    race = _undercut_race(attacker_out_lap_s=96.0)

    [attempt] = undercut_attempts(race)

    assert (attempt.attacker, attempt.defender) == (2, 1)
    assert (attempt.attacker_lap, attempt.defender_lap) == (5, 6)
    assert attempt.gap_before_s == pytest.approx(1.0)
    assert attempt.success
    assert attempt.gain_s > 1.0


def test_undercut_that_fails() -> None:
    race = _undercut_race(attacker_out_lap_s=108.0)

    [attempt] = undercut_attempts(race)

    assert not attempt.success
    assert attempt.gap_after_s > 0


def test_early_stop_far_behind_is_not_an_undercut() -> None:
    race = _undercut_race(attacker_out_lap_s=96.0, gap_s=8.0)

    assert undercut_attempts(race, UndercutConfig(max_gap_s=3.0)) == []


def test_late_reply_is_not_an_undercut() -> None:
    race = _undercut_race(attacker_out_lap_s=96.0)

    assert undercut_attempts(race, UndercutConfig(max_reply_laps=0)) == []


def test_undercut_under_safety_car_is_left_out() -> None:
    leader = [90.0] * 4 + [90.5, 110.0, 105.0, 90.0]
    chaser = [91.0] + [90.0] * 3 + [110.0, 96.0, 90.0, 90.0]
    sc = (NeutralisedPeriod(Neutralisation.SAFETY_CAR, 6, 6),)
    race = race_from({1: leader, 2: chaser}, {1: [6], 2: [5]}, sc)

    assert undercut_attempts(race) == []


def test_leader_pitting_first_is_not_an_undercut() -> None:
    leader = [90.0] * 4 + [110.0, 96.0, 90.0, 90.0]
    chaser = [91.0] + [90.0] * 4 + [110.0, 105.0, 90.0]
    race = race_from({1: leader, 2: chaser}, {1: [5], 2: [6]})

    assert undercut_attempts(race) == []

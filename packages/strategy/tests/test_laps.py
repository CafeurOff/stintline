from stintline_strategy.domain import Compound, Lap, Race
from stintline_strategy.laps import CleaningConfig, Exclusion, clean_laps, kept_laps
from stintline_strategy.synthetic import CarSpec, RaceSpec, make_race


def reasons(race: Race, car: int = 1) -> dict[int, Exclusion | None]:
    return {c.lap.lap: c.excluded for c in clean_laps(race) if c.lap.car == car}


def test_structural_exclusions_are_labelled() -> None:
    race = make_race(RaceSpec(cars={1: CarSpec()}, safety_car=(10, 12)))
    labels = reasons(race)

    assert labels[1] is Exclusion.FIRST_LAP
    assert labels[10] is labels[12] is Exclusion.NEUTRALISED
    assert labels[13] is Exclusion.RESTART
    assert labels[25] is Exclusion.PIT_IN
    assert labels[26] is Exclusion.PIT_OUT
    assert labels[30] is None


def test_missing_time_is_excluded() -> None:
    race = Race("r", 3, (Lap(1, 2, None, 1, Compound.SOFT, 1),))

    assert clean_laps(race)[0].excluded is Exclusion.MISSING_TIME


def test_outliers_are_removed_but_degradation_is_kept() -> None:
    base = make_race(
        RaceSpec(
            cars={1: CarSpec(stops=())},
            slopes={Compound.MEDIUM: 0.15, Compound.SOFT: 0.1, Compound.HARD: 0.05},
        )
    )
    laps = list(base.laps)
    laps[19] = Lap(
        1, 20, (laps[19].time_s or 0) + 4.0, 1, Compound.MEDIUM, 19, end_time_s=None
    )  # traffic
    race = Race(base.name, base.total_laps, tuple(laps))

    labels = reasons(race)

    assert labels[20] is Exclusion.OUTLIER
    assert sum(r is Exclusion.OUTLIER for r in labels.values()) == 1  # late, slower laps kept


def test_short_stints_are_not_outlier_filtered() -> None:
    laps = tuple(
        Lap(1, n, 90.0 + (5.0 if n == 3 else 0.0), 1, Compound.SOFT, n) for n in range(2, 6)
    )
    race = Race("r", 10, laps)

    assert all(c.excluded is None for c in clean_laps(race))


def test_config_toggles() -> None:
    race = make_race(RaceSpec(cars={1: CarSpec()}, safety_car=(10, 12), first_lap_penalty_s=0.0))
    config = CleaningConfig(exclude_first_lap=False, restart_buffer_laps=0)

    kept = {lap.lap for lap in kept_laps(race, config)}

    assert 1 in kept
    assert 13 in kept

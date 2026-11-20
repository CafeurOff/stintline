"""Points rules per era."""

from __future__ import annotations

import pytest

from stintline.championship.rules import CountBlock, UnknownSeasonError, rules_for


@pytest.mark.parametrize(
    ("year", "race_max", "sprint_max"),
    [
        (1950, 9, 0),
        (1960, 8, 0),
        (1975, 9, 0),
        (1995, 10, 0),
        (2005, 10, 0),
        (2012, 25, 0),
        (2019, 26, 0),
        (2021, 26, 3),
        (2023, 26, 8),
        (2026, 25, 8),
    ],
)
def test_most_points_per_race_and_sprint_follow_the_era(
    year: int, race_max: float, sprint_max: float
) -> None:
    rules = rules_for(year)

    assert (rules.race_max, rules.sprint_max) == (race_max, sprint_max)


def test_dropped_results_until_1990_then_every_result_counts() -> None:
    assert rules_for(1952).blocks == (CountBlock(None, 4),)
    assert rules_for(1977).blocks == (CountBlock(9, 8), CountBlock(8, 7))
    assert rules_for(1990).blocks == (CountBlock(None, 11),)
    assert rules_for(1991).all_count
    assert not rules_for(1990).all_count


def test_only_2014_doubles_its_finale() -> None:
    assert rules_for(2014).double_last_race
    assert not rules_for(2015).double_last_race


def test_no_championship_before_1950() -> None:
    with pytest.raises(UnknownSeasonError):
        rules_for(1949)

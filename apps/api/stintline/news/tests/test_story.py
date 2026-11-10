"""The story of a race on small synthetic races where every lap is known."""

from __future__ import annotations

import pytest

from stintline.news import story
from stintline.news.story import LeadTaken
from stintline_strategy.domain import Compound, Lap, PitStop, Race


def race(order_by_lap: list[list[int]], stops: dict[int, list[int]] | None = None) -> Race:
    """Cars cross the line in the given order each lap, one second apart."""
    laps = []
    for index, order in enumerate(order_by_lap):
        lap = index + 1
        for place, car in enumerate(order):
            laps.append(
                Lap(
                    car=car,
                    lap=lap,
                    time_s=90.0,
                    stint=1,
                    compound=Compound.MEDIUM,
                    tyre_age=lap,
                    end_time_s=lap * 90.0 + place,
                )
            )
    pit = tuple(PitStop(car=car, lap=lap) for car, laps in (stops or {}).items() for lap in laps)
    return Race(name="Test", total_laps=len(order_by_lap), laps=tuple(laps), pit_stops=pit)


def decisive(r: Race, winner: int) -> story.Decisive | None:
    spells = story.lead_spells(story.running_order(r))
    return story.decisive_moment(r, spells, winner)


def test_running_order_and_lead_spells() -> None:
    r = race([[1, 2], [2, 1], [2, 1], [1, 2]])

    spells = story.lead_spells(story.running_order(r))

    assert [(s.car, s.first_lap, s.last_lap, s.laps) for s in spells] == [
        (1, 1, 1, 1),
        (2, 2, 3, 2),
        (1, 4, 4, 1),
    ]


def test_running_order_skips_laps_nobody_finished() -> None:
    r = race([[1, 2]])
    r = Race(name="x", total_laps=3, laps=r.laps)

    assert list(story.running_order(r)) == [1]


def test_lights_to_flag() -> None:
    assert decisive(race([[1, 2]] * 3), 1) == story.Decisive(1, LeadTaken.LIGHTS_TO_FLAG, None)


def test_overtake_on_track() -> None:
    result = decisive(race([[2, 1], [2, 1], [1, 2]]), 1)

    assert result == story.Decisive(3, LeadTaken.ON_TRACK, 2)


def test_lead_inherited_when_the_leader_stops() -> None:
    result = decisive(race([[2, 1], [2, 1], [1, 2]], stops={2: [3]}), 1)

    assert result is not None
    assert result.how is LeadTaken.RIVAL_STOP


def test_undercut() -> None:
    result = decisive(race([[2, 1], [2, 1], [2, 1], [1, 2]], stops={1: [2], 2: [4]}), 1)

    assert result is not None
    assert result.how is LeadTaken.UNDERCUT


def test_lead_back_after_the_stops() -> None:
    order = [[1, 2], [2, 1], [2, 1], [1, 2]]

    result = decisive(race(order, stops={1: [2], 2: [4]}), 1)

    assert result is not None
    assert result.how is LeadTaken.PIT_CYCLE


def test_no_decisive_moment_when_the_first_across_the_line_is_not_the_winner() -> None:
    assert decisive(race([[1, 2]] * 2), 2) is None
    assert story.decisive_moment(race([]), [], 1) is None


@pytest.mark.parametrize(
    ("grid", "gains", "losses"),
    [
        ({1: 4, 2: 1, 3: 2, 4: 3}, [(1, 3)], []),
        ({1: 1, 2: 2, 3: 3, 4: 0}, [], []),
        ({1: 2, 2: 3, 3: 4, 4: 1}, [], [(4, -3)]),
    ],
)
def test_start_moves(
    grid: dict[int, int], gains: list[tuple[int, int]], losses: list[tuple[int, int]]
) -> None:
    order = story.running_order(race([[1, 2, 3, 4]]))

    up, down = story.start_moves(order, grid)

    assert [(m.car, m.gained) for m in up] == gains
    assert [(m.car, m.gained) for m in down] == losses

"""Title maths on plain numbers, including real title fights."""

from __future__ import annotations

import pytest

from stintline.championship import maths
from stintline.championship.maths import Remaining, Status, Tally
from stintline.championship.rules import rules_for

MODERN = rules_for(2026)


def test_counted_keeps_only_the_best_results() -> None:
    rules = rules_for(1988)  # best 11

    total = maths.counted([9.0] * 8 + [6.0, 6.0, 3.0, 1.0, 0.0], 0.0, rules)

    assert total == 72 + 12 + 3


def test_counted_takes_the_best_of_each_half_in_split_seasons() -> None:
    rules = rules_for(1979)  # best 4 of the first 7, best 4 of the last 8

    first = [9.0, 9.0, 9.0, 9.0, 9.0, 0.0, 0.0]
    last = [6.0, 6.0, 6.0, 6.0, 6.0, 0.0, 0.0, 0.0]

    assert maths.counted(first + last, 0.0, rules) == 36 + 24


def test_counted_adds_every_sprint_point() -> None:
    assert maths.counted([25.0, 18.0], 15.0, MODERN) == 58


def test_ceiling_assumes_every_race_and_sprint_won() -> None:
    tally = Tally(driver_id=1, races=(10.0,), sprints=2.0)

    assert maths.ceiling(tally, Remaining(races=3, sprints=1), MODERN) == 10 + 75 + 2 + 8


def test_ceiling_counts_the_double_points_finale_of_2014() -> None:
    rules = rules_for(2014)

    assert maths.ceiling(Tally(1, (0.0,)), Remaining(races=2, sprints=0), rules) == 25 + 50


def test_leader_out_of_reach_is_champion_and_the_rest_are_out() -> None:
    table = maths.standings(
        [Tally(1, (25.0,) * 4), Tally(2, (18.0,) * 4), Tally(3, (0.0,) * 4)],
        Remaining(races=1, sprints=0),
        MODERN,
    )

    assert [(row.driver_id, row.status) for row in table] == [
        (1, Status.CHAMPION),
        (2, Status.OUT),
        (3, Status.OUT),
    ]
    assert table[1].ceiling == 72 + 25


def test_rivals_who_can_still_catch_up_stay_in_the_fight() -> None:
    table = maths.standings(
        [Tally(1, (25.0, 25.0)), Tally(2, (18.0, 18.0)), Tally(3, (0.0, 1.0))],
        Remaining(races=1, sprints=0),
        MODERN,
    )

    assert [row.status for row in table] == [Status.LEADER, Status.CONTENDER, Status.OUT]


def test_senna_was_champion_at_suzuka_1988_on_countback() -> None:
    # Points of the first 15 rounds of 1988 (best 11 count) and their finishing places.
    senna = Tally(
        1,
        (0, 9, 0, 6, 9, 9, 6, 9, 9, 9, 9, 0, 1, 3, 9),
        finishes=(1, 2, 1, 1, 2, 1, 1, 1, 1, 6, 4, 1),
    )
    prost = Tally(
        2,
        (9, 6, 9, 9, 6, 6, 9, 0, 6, 6, 6, 0, 9, 9, 6),
        finishes=(1, 2, 1, 1, 2, 2, 1, 2, 2, 2, 1, 1, 2),
    )

    table = maths.standings([senna, prost], Remaining(races=1, sprints=0), rules_for(1988))

    # Prost could only tie on 87, with 7 wins to Senna's 8.
    assert (table[0].points, table[1].ceiling) == (87, 87)
    assert table[0].status is Status.CHAMPION


def test_a_tie_on_points_with_a_better_countback_keeps_the_rival_in() -> None:
    leader = Tally(1, (25.0, 0.0), finishes=(1,))
    rival = Tally(2, (0.0, 0.0), finishes=())

    table = maths.standings([leader, rival], Remaining(races=1, sprints=0), MODERN)

    # The rival can reach 25 with one win: tied, one win each, then nothing: not settled.
    assert table[1].status is Status.CONTENDER


def test_clinch_margin_is_what_the_leader_must_outscore_a_rival_by() -> None:
    table = maths.standings(
        [Tally(1, (25.0,) * 3), Tally(2, (18.0,) * 3)],
        Remaining(races=2, sprints=0),
        MODERN,
    )

    margins = maths.clinch_margins(
        table, Remaining(races=2, sprints=0), Remaining(races=1, sprints=0), MODERN
    )

    # 21 points ahead with 50 left; after the next race 25 are left: needs more than 4.
    assert margins is not None
    assert margins[2] == pytest.approx(4.0)


def test_no_clinch_margin_when_the_title_cannot_be_settled_next_time() -> None:
    table = maths.standings(
        [Tally(1, (25.0,)), Tally(2, (18.0,))], Remaining(races=5, sprints=0), MODERN
    )

    assert (
        maths.clinch_margins(
            table, Remaining(races=5, sprints=0), Remaining(races=1, sprints=0), MODERN
        )
        is None
    )
    best_of = maths.standings(
        [Tally(1, (9.0,)), Tally(2, (6.0,))], Remaining(1, 0), rules_for(1988)
    )
    assert maths.clinch_margins(best_of, Remaining(1, 0), Remaining(1, 0), rules_for(1988)) is None


def test_decided_after_finds_the_first_settled_round() -> None:
    steps = [
        (1, [Tally(1, (25.0,)), Tally(2, (18.0,))], Remaining(races=2, sprints=0)),
        (2, [Tally(1, (25.0, 25.0)), Tally(2, (18.0, 0.0))], Remaining(races=1, sprints=0)),
        (3, [Tally(1, (25.0, 25.0, 0.0)), Tally(2, (18.0, 0.0, 25.0))], Remaining(0, 0)),
    ]

    assert maths.decided_after(steps, MODERN) == 2
    assert maths.decided_after(steps[:1], MODERN) is None
    assert maths.standings([], Remaining(0, 0), MODERN) == []

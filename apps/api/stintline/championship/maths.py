"""Title maths on plain numbers (no ORM): counted points, the most a driver can still reach,
who is champion or out of the fight, and what the leader needs to clinch next time out.

A title is settled when the leader is ahead of every rival's ceiling, or level with it and
sure to win the countback (most wins, then most second places, and so on) even if that
rival wins every race left: Senna was champion at Suzuka in 1988 that way.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

from stintline.championship.rules import SeasonRules


@dataclass(frozen=True, slots=True)
class Tally:
    """One driver's season so far.

    ``races`` holds the points of every Grand Prix already run, in race order (0 when the
    driver was absent), so dropped results and split halves land in the right place.
    """

    driver_id: int
    races: tuple[float, ...]
    sprints: float = 0.0
    finishes: tuple[int, ...] = ()
    """Finishing places in Grands Prix (classified results), for the countback."""


@dataclass(frozen=True, slots=True)
class Remaining:
    races: int
    sprints: int


class Status(StrEnum):
    CHAMPION = "champion"
    LEADER = "leader"
    CONTENDER = "contender"
    OUT = "out"


@dataclass(frozen=True, slots=True)
class Standing:
    driver_id: int
    points: float
    """Points that count today (after dropped results)."""
    scored: float
    """Every point scored, dropped results included."""
    ceiling: float
    """Most points the driver can still finish the season with."""
    status: Status


def counted(races: Sequence[float], sprints: float, rules: SeasonRules) -> float:
    """Points that count: the best results of each block, plus every sprint point."""
    total = sprints
    start = 0
    for block in rules.blocks:
        end = len(races) if block.races is None else start + block.races
        chunk = sorted(races[start:end], reverse=True)
        total += sum(chunk if block.best is None else chunk[: block.best])
        start = end
    return total


def future_races(remaining: Remaining, rules: SeasonRules) -> list[float]:
    """The most points each Grand Prix still to run can give one driver, in race order."""
    out = [rules.race_max] * remaining.races
    if rules.double_last_race and out:
        out[-1] = rules.race_max * 2
    return out


def ceiling(tally: Tally, remaining: Remaining, rules: SeasonRules) -> float:
    """Counted points if the driver won everything left (with the fastest lap)."""
    races = (*tally.races, *future_races(remaining, rules))
    return counted(races, tally.sprints + remaining.sprints * rules.sprint_max, rules)


COUNTBACK_PLACES = 30
"""Places compared on a tie: more than a full grid, so every finish counts."""


def countback(finishes: Sequence[int], extra_wins: int = 0) -> tuple[int, ...]:
    """Number of wins, of second places, and so on: compared in that order on a tie."""
    counts = [0] * COUNTBACK_PLACES
    for place in finishes:
        if 1 <= place <= COUNTBACK_PLACES:
            counts[place - 1] += 1
    counts[0] += extra_wins
    return tuple(counts)


def _beats(leader: Tally, points: float, rival: Tally, top: float, remaining: Remaining) -> bool:
    """The leader, scoring nothing more, still finishes ahead of this rival."""
    if points != top:
        return points > top
    return countback(leader.finishes) > countback(rival.finishes, remaining.races)


def standings(tallies: Sequence[Tally], remaining: Remaining, rules: SeasonRules) -> list[Standing]:
    """Every driver with their counted points, ceiling and status, best first."""
    rows = [(t, counted(t.races, t.sprints, rules), ceiling(t, remaining, rules)) for t in tallies]
    rows.sort(key=lambda row: -row[1])
    if not rows:
        return []
    leader, leader_points, _ = rows[0]
    beaten = [_beats(leader, leader_points, t, top, remaining) for t, _, top in rows[1:]]
    settled = all(beaten)
    out = []
    for index, (tally, points, top) in enumerate(rows):
        if index == 0:
            status = Status.CHAMPION if settled else Status.LEADER
        else:
            status = Status.OUT if beaten[index - 1] else Status.CONTENDER
        out.append(
            Standing(
                driver_id=tally.driver_id,
                points=points,
                scored=sum(tally.races) + tally.sprints,
                ceiling=top,
                status=status,
            )
        )
    return out


def clinch_margins(
    table: Sequence[Standing], remaining: Remaining, next_round: Remaining, rules: SeasonRules
) -> dict[int, float] | None:
    """What the leader needs at the next round to be champion: for each rival still in the
    fight, the leader must outscore them there by *more than* this many points (negative:
    the leader can even lose that much ground). ``None`` when the title cannot be settled
    at that round against every rival, or in seasons with dropped results (the arithmetic
    is not a single margin there). ``next_round`` is what the next round holds (one race,
    and a sprint on sprint weekends)."""
    if not rules.all_count or len(table) < 2:
        return None
    leader = table[0]
    if leader.status is Status.CHAMPION:
        return None
    after = Remaining(
        races=remaining.races - next_round.races, sprints=remaining.sprints - next_round.sprints
    )
    left = sum(future_races(after, rules)) + after.sprints * rules.sprint_max
    best_swing = (
        sum(future_races(remaining, rules)) - sum(future_races(after, rules))
    ) + next_round.sprints * rules.sprint_max
    margins: dict[int, float] = {}
    for rival in table[1:]:
        if rival.status is Status.OUT:
            continue
        margin = left - (leader.points - rival.points)
        if margin >= best_swing:
            return None
        margins[rival.driver_id] = margin
    return margins


def decided_after(
    rounds: Sequence[tuple[int, Sequence[Tally], Remaining]], rules: SeasonRules
) -> int | None:
    """The first round after which the title was settled, or ``None`` if it went to the end
    undecided by arithmetic (or is not settled yet). ``rounds`` lists, for each round in
    order, its number, every driver's tally after it and what was still to run."""
    for number, tallies, remaining in rounds:
        table = standings(tallies, remaining, rules)
        if table and table[0].status is Status.CHAMPION:
            return number
    return None

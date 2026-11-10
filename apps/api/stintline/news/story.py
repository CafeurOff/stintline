"""The story of a race, lap by lap, from line-crossing times (pure functions on the engine's
``Race``): the start, who led and for how long, and how the winner took the lead for good.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

from stintline_strategy.domain import Race

MIN_START_GAIN = 2
"""Places gained on lap 1 before the start is worth telling."""
MIN_START_LOSS = 3
UNDERCUT_WINDOW_LAPS = 5
"""The winner's stop counts as an undercut when it came at most this many laps before
the leader's own stop that handed over the lead."""
MAX_START_MOVES = 2


class LeadTaken(StrEnum):
    LIGHTS_TO_FLAG = "lights_to_flag"
    """Led every lap."""
    UNDERCUT = "undercut"
    """Stopped first, and was ahead once the leader stopped too."""
    PIT_CYCLE = "pit_cycle"
    """Led, stopped, and got the lead back once the car that stayed out stopped too."""
    RIVAL_STOP = "rival_stop"
    """Inherited the lead when the leader stopped."""
    ON_TRACK = "on_track"
    """Passed the leader on track (or the leader dropped back)."""


@dataclass(frozen=True, slots=True)
class LeadSpell:
    car: int
    first_lap: int
    last_lap: int

    @property
    def laps(self) -> int:
        return self.last_lap - self.first_lap + 1


@dataclass(frozen=True, slots=True)
class StartMove:
    car: int
    grid: int
    after_lap_one: int

    @property
    def gained(self) -> int:
        return self.grid - self.after_lap_one


@dataclass(frozen=True, slots=True)
class Decisive:
    lap: int
    """First lap of the winner's final spell in the lead."""
    how: LeadTaken
    rival: int | None
    """Car that led before."""


def running_order(race: Race) -> dict[int, list[int]]:
    """Cars in order at the end of each lap, by the time they crossed the line."""
    order: dict[int, list[int]] = {}
    for lap in range(1, race.total_laps + 1):
        crossed = sorted(
            (item.end_time_s, item.car)
            for item in race.laps
            if item.lap == lap and item.end_time_s is not None
        )
        if crossed:
            order[lap] = [car for _, car in crossed]
    return order


def lead_spells(order: Mapping[int, list[int]]) -> list[LeadSpell]:
    spells: list[LeadSpell] = []
    for lap in sorted(order):
        leader = order[lap][0]
        if spells and spells[-1].car == leader and spells[-1].last_lap == lap - 1:
            spells[-1] = LeadSpell(leader, spells[-1].first_lap, lap)
        else:
            spells.append(LeadSpell(leader, lap, lap))
    return spells


def start_moves(
    order: Mapping[int, list[int]], grid: Mapping[int, int]
) -> tuple[list[StartMove], list[StartMove]]:
    """Biggest gains and losses on lap 1 against the grid (pit-lane starts left out)."""
    first = order.get(1, [])
    moves = [
        StartMove(car, grid[car], index + 1)
        for index, car in enumerate(first)
        if grid.get(car, 0) > 0
    ]
    gains = sorted((m for m in moves if m.gained >= MIN_START_GAIN), key=lambda m: -m.gained)
    losses = sorted((m for m in moves if -m.gained >= MIN_START_LOSS), key=lambda m: m.gained)
    return gains[:MAX_START_MOVES], losses[:1]


def decisive_moment(race: Race, spells: list[LeadSpell], winner: int) -> Decisive | None:
    """How the winner took the lead for the last time; ``None`` when the car that crossed
    the line first is not the classified winner (a penalty changed the result)."""
    if not spells or spells[-1].car != winner:
        return None
    final = spells[-1]
    if len(spells) == 1:
        return Decisive(final.first_lap, LeadTaken.LIGHTS_TO_FLAG, None)
    rival = spells[-2].car
    lap = final.first_lap
    rival_spell = spells[-2]
    rival_stops = _pit_laps(race, rival)
    winner_stops = _pit_laps(race, winner)
    if not any(lap - 1 <= s <= lap for s in rival_stops):
        return Decisive(lap, LeadTaken.ON_TRACK, rival)
    led_before = len(spells) >= 3 and spells[-3].car == winner
    handed_over = any(rival_spell.first_lap - 1 <= s <= rival_spell.first_lap for s in winner_stops)
    if led_before and handed_over:
        return Decisive(lap, LeadTaken.PIT_CYCLE, rival)
    undercut = any(lap - 1 - UNDERCUT_WINDOW_LAPS <= s < lap - 1 for s in winner_stops)
    return Decisive(lap, LeadTaken.UNDERCUT if undercut else LeadTaken.RIVAL_STOP, rival)


def _pit_laps(race: Race, car: int) -> set[int]:
    laps = {stop.lap for stop in race.pit_stops if stop.car == car}
    laps |= {item.lap for item in race.laps if item.car == car and item.is_pit_in}
    return laps

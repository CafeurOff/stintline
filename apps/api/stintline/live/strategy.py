"""Live strategy: where each car would rejoin if it pitted now.

Same reasoning as the pit-exit model (``stintline_strategy.pit_exit``), from live gaps:
a car stopping now loses the circuit's pit loss, so it rejoins behind every running car
whose gap to the leader is smaller than its own gap plus that loss. Cars already in the
pit lane or retired are left out. Lapped cars count a lap per lap down.
"""

from __future__ import annotations

from dataclasses import dataclass

from racedata.live.snapshot import LiveCar

DEFAULT_LAP_S = 90.0
"""Lap time used to place lapped cars when the leader has no lap time yet."""


@dataclass(frozen=True, slots=True)
class PitNow:
    position: int
    """Position after the stop, among running cars."""
    ahead: int | None
    """Car that would be just ahead after the stop."""
    behind: int | None
    margin_ahead_s: float | None
    """Seconds behind the car ahead after the stop."""
    margin_behind_s: float | None
    """Seconds ahead of the car behind after the stop."""


def _running(cars: list[LiveCar]) -> list[LiveCar]:
    return [c for c in cars if not (c.retired or c.stopped) and c.position is not None]


def race_gaps(cars: list[LiveCar]) -> dict[int, float]:
    """Seconds behind the leader for every running car (a lap down = one leader lap)."""
    running = _running(cars)
    leader = min(running, key=lambda c: c.position or 0, default=None)
    lap = (leader.last_lap_s if leader else None) or DEFAULT_LAP_S
    out: dict[int, float] = {}
    for car in running:
        if car is leader:
            out[car.number] = 0.0
        elif car.gap_s is not None:
            out[car.number] = car.gap_s
        else:
            out[car.number] = car.laps_behind * lap if car.laps_behind else lap
    return out


def pit_now(cars: list[LiveCar], pit_loss_s: float) -> dict[int, PitNow]:
    gaps = race_gaps(cars)
    out: dict[int, PitNow] = {}
    for car in _running(cars):
        if car.in_pit:
            continue
        after = gaps[car.number] + pit_loss_s
        others = sorted(
            ((gap, number) for number, gap in gaps.items() if number != car.number),
        )
        ahead = [(g, n) for g, n in others if g < after]
        behind = [(g, n) for g, n in others if g >= after]
        out[car.number] = PitNow(
            position=len(ahead) + 1,
            ahead=ahead[-1][1] if ahead else None,
            behind=behind[0][1] if behind else None,
            margin_ahead_s=round(after - ahead[-1][0], 1) if ahead else None,
            margin_behind_s=round(behind[0][0] - after, 1) if behind else None,
        )
    return out

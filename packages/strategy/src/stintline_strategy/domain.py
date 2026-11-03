"""Plain input types for the strategy engine.

The engine never sees ORM objects or provider payloads: an adapter (in ``apps/api``)
builds these frozen dataclasses. Times are seconds, laps are 1-based lap numbers.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from enum import StrEnum


class Compound(StrEnum):
    SOFT = "SOFT"
    MEDIUM = "MEDIUM"
    HARD = "HARD"
    INTERMEDIATE = "INTERMEDIATE"
    WET = "WET"
    UNKNOWN = "UNKNOWN"

    @property
    def is_dry(self) -> bool:
        return self in (Compound.SOFT, Compound.MEDIUM, Compound.HARD)


class Neutralisation(StrEnum):
    SAFETY_CAR = "SC"
    VIRTUAL_SAFETY_CAR = "VSC"
    RED_FLAG = "RED"


@dataclass(frozen=True, slots=True)
class Lap:
    """One completed (or attempted) lap of one car."""

    car: int
    lap: int
    time_s: float | None
    stint: int | None
    compound: Compound
    tyre_age: int | None
    """Laps already run on this set when the lap starts (0 = first lap on new tyres)."""
    is_pit_in: bool = False
    is_pit_out: bool = False
    end_time_s: float | None = None
    """Race time when the car crossed the line completing this lap (from the race start)."""


@dataclass(frozen=True, slots=True)
class PitStop:
    car: int
    lap: int
    """Lap on which the car entered the pit lane."""
    lane_duration_s: float | None = None


@dataclass(frozen=True, slots=True)
class NeutralisedPeriod:
    kind: Neutralisation
    lap_start: int
    lap_end: int | None
    """Last neutralised lap. ``None`` = until the end of the race."""

    def covers(self, lap: int) -> bool:
        return lap >= self.lap_start and (self.lap_end is None or lap <= self.lap_end)


@dataclass(frozen=True, slots=True)
class Race:
    """Everything the engine needs about one race."""

    name: str
    total_laps: int
    laps: tuple[Lap, ...]
    pit_stops: tuple[PitStop, ...] = ()
    neutralisations: tuple[NeutralisedPeriod, ...] = ()

    def laps_of(self, car: int) -> list[Lap]:
        return sorted((lap for lap in self.laps if lap.car == car), key=lambda x: x.lap)

    @property
    def cars(self) -> list[int]:
        return sorted({lap.car for lap in self.laps})

    def neutralised(self, lap: int) -> Neutralisation | None:
        for period in self.neutralisations:
            if period.covers(lap):
                return period.kind
        return None


def group_by_stint(laps: Iterable[Lap]) -> dict[tuple[int, int], list[Lap]]:
    """``(car, stint) -> laps`` sorted by lap number. Laps without a stint are dropped."""
    out: dict[tuple[int, int], list[Lap]] = {}
    for lap in laps:
        if lap.stint is not None:
            out.setdefault((lap.car, lap.stint), []).append(lap)
    for laps_ in out.values():
        laps_.sort(key=lambda x: x.lap)
    return out


def require_non_empty[T](items: Sequence[T], what: str) -> Sequence[T]:
    if not items:
        raise ValueError(f"{what} must not be empty")
    return items

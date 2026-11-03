"""Synthetic races with known ground truth (pace, degradation, fuel, pit loss)."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from stintline_strategy.domain import (
    Compound,
    Lap,
    Neutralisation,
    NeutralisedPeriod,
    PitStop,
    Race,
)
from stintline_strategy.fuel import FuelModel

DEFAULT_SLOPES = {Compound.SOFT: 0.12, Compound.MEDIUM: 0.07, Compound.HARD: 0.04}
DEFAULT_OFFSETS = {Compound.SOFT: -0.8, Compound.MEDIUM: 0.0, Compound.HARD: 0.5}


@dataclass(frozen=True)
class CarSpec:
    offset_s: float = 0.0
    start: Compound = Compound.MEDIUM
    stops: tuple[tuple[int, Compound], ...] = ((25, Compound.HARD),)


@dataclass
class RaceSpec:
    cars: dict[int, CarSpec]
    total_laps: int = 50
    base_s: float = 90.0
    slopes: dict[Compound, float] = field(default_factory=lambda: dict(DEFAULT_SLOPES))
    compound_offsets: dict[Compound, float] = field(default_factory=lambda: dict(DEFAULT_OFFSETS))
    fuel: FuelModel = field(default_factory=FuelModel)
    pit_loss_s: float = 22.0
    noise_s: float = 0.05
    seed: int = 0
    safety_car: tuple[int, int] | None = None
    sc_slowdown: float = 1.4
    sc_pit_loss_s: float = 15.0
    first_lap_penalty_s: float = 3.0
    quadratic: dict[Compound, float] = field(default_factory=dict)


def make_race(spec: RaceSpec) -> Race:
    rng = np.random.default_rng(spec.seed)
    laps: list[Lap] = []
    stops: list[PitStop] = []
    for car, cs in spec.cars.items():
        compound, age, stint, t = cs.start, 0, 1, 0.0
        stop_laps = dict(cs.stops)
        for n in range(1, spec.total_laps + 1):
            under_sc = spec.safety_car is not None and spec.safety_car[0] <= n <= spec.safety_car[1]
            time = (
                spec.base_s
                + cs.offset_s
                + spec.compound_offsets[compound]
                + spec.slopes[compound] * age
                + spec.quadratic.get(compound, 0.0) * age**2
                + spec.fuel.seconds_per_kg * spec.fuel.fuel_on_board_kg(n, spec.total_laps)
                + float(rng.normal(0, spec.noise_s))
            )
            if n == 1:
                time += spec.first_lap_penalty_s
            if under_sc:
                # Behind the Safety Car every car runs the same delta time: pace, tyre and
                # fuel differences disappear.
                time = spec.base_s * spec.sc_slowdown + float(rng.normal(0, spec.noise_s))
            loss = spec.sc_pit_loss_s if under_sc else spec.pit_loss_s
            is_in, is_out = n in stop_laps, (n - 1) in stop_laps
            if is_in:
                time += 0.4 * loss
                stops.append(PitStop(car, n, loss))
            if is_out:
                prev_sc = (
                    spec.safety_car is not None
                    and spec.safety_car[0] <= n - 1 <= spec.safety_car[1]
                )
                time += 0.6 * (spec.sc_pit_loss_s if prev_sc else spec.pit_loss_s)
            t += time
            laps.append(Lap(car, n, time, stint, compound, age, is_in, is_out, t))
            if is_in:
                compound, age, stint = stop_laps[n], 0, stint + 1
            else:
                age += 1
    periods = (
        (NeutralisedPeriod(Neutralisation.SAFETY_CAR, *spec.safety_car),) if spec.safety_car else ()
    )
    return Race("Synthetic Grand Prix", spec.total_laps, tuple(laps), tuple(stops), periods)


def field_of(n: int, *, gap_offset_s: float = 0.25, stop_lap: int = 25) -> dict[int, CarSpec]:
    """``n`` cars, each ``gap_offset_s`` slower per lap than the previous, staggered stops."""
    return {
        car: CarSpec(offset_s=i * gap_offset_s, stops=((stop_lap + (i % 5), Compound.HARD),))
        for i, car in enumerate(range(1, n + 1))
    }

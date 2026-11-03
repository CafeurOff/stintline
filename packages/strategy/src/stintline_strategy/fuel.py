"""Fuel-load correction.

A car gets faster as it burns fuel. To isolate tyre degradation, every lap time is
expressed at an empty tank by removing the time cost of the fuel still on board.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class FuelModel:
    """Linear fuel model.

    Attributes:
        seconds_per_kg: lap-time cost of one kilogram of fuel. Default 0.033 s/kg, the
            figure most commonly quoted by teams and engineers (0.3 to 0.35 s per 10 kg).
        start_fuel_kg: fuel on board at the start. The 2025 rules cap race fuel at 110 kg.
            Teams usually start lighter and save fuel, so 100 kg is the default.
        burn_mid_lap: evaluate the fuel load at mid-lap (True) or at the start of the lap.

    The burn rate is assumed constant over the race (``start_fuel_kg / total_laps``). The
    resulting gain per lap (~0.047 s at the Hungaroring to ~0.062 s at Monza) scales with
    lap length, because race distance is fixed.
    """

    seconds_per_kg: float = 0.033
    start_fuel_kg: float = 100.0
    burn_mid_lap: bool = True

    def __post_init__(self) -> None:
        if self.seconds_per_kg < 0 or self.start_fuel_kg < 0:
            raise ValueError("fuel parameters must be non-negative")

    def burn_per_lap_kg(self, total_laps: int) -> float:
        if total_laps <= 0:
            raise ValueError("total_laps must be positive")
        return self.start_fuel_kg / total_laps

    def gain_per_lap_s(self, total_laps: int) -> float:
        """How much faster the car gets each lap from burning fuel."""
        return self.seconds_per_kg * self.burn_per_lap_kg(total_laps)

    def fuel_on_board_kg(self, lap: int, total_laps: int) -> float:
        laps_done = lap - (0.5 if self.burn_mid_lap else 1.0)
        return max(self.start_fuel_kg - self.burn_per_lap_kg(total_laps) * laps_done, 0.0)

    def correct(self, time_s: float, lap: int, total_laps: int) -> float:
        """Lap time with the fuel effect removed (empty-tank equivalent)."""
        return time_s - self.seconds_per_kg * self.fuel_on_board_kg(lap, total_laps)

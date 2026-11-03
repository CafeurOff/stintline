"""Race pace model: ``pace(car, compound, age) = car offset + compound pace(age)``.

Compound pace comes from the pooled degradation (``new_tyre_pace + slope · age``), the
car offset is the car's median fuel-corrected residual against that field model. Fuel is
left out: both cars in a comparison carry the same fuel effect on the same lap.
"""

from __future__ import annotations

from dataclasses import dataclass
from statistics import median

from scipy import stats

from stintline_strategy.degradation import (
    CompoundDegradation,
    DegradationConfig,
    compound_degradation,
)
from stintline_strategy.domain import Compound, Race
from stintline_strategy.fuel import FuelModel
from stintline_strategy.laps import CleaningConfig, kept_laps


@dataclass(frozen=True, slots=True)
class TyreModel:
    compound: Compound
    new_tyre_pace_s: float
    slope_s_per_lap: float
    slope_se_s: float

    def lap_time(self, age: float) -> float:
        return self.new_tyre_pace_s + self.slope_s_per_lap * age

    def stint_time(self, start_age: int, laps: int) -> float:
        """Sum of lap times for ``laps`` laps starting at ``start_age`` (closed form)."""
        age_sum = laps * start_age + laps * (laps - 1) / 2
        return laps * self.new_tyre_pace_s + self.slope_s_per_lap * age_sum


@dataclass(frozen=True, slots=True)
class PaceModel:
    tyres: dict[Compound, TyreModel]
    car_offsets_s: dict[int, float]

    def lap_time(self, car: int, compound: Compound, age: float) -> float:
        return self.car_offsets_s.get(car, 0.0) + self.tyres[compound].lap_time(age)


def tyre_models(
    compounds: dict[Compound, CompoundDegradation], confidence: float = 0.95
) -> dict[Compound, TyreModel]:
    z = float(stats.norm.ppf(0.5 + confidence / 2))
    return {
        c: TyreModel(
            compound=c,
            new_tyre_pace_s=d.new_tyre_pace_s,
            slope_s_per_lap=d.slope_s_per_lap,
            slope_se_s=(d.slope_ci[1] - d.slope_ci[0]) / (2 * z),
        )
        for c, d in compounds.items()
    }


def build_pace_model(
    race: Race,
    *,
    fuel: FuelModel | None = None,
    cleaning: CleaningConfig | None = None,
    degradation: DegradationConfig | None = None,
) -> PaceModel:
    fuel = fuel or FuelModel()
    degradation = degradation or DegradationConfig()
    tyres = tyre_models(
        compound_degradation(race, fuel=fuel, cleaning=cleaning, config=degradation),
        degradation.confidence,
    )
    residuals: dict[int, list[float]] = {}
    for lap in kept_laps(race, cleaning):
        if lap.time_s is None or lap.tyre_age is None or lap.compound not in tyres:
            continue
        corrected = fuel.correct(lap.time_s, lap.lap, race.total_laps)
        residuals.setdefault(lap.car, []).append(
            corrected - tyres[lap.compound].lap_time(lap.tyre_age)
        )
    return PaceModel(tyres=tyres, car_offsets_s={car: median(r) for car, r in residuals.items()})

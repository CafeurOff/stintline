"""Pit loss per circuit, measured from real stops (never hard-coded).

Green-flag stop: ``loss = in_lap + out_lap - 2 × reference``, where ``reference`` is the
car's own median clean pace in the laps around the stop. Under a neutralisation, the
field's pace is uniform but slow, so the reference is the median time of cars that did
not pit on the same two laps.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from statistics import median

from stintline_strategy.domain import Lap, Neutralisation, PitStop, Race
from stintline_strategy.laps import MAD_TO_SIGMA, CleaningConfig, kept_laps


@dataclass(frozen=True, slots=True)
class PitLossConfig:
    """Assumptions for pit-loss estimation.

    Attributes:
        reference_window_laps: clean laps on each side of the stop used as the car's pace.
        min_reference_laps: minimum clean laps needed to trust the reference.
        outlier_k: stops further than k robust sigmas from the median are discarded
            (penalties served in the box, slow stops, damage).
        min_sigma_s: floor for the reported spread. Even very consistent pit crews and
            pit lanes vary by a few tenths.
        sc_factor: fraction of the green loss assumed under a Safety Car when no SC stop
            was observed at the circuit. The pit lane costs less because the field laps
            slower. Measured 0.74 at Bahrain 2025 (17.0 s vs 23.1 s, only SC observation
            in the reference set), hence 0.7.
        vsc_factor: same for a Virtual Safety Car. Cars run closer to racing speed than
            behind an SC, so the saving is smaller. 0.8 is an assumption, with no VSC stop
            in the reference set.
    """

    reference_window_laps: int = 5
    min_reference_laps: int = 3
    outlier_k: float = 3.0
    min_sigma_s: float = 0.5
    sc_factor: float = 0.7
    vsc_factor: float = 0.8


@dataclass(frozen=True, slots=True)
class StopLoss:
    car: int
    lap: int
    loss_s: float
    neutralisation: Neutralisation | None
    outlier: bool = False


@dataclass(frozen=True, slots=True)
class PitLossEstimate:
    green_s: float
    green_sigma_s: float
    n_green: int
    neutralised_s: dict[Neutralisation, float] = field(default_factory=dict)
    stops: tuple[StopLoss, ...] = ()
    config: PitLossConfig = field(default_factory=PitLossConfig)

    def under(self, kind: Neutralisation | None) -> float:
        """Expected loss for a stop under ``kind`` (``None`` = green flag)."""
        if kind is None:
            return self.green_s
        if kind in self.neutralised_s:
            return self.neutralised_s[kind]
        factor = (
            self.config.vsc_factor
            if kind is Neutralisation.VIRTUAL_SAFETY_CAR
            else self.config.sc_factor
        )
        return self.green_s * factor


def _robust_sigma(values: list[float]) -> float:
    centre = median(values)
    return MAD_TO_SIGMA * median(abs(v - centre) for v in values)


def stop_losses(
    race: Race, config: PitLossConfig | None = None, cleaning: CleaningConfig | None = None
) -> list[StopLoss]:
    """Loss of every measurable stop of the race (outliers flagged, not removed)."""
    config = config or PitLossConfig()
    laps = {(lap.car, lap.lap): lap for lap in race.laps}
    clean = {(lap.car, lap.lap): lap for lap in kept_laps(race, cleaning)}
    pitting = {(s.car, s.lap) for s in race.pit_stops} | {
        (s.car, s.lap + 1) for s in race.pit_stops
    }

    losses: list[StopLoss] = []
    for stop in race.pit_stops:
        in_lap, out_lap = laps.get((stop.car, stop.lap)), laps.get((stop.car, stop.lap + 1))
        if in_lap is None or out_lap is None or in_lap.time_s is None or out_lap.time_s is None:
            continue
        kind = race.neutralised(stop.lap) or race.neutralised(stop.lap + 1)
        if kind is None:
            reference = _own_reference(stop, clean, config)
        else:
            reference = _field_reference(stop, laps, pitting)
        if reference is None:
            continue
        losses.append(
            StopLoss(stop.car, stop.lap, in_lap.time_s + out_lap.time_s - 2 * reference, kind)
        )

    green = [s.loss_s for s in losses if s.neutralisation is None]
    if len(green) >= 3:
        centre, sigma = median(green), max(_robust_sigma(green), config.min_sigma_s)
        losses = [
            StopLoss(
                s.car,
                s.lap,
                s.loss_s,
                s.neutralisation,
                outlier=abs(s.loss_s - centre) > config.outlier_k * sigma,
            )
            if s.neutralisation is None
            else s
            for s in losses
        ]
    return losses


def _own_reference(
    stop: PitStop, clean: dict[tuple[int, int], Lap], config: PitLossConfig
) -> float | None:
    w = config.reference_window_laps
    window = [
        lap.time_s
        for n in [*range(stop.lap - w, stop.lap), *range(stop.lap + 2, stop.lap + 2 + w)]
        if (lap := clean.get((stop.car, n))) is not None and lap.time_s is not None
    ]
    return median(window) if len(window) >= config.min_reference_laps else None


def _field_reference(
    stop: PitStop, laps: dict[tuple[int, int], Lap], pitting: set[tuple[int, int]]
) -> float | None:
    per_lap = []
    for n in (stop.lap, stop.lap + 1):
        times = [
            lap.time_s
            for (car, lap_no), lap in laps.items()
            if lap_no == n and lap.time_s is not None and (car, n) not in pitting
        ]
        if not times:
            return None
        per_lap.append(median(times))
    return sum(per_lap) / 2


def estimate_pit_loss(
    races: list[Race] | Race,
    config: PitLossConfig | None = None,
    cleaning: CleaningConfig | None = None,
    exclude: set[tuple[int, int]] | None = None,
) -> PitLossEstimate:
    """Pool the stops of one or more races at the same circuit.

    ``exclude`` removes specific ``(car, lap)`` stops (leave-one-out validation).
    """
    config = config or PitLossConfig()
    races = [races] if isinstance(races, Race) else races
    stops = [
        s
        for race in races
        for s in stop_losses(race, config, cleaning)
        if (s.car, s.lap) not in (exclude or set())
    ]
    green = [s.loss_s for s in stops if s.neutralisation is None and not s.outlier]
    if not green:
        raise ValueError("no measurable green-flag pit stop")
    neutralised: dict[Neutralisation, list[float]] = {}
    for s in stops:
        if s.neutralisation is not None:
            neutralised.setdefault(s.neutralisation, []).append(s.loss_s)
    sigma = _robust_sigma(green) if len(green) > 1 else 0.0
    return PitLossEstimate(
        green_s=median(green),
        green_sigma_s=max(sigma, config.min_sigma_s)
        if not math.isnan(sigma)
        else config.min_sigma_s,
        n_green=len(green),
        neutralised_s={k: median(v) for k, v in neutralised.items()},
        stops=tuple(stops),
        config=config,
    )

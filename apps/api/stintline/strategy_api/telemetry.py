"""ORM to engine adapter for lap telemetry (ADR 0013): stored samples in, aligned traces,
braking zones and time deltas out."""

from __future__ import annotations

from typing import Any

import numpy as np

from stintline.racing.geometry import normalise_outline
from stintline.racing.models import Session, TelemetryLap
from stintline_strategy import telemetry as engine

MAX_TELEMETRY_CARS = 3


class TelemetryUnavailableError(LookupError):
    """A requested car has no stored telemetry for this session."""


def stored_laps(session: Session) -> list[TelemetryLap]:
    """Every stored lap of the session, fastest first."""
    return list(
        TelemetryLap.objects.filter(entry__session=session)
        .select_related("entry__driver__portrait", "entry__team")
        .order_by("lap_time_s")
    )


def lap_samples(lap: TelemetryLap) -> engine.LapSamples:
    car, pos = lap.samples, lap.positions

    def arr(values: list[Any]) -> np.ndarray[Any, np.dtype[np.float64]]:
        return np.asarray(values, dtype=np.float64)

    return engine.LapSamples(
        t_s=arr(car["t"]),
        speed_kph=arr(car["speed"]),
        throttle_pct=arr(car["throttle"]),
        brake=np.asarray(car["brake"], dtype=bool),
        gear=arr(car["gear"]),
        drs=arr(car["drs"]),
        pos_t_s=arr(pos["t"]),
        x=arr(pos["x"]),
        y=arr(pos["y"]),
        lap_time_s=lap.lap_time_s,
    )


def _rounded(values: Any, digits: int = 0) -> list[float]:
    return [round(float(v), digits) for v in values]


def _to_screen(cars: list[dict[str, Any]]) -> tuple[int, int]:
    """Every position (laps and braking zones) in the circuit drawing's screen box, the
    same one as ``/sessions/{id}/track``. Returns the box width and height."""
    points: list[list[float]] = []
    for car in cars:
        points += [[x, y] for x, y in zip(car["x"], car["y"], strict=True)]
        points += [[z["x"], z["y"]] for z in car["braking_zones"]]
    shape = normalise_outline(points)
    flat = iter(shape.points)
    for car in cars:
        laps = [next(flat) for _ in car["x"]]
        car["x"] = [p[0] for p in laps]
        car["y"] = [p[1] for p in laps]
        for zone in car["braking_zones"]:
            zone["x"], zone["y"] = next(flat)
    return shape.width, shape.height


def compare(session: Session, cars: list[int]) -> dict[str, Any]:
    """Fastest laps of ``cars`` on one distance grid. The first car is the reference of the
    time deltas.

    Raises:
        TelemetryUnavailableError: a car has no stored lap.
        engine.TelemetryError: a stored lap cannot be used.
    """
    by_car = {lap.entry.car_number: lap for lap in stored_laps(session)}
    missing = [car for car in cars if car not in by_car]
    if missing:
        raise TelemetryUnavailableError(f"no telemetry for car {missing[0]}")
    samples = [lap_samples(by_car[car]) for car in cars]
    length = float(np.mean([engine.natural_length(s) for s in samples]))
    traces = [engine.trace(s, length) for s in samples]
    size = min(len(t.distance_m) for t in traces)
    reference = traces[0]
    out_cars = []
    for car, lap, item in zip(cars, (by_car[c] for c in cars), traces, strict=True):
        zones = engine.braking_zones(item)
        out_cars.append(
            {
                "car_number": car,
                "entry": lap.entry,
                "lap_number": lap.lap_number,
                "lap_time_s": lap.lap_time_s,
                "max_speed_kph": float(item.speed_kph.max()),
                "full_throttle_share": engine.full_throttle_share(item),
                "speed_kph": _rounded(item.speed_kph[:size]),
                "throttle_pct": _rounded(item.throttle_pct[:size]),
                "brake": [bool(b) for b in item.brake[:size]],
                "gear": [int(g) for g in item.gear[:size]],
                "drs_open": [bool(d) for d in item.drs_open[:size]],
                "x": _rounded(item.x[:size], 1),
                "y": _rounded(item.y[:size], 1),
                "delta_s": _rounded(engine.time_delta(reference, item)[:size], 3),
                "braking_zones": [
                    {
                        "start_m": round(z.start_m),
                        "end_m": round(z.end_m),
                        "entry_kph": round(z.entry_kph),
                        "min_kph": round(z.min_kph),
                        "x": round(z.x, 1),
                        "y": round(z.y, 1),
                    }
                    for z in zones
                ],
            }
        )
    width, height = _to_screen(out_cars)
    return {
        "width": width,
        "height": height,
        "length_m": round(length),
        "step_m": engine.DEFAULT_CONFIG.step_m,
        "points": size,
        "cars": out_cars,
    }

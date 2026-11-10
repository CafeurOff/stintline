"""Lap telemetry: distance, resampling, braking zones and time lost or gained along a lap.

Inputs are one lap of car data (OpenF1 ``car_data``, about 3.7 Hz: speed, throttle, brake
on/off, gear, DRS) and the car's positions on the circuit plane over the same lap. There is
no distance channel upstream, so distance is integrated from speed. Two integrated laps
never have exactly the same length (sampling, slightly different lines), so laps are
compared on the fraction of the lap and drawn on a common length.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

FloatArray = NDArray[np.float64]


@dataclass(frozen=True, slots=True)
class TelemetryConfig:
    """Attributes:
    step_m: distance between two resampled points. 10 m keeps every braking zone (the
        shortest are ~40 m) and makes a 5 km lap 500 points per channel.
    min_brake_s: a braking zone lasts at least this long. Shorter brake signals are
        dabs or sensor noise at 3.7 Hz (a single sample is ~0.27 s).
    merge_gap_m: two brake applications closer than this are one zone (a driver
        releasing and re-applying in the same corner).
    max_samples_gap_s: a lap with a hole longer than this in its car data is refused:
        integrating speed across it would misplace everything after it.
    """

    step_m: float = 10.0
    min_brake_s: float = 0.3
    merge_gap_m: float = 30.0
    max_samples_gap_s: float = 2.0


DEFAULT_CONFIG = TelemetryConfig()
KPH_TO_MS = 1 / 3.6
MIN_SAMPLES = 20


class TelemetryError(ValueError):
    """The samples cannot describe a lap (too few, unordered or with holes)."""


@dataclass(frozen=True, slots=True)
class LapSamples:
    """Raw samples of one lap. Times are seconds from the start of the lap."""

    t_s: FloatArray
    speed_kph: FloatArray
    throttle_pct: FloatArray
    brake: NDArray[np.bool_]
    gear: FloatArray
    drs: FloatArray
    pos_t_s: FloatArray
    x: FloatArray
    y: FloatArray
    lap_time_s: float


@dataclass(frozen=True, slots=True)
class Trace:
    """A lap on a regular distance grid (``distance_m``), every channel aligned."""

    distance_m: FloatArray
    t_s: FloatArray
    speed_kph: FloatArray
    throttle_pct: FloatArray
    brake: NDArray[np.bool_]
    gear: FloatArray
    drs_open: NDArray[np.bool_]
    x: FloatArray
    y: FloatArray

    @property
    def length_m(self) -> float:
        return float(self.distance_m[-1])


@dataclass(frozen=True, slots=True)
class BrakingZone:
    start_m: float
    end_m: float
    entry_kph: float
    """Speed when the brake goes on."""
    min_kph: float
    """Lowest speed before the throttle comes back: the corner's apex speed."""
    x: float
    y: float
    """Where the brake goes on, on the circuit plane."""


def _check(samples: LapSamples, config: TelemetryConfig) -> None:
    t = samples.t_s
    if len(t) < MIN_SAMPLES:
        raise TelemetryError(f"only {len(t)} car samples")
    if np.any(np.diff(t) <= 0):
        raise TelemetryError("car samples are not in time order")
    gaps = np.diff(np.concatenate(([0.0], t, [samples.lap_time_s])))
    if float(gaps.max()) > config.max_samples_gap_s:
        raise TelemetryError(f"a {gaps.max():.1f} s hole in the car samples")
    if len(samples.pos_t_s) < 2:
        raise TelemetryError("no positions for this lap")


def lap_distance(samples: LapSamples) -> FloatArray:
    """Distance from the line at each sample, by trapezoidal integration of speed. The
    first sample is extrapolated back to the line at its own speed."""
    v = samples.speed_kph * KPH_TO_MS
    steps = np.diff(samples.t_s) * (v[1:] + v[:-1]) / 2
    start = samples.t_s[0] * v[0]
    return np.concatenate(([start], start + np.cumsum(steps)))


def trace(
    samples: LapSamples, length_m: float | None = None, config: TelemetryConfig = DEFAULT_CONFIG
) -> Trace:
    """Resample a lap on a regular grid. With ``length_m`` the lap is stretched to that
    length, so two laps line up corner by corner."""
    _check(samples, config)
    raw = lap_distance(samples)
    end = raw[-1] + (samples.lap_time_s - samples.t_s[-1]) * samples.speed_kph[-1] * KPH_TO_MS
    fraction = raw / end
    total = end if length_m is None else length_m
    grid = np.arange(0.0, total, config.step_m)
    at = grid / total

    def on_grid(values: FloatArray) -> FloatArray:
        return np.interp(at, fraction, values)

    def nearest(values: FloatArray) -> FloatArray:
        index = np.clip(np.searchsorted(fraction, at), 0, len(fraction) - 1)
        return values[index]

    t = np.interp(
        at,
        np.concatenate(([0.0], fraction, [1.0])),
        np.concatenate(([0.0], samples.t_s, [samples.lap_time_s])),
    )
    return Trace(
        distance_m=grid,
        t_s=t,
        speed_kph=on_grid(samples.speed_kph),
        throttle_pct=on_grid(samples.throttle_pct),
        brake=nearest(samples.brake.astype(np.float64)) > 0.5,
        gear=nearest(samples.gear),
        drs_open=nearest(samples.drs) >= 10,
        x=np.interp(t, samples.pos_t_s, samples.x),
        y=np.interp(t, samples.pos_t_s, samples.y),
    )


def natural_length(samples: LapSamples, config: TelemetryConfig = DEFAULT_CONFIG) -> float:
    _check(samples, config)
    raw = lap_distance(samples)
    return float(
        raw[-1] + (samples.lap_time_s - samples.t_s[-1]) * samples.speed_kph[-1] * KPH_TO_MS
    )


def braking_zones(lap: Trace, config: TelemetryConfig = DEFAULT_CONFIG) -> list[BrakingZone]:
    """Where the driver brakes, from the brake channel, with entry and minimum speed."""
    on = lap.brake.astype(np.int8)
    edges = np.diff(np.concatenate(([0], on, [0])))
    starts = [int(i) for i in np.flatnonzero(edges == 1)]
    ends = [int(i) for i in np.flatnonzero(edges == -1)]
    spans: list[tuple[int, int]] = []
    for first, last in zip(starts, ends, strict=True):
        if spans and lap.distance_m[first] - lap.distance_m[spans[-1][1] - 1] < config.merge_gap_m:
            spans[-1] = (spans[-1][0], last)
        else:
            spans.append((first, last))
    zones: list[BrakingZone] = []
    for start, end in spans:
        duration = lap.t_s[min(end, len(lap.t_s) - 1)] - lap.t_s[start]
        if duration < config.min_brake_s:
            continue
        # Apex: lowest speed between the brake and the next full throttle application.
        after = np.flatnonzero(lap.throttle_pct[end:] >= 99)
        apex_end = end + (int(after[0]) if len(after) else 0) + 1
        zones.append(
            BrakingZone(
                start_m=float(lap.distance_m[start]),
                end_m=float(lap.distance_m[end - 1]),
                entry_kph=float(lap.speed_kph[start]),
                min_kph=float(lap.speed_kph[start:apex_end].min()),
                x=float(lap.x[start]),
                y=float(lap.y[start]),
            )
        )
    return zones


def time_delta(reference: Trace, other: Trace) -> FloatArray:
    """Seconds ``other`` is behind ``reference`` at each point (negative when ahead). Both
    traces must share the same grid (built with the same ``length_m``)."""
    size = min(len(reference.t_s), len(other.t_s))
    return other.t_s[:size] - reference.t_s[:size]


def full_throttle_share(lap: Trace) -> float:
    """Share of the lap distance at full throttle (≥ 99 %)."""
    return float(np.mean(lap.throttle_pct >= 99))

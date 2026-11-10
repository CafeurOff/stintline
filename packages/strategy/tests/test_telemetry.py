"""Lap telemetry on synthetic laps whose distance, corners and timing are known exactly."""

from __future__ import annotations

import dataclasses

import numpy as np
import pytest

from stintline_strategy.telemetry import (
    LapSamples,
    TelemetryConfig,
    TelemetryError,
    braking_zones,
    full_throttle_share,
    lap_distance,
    natural_length,
    time_delta,
    trace,
)

HZ = 4.0


def lap(
    speed_kph: float = 180.0,
    lap_time_s: float = 60.0,
    corner: tuple[float, float] | None = None,
    slow_kph: float = 80.0,
) -> LapSamples:
    """A lap at constant speed, optionally with one braking corner between two times."""
    t = np.arange(0.125, lap_time_s, 1 / HZ)
    speed = np.full_like(t, speed_kph)
    throttle = np.full_like(t, 100.0)
    brake = np.zeros_like(t, dtype=bool)
    if corner is not None:
        start, end = corner
        inside = (t >= start) & (t < end)
        speed[inside] = np.linspace(speed_kph, slow_kph, int(inside.sum()))
        throttle[inside] = 0.0
        brake[inside] = True
        after = (t >= end) & (t < end + 2)
        throttle[after] = 50.0
        speed[after] = slow_kph
    angle = 2 * np.pi * t / lap_time_s
    return LapSamples(
        t_s=t,
        speed_kph=speed,
        throttle_pct=throttle,
        brake=brake,
        gear=np.full_like(t, 7.0),
        drs=np.zeros_like(t),
        pos_t_s=t,
        x=np.cos(angle) * 1000,
        y=np.sin(angle) * 1000,
        lap_time_s=lap_time_s,
    )


def test_lap_distance_integrates_speed() -> None:
    samples = lap(speed_kph=180.0, lap_time_s=60.0)

    distance = lap_distance(samples)

    assert distance[-1] == pytest.approx(50.0 * samples.t_s[-1])
    assert natural_length(samples) == pytest.approx(3000.0)


def test_trace_is_regular_and_ends_with_the_lap() -> None:
    resampled = trace(lap(), config=TelemetryConfig(step_m=10.0))

    assert np.allclose(np.diff(resampled.distance_m), 10.0)
    assert resampled.length_m == pytest.approx(2990.0)
    assert resampled.t_s[0] == pytest.approx(0.0)
    assert resampled.t_s[-1] == pytest.approx(59.8, abs=0.01)


def test_trace_stretches_to_a_common_length() -> None:
    resampled = trace(lap(), length_m=4000.0)

    assert resampled.length_m == pytest.approx(3990.0)
    assert resampled.t_s[-1] == pytest.approx(60.0 * 3990 / 4000, abs=0.01)


def test_braking_zone_has_entry_and_apex_speed() -> None:
    resampled = trace(lap(corner=(20.0, 23.0)))

    [zone] = braking_zones(resampled)

    assert zone.start_m == pytest.approx(1000.0, abs=15.0)
    assert zone.entry_kph == pytest.approx(180.0, abs=5.0)
    assert zone.min_kph == pytest.approx(80.0, abs=5.0)
    assert np.hypot(zone.x, zone.y) == pytest.approx(1000.0, rel=0.01)


def test_short_brake_dabs_are_ignored() -> None:
    resampled = trace(lap(corner=(20.0, 20.2)))

    assert braking_zones(resampled) == []


def test_close_brake_applications_merge_into_one_zone() -> None:
    samples = lap(corner=(20.0, 23.0))
    brake = samples.brake.copy()
    brake[(samples.t_s > 21.0) & (samples.t_s < 21.3)] = False

    zones = braking_zones(trace(dataclasses.replace(samples, brake=brake)))

    assert len(zones) == 1


def test_time_delta_grows_where_a_slower_lap_loses_time() -> None:
    fast = lap(speed_kph=180.0, lap_time_s=60.0)
    slow = lap(speed_kph=175.0, lap_time_s=60.0 * 180 / 175)
    length = natural_length(fast)

    delta = time_delta(trace(fast, length), trace(slow, length))

    assert delta[0] == pytest.approx(0.0, abs=0.01)
    assert np.all(np.diff(delta) >= -1e-9)
    assert delta[-1] == pytest.approx(60.0 * 180 / 175 - 60.0, abs=0.05)


def test_full_throttle_share() -> None:
    assert full_throttle_share(trace(lap())) == 1.0
    assert full_throttle_share(trace(lap(corner=(20.0, 23.0)))) < 1.0


@pytest.mark.parametrize("problem", ["few", "unordered", "hole", "no positions"])
def test_trace_refuses_unusable_laps(problem: str) -> None:
    samples = lap()
    t = samples.t_s.copy()
    if problem == "few":
        samples = lap(lap_time_s=4.0)
    elif problem == "unordered":
        t[5], t[6] = t[6], t[5]
        samples = dataclasses.replace(samples, t_s=t)
    elif problem == "hole":
        samples = dataclasses.replace(samples, t_s=np.where(t > 30, t + 5, t), lap_time_s=65.0)
    else:
        samples = dataclasses.replace(samples, pos_t_s=np.array([0.0]))

    with pytest.raises(TelemetryError):
        trace(samples)

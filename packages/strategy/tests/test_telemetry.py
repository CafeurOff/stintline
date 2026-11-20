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
    elevation,
    full_throttle_share,
    lap_distance,
    natural_length,
    plane_scale,
    time_delta,
    time_gap_to_distance,
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


def test_plane_scale_is_metres_per_drawn_unit() -> None:
    circle = trace(lap(speed_kph=180.0, lap_time_s=60.0))  # 3 km on a 1000-unit radius

    assert plane_scale(circle) == pytest.approx(3000.0 / (2 * np.pi * 1000), rel=0.01)


def test_elevation_is_metres_above_the_lowest_point() -> None:
    base = lap()
    hill = dataclasses.replace(base, z=np.sin(2 * np.pi * base.t_s / base.lap_time_s) * 100)

    profile = elevation(trace(hill))

    assert profile is not None
    assert profile.min() == pytest.approx(0.0)
    assert profile.max() == pytest.approx(200 * 3000.0 / (2 * np.pi * 1000), rel=0.02)


def test_elevation_is_none_without_altitude() -> None:
    assert elevation(trace(lap())) is None


def test_gap_in_metres_follows_the_slower_car() -> None:
    fast = trace(lap(speed_kph=180.0, lap_time_s=60.0), length_m=3000.0)
    slow = trace(lap(speed_kph=180.0, lap_time_s=66.0), length_m=3000.0)

    gap = time_gap_to_distance(fast, slow)

    # Halfway, the fast car is at 1500 m after 30 s; the slow one is at 30/66 of the lap.
    half = len(gap) // 2
    assert gap[0] == pytest.approx(0.0, abs=1.0)
    assert gap[half] == pytest.approx(1500.0 - 3000.0 * 30 / 66, rel=0.02)
    assert np.all(np.diff(gap) >= -1e-6)


def test_plane_scale_refuses_a_still_car() -> None:
    still = dataclasses.replace(lap(), x=np.zeros(240), y=np.zeros(240))

    with pytest.raises(TelemetryError):
        plane_scale(trace(still))


def test_positions_carry_on_to_the_line_before_the_first_sample() -> None:
    base = lap(speed_kph=180.0, lap_time_s=60.0)
    late = dataclasses.replace(base, pos_t_s=base.pos_t_s[2:-2], x=base.x[2:-2], y=base.y[2:-2])

    first = trace(late)

    # The circle starts at (1000, 0): extrapolated back, not held at the first sample.
    assert first.x[0] == pytest.approx(1000.0, abs=5.0)
    assert first.y[0] == pytest.approx(0.0, abs=15.0)
    assert first.y[0] < late.y[0]

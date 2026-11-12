"""Race analysis figures: pace distributions, consistency, on-track passes, laps led and
the undercuts that were actually tried in a race.

Everything here reads a :class:`Race` (and optionally the lap cleaning); nothing is fitted.
The assumptions are named parameters documented in ``docs/model.md``.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass

import numpy as np

from stintline_strategy.domain import Lap, Race
from stintline_strategy.fuel import FuelModel
from stintline_strategy.laps import MAD_TO_SIGMA, CleanLap
from stintline_strategy.pit_exit import race_order_at

# ------------------------------------------------------------------ pace distributions


@dataclass(frozen=True, slots=True)
class PaceFilter:
    """Which laps a pace chart keeps (the user can change every field).

    Attributes:
        include_pit_laps: keep in-laps and out-laps (off by default: they hold the stop).
        include_neutralised: keep laps under SC, VSC or red flag and the restart lap.
        cutoff_pct: drop laps slower than this percentage of the race's fastest lap. 107 %
            mirrors the qualifying rule fans know; it removes traffic jams, damage and
            slow laps a pit or neutralisation flag missed. ``None`` keeps every lap.
        fuel_corrected: express laps at an empty tank with the engine's :class:`FuelModel`
            so the first and last stints compare on tyres and driver alone.

    Lap 1 (standing start) and laps without a time are never kept.
    """

    include_pit_laps: bool = False
    include_neutralised: bool = False
    cutoff_pct: float | None = 107.0
    fuel_corrected: bool = True

    def __post_init__(self) -> None:
        if self.cutoff_pct is not None and self.cutoff_pct < 100:
            raise ValueError("cutoff_pct must be at least 100")


@dataclass(frozen=True, slots=True)
class PaceLap:
    car: int
    lap: int
    time_s: float
    value_s: float
    """The time shown on the chart: raw or fuel-corrected, depending on the filter."""
    kept: bool


@dataclass(frozen=True, slots=True)
class BoxSummary:
    """Tukey box plot of a set of lap times."""

    n: int
    median_s: float
    q1_s: float
    q3_s: float
    low_s: float
    """Lowest value within ``whisker_iqr`` interquartile ranges below Q1."""
    high_s: float
    mean_s: float
    std_s: float
    outliers_s: tuple[float, ...]


WHISKER_IQR = 1.5
"""Tukey's convention: whiskers reach the furthest point within 1.5 IQR of the box."""


def box_summary(values: Sequence[float], whisker_iqr: float = WHISKER_IQR) -> BoxSummary:
    if not values:
        raise ValueError("a box summary needs at least one value")
    y = np.sort(np.asarray(values, dtype=float))
    q1, median, q3 = (float(v) for v in np.percentile(y, [25, 50, 75]))
    reach = whisker_iqr * (q3 - q1)
    inside = y[(y >= q1 - reach) & (y <= q3 + reach)]
    return BoxSummary(
        n=len(y),
        median_s=median,
        q1_s=q1,
        q3_s=q3,
        low_s=float(inside.min()),
        high_s=float(inside.max()),
        mean_s=float(y.mean()),
        std_s=float(y.std(ddof=1)) if len(y) > 1 else 0.0,
        outliers_s=tuple(float(v) for v in y if v < q1 - reach or v > q3 + reach),
    )


def _after_restart(race: Race, lap: int) -> bool:
    return any(p.lap_end is not None and lap == p.lap_end + 1 for p in race.neutralisations)


def pace_laps(race: Race, fuel: FuelModel, flt: PaceFilter) -> list[PaceLap]:
    """Every timed lap after lap 1, flagged kept or not by ``flt``."""
    timed = sorted(
        ((lap, lap.time_s) for lap in race.laps if lap.time_s is not None and lap.lap > 1),
        key=lambda x: (x[0].car, x[0].lap),
    )
    if not timed:
        return []
    fastest = min(time for _, time in timed)
    limit = fastest * flt.cutoff_pct / 100 if flt.cutoff_pct is not None else None
    out: list[PaceLap] = []
    for lap, time in timed:
        pit = lap.is_pit_in or lap.is_pit_out
        neutral = race.neutralised(lap.lap) is not None or _after_restart(race, lap.lap)
        kept = (
            (flt.include_pit_laps or not pit)
            and (flt.include_neutralised or not neutral)
            and (limit is None or time <= limit)
        )
        value = fuel.correct(time, lap.lap, race.total_laps) if flt.fuel_corrected else time
        out.append(PaceLap(lap.car, lap.lap, time, value, kept))
    return out


# ------------------------------------------------------------------------ consistency


@dataclass(frozen=True, slots=True)
class ConsistencyConfig:
    """Attributes:
    min_stint_laps: clean laps a stint needs before its trend is removed. Below that a
        straight line through 2-3 points absorbs the noise we want to measure.
    min_laps: clean laps a car needs for a consistency figure at all.
    """

    min_stint_laps: int = 4
    min_laps: int = 8


def consistency_s(
    laps: Iterable[Lap],
    race: Race,
    fuel: FuelModel,
    config: ConsistencyConfig | None = None,
) -> float | None:
    """Lap-to-lap scatter of one car's clean laps, in seconds.

    Each stint's straight-line trend (tyre wear, the remaining fuel effect) is removed
    first, so a driver is not called inconsistent because tyres degrade. The scatter is a
    robust standard deviation (MAD × 1.4826) of the pooled residuals: one lost lap in
    traffic does not dominate it. ``None`` when there are too few laps.
    """
    config = config or ConsistencyConfig()
    by_stint: dict[int, list[tuple[int, float]]] = {}
    for lap in laps:
        if lap.time_s is None or lap.stint is None:
            continue
        corrected = fuel.correct(lap.time_s, lap.lap, race.total_laps)
        by_stint.setdefault(lap.stint, []).append((lap.lap, corrected))
    residuals: list[float] = []
    for points in by_stint.values():
        if len(points) < config.min_stint_laps:
            continue
        x = np.array([p[0] for p in points], dtype=float)
        y = np.array([p[1] for p in points], dtype=float)
        slope, intercept = np.polyfit(x, y, 1)
        residuals.extend((y - (slope * x + intercept)).tolist())
    if len(residuals) < config.min_laps:
        return None
    r = np.asarray(residuals)
    return float(MAD_TO_SIGMA * np.median(np.abs(r - np.median(r))))


def kept_by_car(cleaned: Iterable[CleanLap]) -> dict[int, list[Lap]]:
    out: dict[int, list[Lap]] = {}
    for c in cleaned:
        if c.kept:
            out.setdefault(c.lap.car, []).append(c.lap)
    return out


# -------------------------------------------------------------- passes and laps led


@dataclass(frozen=True, slots=True)
class Pass:
    lap: int
    car: int
    """The car that moved ahead."""
    passed: int


def _pit_involved(lap: Lap | None) -> bool:
    return lap is None or lap.is_pit_in or lap.is_pit_out


def on_track_passes(race: Race) -> list[Pass]:
    """Order changes at the line between consecutive green-flag laps.

    A pair of cars that swapped places between the end of lap ``L - 1`` and the end of
    lap ``L`` counts as one pass, unless either car pitted (in-lap or out-lap) on ``L`` or
    ``L - 1``, lap ``L`` was neutralised or a restart lap, or ``L`` is lap 1 (no timed
    order before it). Retirements are not passes: both cars must complete both laps.
    """
    by_key = {(lap.car, lap.lap): lap for lap in race.laps}
    out: list[Pass] = []
    previous = [car for car, _ in race_order_at(race, 1)]
    for n in range(2, race.total_laps + 1):
        current = [car for car, _ in race_order_at(race, n)]
        if race.neutralised(n) is None and not _after_restart(race, n):
            out.extend(_swaps(previous, current, n, by_key))
        previous = current
    return out


def _swaps(
    before: list[int], after: list[int], lap: int, by_key: dict[tuple[int, int], Lap]
) -> list[Pass]:
    clean = [
        car
        for car in after
        if car in before
        and not _pit_involved(by_key.get((car, lap)))
        and not _pit_involved(by_key.get((car, lap - 1)))
    ]
    rank_before = {car: before.index(car) for car in clean}
    rank_after = {car: after.index(car) for car in clean}
    return [
        Pass(lap, a, b)
        for a in clean
        for b in clean
        if rank_before[a] > rank_before[b] and rank_after[a] < rank_after[b]
    ]


def laps_led(race: Race) -> dict[int, int]:
    """Laps each car completed in the lead (first across the line)."""
    out: dict[int, int] = {}
    for n in range(1, race.total_laps + 1):
        order = race_order_at(race, n)
        if order:
            leader = order[0][0]
            out[leader] = out.get(leader, 0) + 1
    return out


# ---------------------------------------------------------------- undercut history


@dataclass(frozen=True, slots=True)
class UndercutConfig:
    """What counts as an undercut attempt in a real race.

    Attributes:
        max_gap_s: the attacker is at most this far behind the car directly ahead at the
            end of the lap before it pits. 3 s is about the most an undercut can make up at
            a typical circuit (a new-tyre advantage of 1-2 s on the out-lap plus the
            rival's slower in-lap); beyond that an early stop is usually about traffic or
            tyre failure, not the car ahead.
        max_reply_laps: the car ahead pits within this many laps after the attacker. Teams
            usually cover an undercut on the next lap or two; three keeps late replies
            while leaving out unrelated stops later in the race.
    """

    max_gap_s: float = 3.0
    max_reply_laps: int = 3


@dataclass(frozen=True, slots=True)
class UndercutAttempt:
    attacker: int
    defender: int
    attacker_lap: int
    """Lap on which the attacker entered the pits."""
    defender_lap: int
    gap_before_s: float
    """Attacker behind by this much at the end of ``attacker_lap - 1``."""
    gap_after_s: float
    """Attacker's race time minus the defender's at the end of the defender's out-lap.
    Negative means the attacker is ahead."""

    @property
    def gain_s(self) -> float:
        return self.gap_before_s - self.gap_after_s

    @property
    def success(self) -> bool:
        return self.gap_after_s < 0


def undercut_attempts(race: Race, config: UndercutConfig | None = None) -> list[UndercutAttempt]:
    """Every green-flag undercut tried in the race and whether it worked.

    The attacker pits on lap ``L`` while within ``max_gap_s`` of the car directly ahead
    at the end of ``L - 1``. The car ahead pits on lap ``L < M <= L + max_reply_laps``.
    The outcome is the order at the end of lap ``M + 1`` (the defender's out-lap). Stops
    on a neutralised lap, or whose out-lap is neutralised, are left out: a safety car, not
    the undercut, decides those.
    """
    config = config or UndercutConfig()
    stops: dict[int, list[int]] = {}
    for lap in race.laps:
        if lap.is_pit_in:
            stops.setdefault(lap.car, []).append(lap.lap)
    times = {(lap.car, lap.lap): lap.end_time_s for lap in race.laps}

    def green(lap: int) -> bool:
        return race.neutralised(lap) is None and race.neutralised(lap + 1) is None

    out: list[UndercutAttempt] = []
    for attacker, laps_in in stops.items():
        for pit_lap in laps_in:
            if pit_lap < 2 or not green(pit_lap):
                continue
            order = race_order_at(race, pit_lap - 1)
            cars = [car for car, _ in order]
            if attacker not in cars or cars.index(attacker) == 0:
                continue
            index = cars.index(attacker)
            defender, defender_time = order[index - 1]
            gap = order[index][1] - defender_time
            if gap > config.max_gap_s:
                continue
            reply = next(
                (
                    m
                    for m in stops.get(defender, [])
                    if pit_lap < m <= pit_lap + config.max_reply_laps
                ),
                None,
            )
            if reply is None or not green(reply):
                continue
            a_after = times.get((attacker, reply + 1))
            d_after = times.get((defender, reply + 1))
            if a_after is None or d_after is None:
                continue
            out.append(UndercutAttempt(attacker, defender, pit_lap, reply, gap, a_after - d_after))
    return sorted(out, key=lambda u: (u.attacker_lap, u.attacker))

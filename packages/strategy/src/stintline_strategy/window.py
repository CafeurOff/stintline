"""Optimal pit window for one- and two-stop strategies.

Total race time of a plan = Σ stints (compound pace at each tyre age) + stops × pit loss.
Car offset and fuel are identical across plans for a given car, so they cancel. Stint
cost has a closed form (linear degradation), which makes exhaustive search cheap.
"""

from __future__ import annotations

from dataclasses import dataclass
from itertools import pairwise, product

from stintline_strategy.domain import Compound
from stintline_strategy.pace import TyreModel


@dataclass(frozen=True, slots=True)
class WindowConfig:
    """Attributes:
    min_stint_laps: shortest allowed stint (shorter stints are never strategic).
    max_stint_laps: longest allowed stint (tyre life limits, mandated maxima such as
        Qatar 2023). ``None`` = unlimited.
    window_tolerance_s: stop laps whose plan is within this time of the best plan form
        the "window". 1 s is about the margin teams consider equivalent.
    require_two_dry_compounds: dry-race rule (two different compounds must be used).
    """

    min_stint_laps: int = 5
    max_stint_laps: int | None = None
    window_tolerance_s: float = 1.0
    require_two_dry_compounds: bool = True


@dataclass(frozen=True, slots=True)
class Plan:
    stops: tuple[tuple[int, Compound], ...]
    """``(in-lap, compound fitted)`` for each stop."""
    total_time_s: float
    delta_to_best_s: float = 0.0


@dataclass(frozen=True, slots=True)
class WindowResult:
    best: Plan
    plans: tuple[Plan, ...]
    """Every evaluated plan within tolerance of the best, best first."""
    first_stop_window: tuple[int, int]


def _plans(
    n_stops: int,
    *,
    current_lap: int,
    total_laps: int,
    start: tuple[Compound, int],
    tyres: dict[Compound, TyreModel],
    pit_loss_s: float,
    config: WindowConfig,
    used: frozenset[Compound],
) -> list[Plan]:
    plans: list[Plan] = []
    stop_ranges = [range(current_lap + 1, total_laps)] * n_stops
    for stop_laps in product(*stop_ranges):
        if list(stop_laps) != sorted(set(stop_laps)):
            continue
        bounds = [current_lap, *stop_laps, total_laps]
        lengths = [b - a for a, b in pairwise(bounds)]
        if min(lengths[1:]) < config.min_stint_laps or (
            config.max_stint_laps and max(lengths) > config.max_stint_laps
        ):
            continue
        for compounds in product(tyres, repeat=n_stops):
            all_used = used | {start[0], *compounds}
            if config.require_two_dry_compounds and len({c for c in all_used if c.is_dry}) < 2:
                continue
            total = tyres[start[0]].stint_time(start[1], lengths[0])
            total += sum(
                tyres[c].stint_time(0, n) for c, n in zip(compounds, lengths[1:], strict=True)
            )
            plans.append(
                Plan(tuple(zip(stop_laps, compounds, strict=True)), total + n_stops * pit_loss_s)
            )
    return plans


def optimal_window(
    total_laps: int,
    tyres: dict[Compound, TyreModel],
    pit_loss_s: float,
    *,
    current_lap: int = 0,
    current_compound: Compound,
    current_tyre_age: int = 0,
    compounds_used: frozenset[Compound] = frozenset(),
    max_stops: int = 2,
    config: WindowConfig | None = None,
) -> WindowResult:
    """Best one- or two-stop plan from ``current_lap`` and the window of first-stop laps."""
    config = config or WindowConfig()
    if current_compound not in tyres:
        raise ValueError(f"no tyre model for {current_compound}")
    plans: list[Plan] = []
    for n in range(1, max_stops + 1):
        plans += _plans(
            n,
            current_lap=current_lap,
            total_laps=total_laps,
            start=(current_compound, current_tyre_age),
            tyres=tyres,
            pit_loss_s=pit_loss_s,
            config=config,
            used=compounds_used,
        )
    if not plans:
        raise ValueError("no feasible strategy with these constraints")
    best_time = min(p.total_time_s for p in plans)
    near = sorted(
        (
            Plan(p.stops, p.total_time_s, p.total_time_s - best_time)
            for p in plans
            if p.total_time_s - best_time <= config.window_tolerance_s
        ),
        key=lambda p: p.total_time_s,
    )
    best = near[0]
    same_shape = [p.stops[0][0] for p in near if len(p.stops) == len(best.stops)]
    return WindowResult(
        best=best, plans=tuple(near), first_stop_window=(min(same_shape), max(same_shape))
    )

import itertools

import pytest

from stintline_strategy.domain import Compound
from stintline_strategy.pace import TyreModel
from stintline_strategy.window import WindowConfig, optimal_window

TYRES = {
    Compound.SOFT: TyreModel(Compound.SOFT, 89.7, 0.15, 0.0),
    Compound.MEDIUM: TyreModel(Compound.MEDIUM, 90.0, 0.07, 0.0),
    Compound.HARD: TyreModel(Compound.HARD, 90.4, 0.04, 0.0),
}


def test_one_stop_is_best_with_moderate_degradation_and_window_is_contiguous() -> None:
    result = optimal_window(50, TYRES, 22.0, current_compound=Compound.MEDIUM)

    assert len(result.best.stops) == 1
    lo, hi = result.first_stop_window
    assert lo <= result.best.stops[0][0] <= hi
    assert result.best.delta_to_best_s == 0.0
    assert all(p.delta_to_best_s <= 1.0 for p in result.plans)


def test_high_degradation_and_cheap_stops_favour_two_stops() -> None:
    fragile = {
        c: TyreModel(c, t.new_tyre_pace_s, t.slope_s_per_lap * 4, 0.0) for c, t in TYRES.items()
    }

    result = optimal_window(60, fragile, 15.0, current_compound=Compound.SOFT)

    assert len(result.best.stops) == 2


def test_two_compound_rule_and_constraints() -> None:
    only_medium = {Compound.MEDIUM: TYRES[Compound.MEDIUM]}

    with pytest.raises(ValueError, match="no feasible strategy"):
        optimal_window(50, only_medium, 22.0, current_compound=Compound.MEDIUM)
    relaxed = optimal_window(
        50,
        only_medium,
        22.0,
        current_compound=Compound.MEDIUM,
        config=WindowConfig(require_two_dry_compounds=False),
    )
    assert relaxed.best.stops[0][1] is Compound.MEDIUM


def test_max_stint_length_is_respected() -> None:
    result = optimal_window(
        57, TYRES, 22.0, current_compound=Compound.HARD, config=WindowConfig(max_stint_laps=20)
    )

    bounds = [0, *(lap for lap, _ in result.best.stops), 57]
    assert max(b - a for a, b in itertools.pairwise(bounds)) <= 20


def test_mid_race_start_and_unknown_compound() -> None:
    result = optimal_window(
        50,
        TYRES,
        22.0,
        current_lap=20,
        current_compound=Compound.MEDIUM,
        current_tyre_age=20,
        compounds_used=frozenset({Compound.HARD}),
        max_stops=1,
    )
    assert result.best.stops[0][0] > 20
    with pytest.raises(ValueError, match="no tyre model"):
        optimal_window(50, TYRES, 22.0, current_compound=Compound.WET)

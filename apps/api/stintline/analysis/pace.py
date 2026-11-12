"""Race pace of every car in one session, with the filters a fan can change (ADR 0017).

Computed on request from the cached race context: it depends on the filters, so nothing is
stored.
"""

from __future__ import annotations

from typing import Any

from stintline.racing.models import Session
from stintline.strategy_api.services import race_context
from stintline_strategy import analysis as engine

FASTEST_LAPS_SHOWN = 10


def session_pace(session: Session, flt: engine.PaceFilter) -> dict[str, Any]:
    """Box summary and laps of each car (fastest median first) and the fastest laps.

    Raises:
        StrategyInputError: the session has no laps.
    """
    context = race_context(session)
    race = context.race
    laps = engine.pace_laps(race, context.fuel, flt)
    entries = {e.car_number: e for e in session.entries.select_related("driver__portrait", "team")}
    by_car: dict[int, list[engine.PaceLap]] = {}
    for lap in laps:
        by_car.setdefault(lap.car, []).append(lap)
    meta = {(lap.car, lap.lap): lap for lap in race.laps}
    cars: list[dict[str, Any]] = []
    for car, car_laps in by_car.items():
        kept = [lap.value_s for lap in car_laps if lap.kept]
        box = engine.box_summary(kept) if kept else None
        cars.append(
            {
                "car_number": car,
                "entry": entries.get(car),
                "summary": None
                if box is None
                else {
                    "n": box.n,
                    "median_s": round(box.median_s, 3),
                    "q1_s": round(box.q1_s, 3),
                    "q3_s": round(box.q3_s, 3),
                    "low_s": round(box.low_s, 3),
                    "high_s": round(box.high_s, 3),
                    "mean_s": round(box.mean_s, 3),
                    "std_s": round(box.std_s, 3),
                    "outliers_s": [round(v, 3) for v in box.outliers_s],
                },
                "laps": [
                    {
                        "lap": lap.lap,
                        "time_s": lap.time_s,
                        "value_s": round(lap.value_s, 3),
                        "compound": meta[(car, lap.lap)].compound.value,
                        "tyre_age": meta[(car, lap.lap)].tyre_age,
                        "kept": lap.kept,
                    }
                    for lap in car_laps
                ],
            }
        )
    cars = [c for c in cars if c["entry"] is not None]
    cars.sort(key=lambda c: c["summary"]["median_s"] if c["summary"] else float("inf"))
    fastest = sorted((lap for lap in laps), key=lambda lap: lap.time_s)[:FASTEST_LAPS_SHOWN]
    return {
        "session_id": session.pk,
        "total_laps": race.total_laps,
        "fuel_corrected": flt.fuel_corrected,
        "fuel_gain_per_lap_s": round(context.fuel.gain_per_lap_s(race.total_laps), 4),
        "cutoff_pct": flt.cutoff_pct,
        "include_pit_laps": flt.include_pit_laps,
        "include_neutralised": flt.include_neutralised,
        "cars": cars,
        "fastest_laps": [
            {
                "car_number": lap.car,
                "lap": lap.lap,
                "time_s": lap.time_s,
                "compound": meta[(lap.car, lap.lap)].compound.value,
                "tyre_age": meta[(lap.car, lap.lap)].tyre_age,
            }
            for lap in fastest
        ],
    }

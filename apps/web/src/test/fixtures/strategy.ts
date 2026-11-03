// A what-if replay built from the recorded replay (Hungary 2025): 2.5 s quicker, a win.
import type { Schema } from "@stintline/api-types";

import { replay } from "./replay";

export type StrategyRequest = Schema<"StrategyRequestRequest">;

/** A what-if replay of the requested car: 2.5 s quicker, still second. */
export function strategyResponse(request: StrategyRequest): Schema<"StrategyResult"> {
  const car = replay.cars.find((c) => c.car_number === request.car) ?? replay.cars[0];
  const times = (car?.line_times_s ?? []).map(
    (t, i) => (t ?? 0) - (2.5 * (i + 1)) / replay.total_laps,
  );
  return {
    car: request.car,
    laps: times.length,
    real_strategy: { start_compound: "MEDIUM", stops: [{ lap: 31, compound: "HARD" }] },
    strategy: { start_compound: request.start_compound, stops: request.stops },
    line_times_s: times,
    compounds: times.map(() => "MEDIUM"),
    tyre_ages: times.map((_, i) => i),
    deltas_s: times.map((_, i) => (-2.5 * (i + 1)) / replay.total_laps),
    real_time_s: 5721.9,
    final_time_s: 5719.4,
    gain_s: 2.5,
    sigma_s: 3.7,
    real_position: 2,
    position: 1,
    real_points: 18,
    points: 25,
    chances: [
      { position: 1, probability: 0.75, points: 25 },
      { position: 2, probability: 0.25, points: 18 },
    ],
    warnings: ["long_stint"],
  };
}

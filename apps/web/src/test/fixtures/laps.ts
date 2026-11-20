import type { Schema } from "@stintline/api-types";

import { replay } from "./replay";

/** Lap rows derived from the recorded replay (lap 1 excluded, as the engine does). */
export const lapsResponse: Schema<"Lap">[] = replay.cars.flatMap((car) =>
  car.line_times_s.flatMap((time, index) => {
    const before = index === 0 ? 0 : car.line_times_s[index - 1];
    if (time == null || before == null) return [];
    return [
      {
        car_number: car.car_number,
        lap: index + 1,
        time_s: time - before,
        corrected_time_s: null,
        compound: car.compounds[index] ?? "UNKNOWN",
        tyre_age: car.tyre_ages[index] ?? null,
        stint: null,
        is_pit_in: false,
        is_pit_out: false,
        race_time_s: time,
        excluded: index === 0 ? "first_lap" : null,
      },
    ];
  }),
);

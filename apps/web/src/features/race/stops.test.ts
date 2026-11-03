import type { Schema } from "@stintline/api-types";

import { session } from "@/test/fixtures/session";

import { entriesByCar } from "./entries";
import { neighbours } from "./stops";

const byCar = entriesByCar(session.entries);
const result = (rivals: Schema<"RivalOutcome">[]): Schema<"PitExitResult"> => ({
  car: 4,
  pit_lap: 30,
  pit_loss_s: 21,
  sigma_s: 3,
  position_before: 1,
  expected_position: 2,
  most_likely_position: 2,
  interval: [1, 3],
  distribution: [],
  rivals,
});
const rival = (car: number, margin: number) => ({
  car,
  gap_s: 0,
  margin_s: margin,
  p_pitting_car_ahead: 0.5,
});

describe("neighbours", () => {
  it("finds the closest car ahead and behind and the close fights", () => {
    const n = neighbours(result([rival(16, -8), rival(81, -2), rival(63, 5), rival(99, 1)]), byCar);

    expect(n.ahead?.entry.car_number).toBe(81);
    expect(n.ahead?.gap).toBe(2);
    expect(n.behind?.entry.car_number).toBe(63);
    expect(n.close.map((e) => e.car_number)).toEqual([81]);
  });

  it("handles a rejoin at the front or at the back", () => {
    expect(neighbours(result([rival(16, 4)]), byCar).ahead).toBeNull();
    expect(neighbours(result([rival(16, -4)]), byCar).behind).toBeNull();
  });
});

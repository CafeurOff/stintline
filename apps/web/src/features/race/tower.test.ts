import type { Schema } from "@stintline/api-types";

import { buildClock } from "./replay";
import { timeAtProgress, towerLines } from "./tower";

const replayCar = (
  carNumber: number,
  line: number[],
  extra: Partial<Schema<"ReplayCar">> = {},
): Schema<"ReplayCar"> => ({
  car_number: carNumber,
  line_times_s: line,
  compounds: line.map(() => "MEDIUM"),
  tyre_ages: line.map((_, i) => i + 1),
  pit_in_laps: [],
  ...extra,
});

describe("timeAtProgress", () => {
  const clock = buildClock(replayCar(1, [100, 200, 300]), true);

  it("inverts the race clock within a lap", () => {
    expect(timeAtProgress(clock, 0)).toBe(0);
    expect(timeAtProgress(clock, 0.5)).toBe(50);
    expect(timeAtProgress(clock, 2)).toBe(200);
    expect(timeAtProgress(clock, 2.25)).toBe(225);
  });

  it("has no answer for a point the car never reached", () => {
    expect(timeAtProgress(clock, 3.5)).toBeNull();
  });
});

describe("towerLines", () => {
  const leader = replayCar(1, [100, 200, 300]);
  const second = replayCar(2, [102, 205, 310], { pit_in_laps: [2] });
  const lapped = replayCar(44, [200, 400]);
  const cars = new Map([leader, second, lapped].map((c) => [c.car_number, c]));
  const clocks = [lapped, second, leader].map((c) => buildClock(c, true));

  it("orders the cars and times the gaps where each car is", () => {
    const [first, next] = towerLines(clocks, cars, 150);

    expect(first).toMatchObject({ carNumber: 1, position: 1, toLeaderS: null, intervalS: null });
    expect(next?.carNumber).toBe(2);
    expect(next?.toLeaderS).toBeCloseTo(3.4, 1);
    expect(next?.intervalS).toBeCloseTo(3.4, 1);
  });

  it("counts laps down, tyres and completed stops", () => {
    const lines = towerLines(clocks, cars, 290);

    expect(lines.at(-1)).toMatchObject({ carNumber: 44, lapsDown: 1, stops: 0 });
    expect(lines[1]).toMatchObject({ carNumber: 2, compound: "MEDIUM", tyreAge: 3, stops: 1 });
    expect(towerLines(clocks, cars, 150).at(-1)?.lapsDown).toBe(0);
  });
});

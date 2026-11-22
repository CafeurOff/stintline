import { replay } from "@/test/fixtures/replay";

import {
  buildClock,
  leaderLap,
  leaderTimeAtLap,
  pointAt,
  progressAt,
  raceEndTime,
  radioRaceTime,
  runningOrder,
} from "./replay";

const car = (line: (number | null)[], finished = true) =>
  buildClock(
    { car_number: 1, line_times_s: line, compounds: [], tyre_ages: [], pit_in_laps: [] },
    finished,
  );

describe("buildClock", () => {
  it("fills gaps in the feed by interpolation", () => {
    expect(car([90, null, null, 360]).lineTimes).toEqual([90, 180, 270, 360]);
  });

  it("stops at the last lap the car completed", () => {
    expect(car([90, 180, null, null], false).lineTimes).toEqual([90, 180]);
  });
});

describe("progressAt", () => {
  it("interpolates within a lap", () => {
    const clock = car([100, 200, 300]);
    expect(progressAt(clock, 0)).toBe(0);
    expect(progressAt(clock, 50)).toBe(0.5);
    expect(progressAt(clock, 250)).toBe(2.5);
  });

  it("keeps finishers at the line and removes retired cars", () => {
    expect(progressAt(car([100, 200]), 999)).toBe(2);
    const retired = car([100, 200], false);
    expect(progressAt(retired, 250)).toBeCloseTo(2.5);
    expect(progressAt(retired, 400)).toBeNull();
    expect(progressAt(car([]), 10)).toBeNull();
  });
});

describe("race helpers on the recorded Hungarian Grand Prix", () => {
  const clocks = replay.cars.map((c) => buildClock(c, true));

  it("finds the leader's lap and the time each lap starts", () => {
    const start30 = leaderTimeAtLap(clocks, 30);
    expect(leaderTimeAtLap(clocks, 1)).toBe(0);
    expect(leaderLap(clocks, start30 + 1, 70)).toBe(30);
    expect(leaderLap(clocks, raceEndTime(clocks), 70)).toBe(70);
  });

  it("orders the field with Norris leading on lap 30", () => {
    const order = runningOrder(clocks, leaderTimeAtLap(clocks, 30) + 1);
    expect(order[0]?.carNumber).toBe(4);
    expect(order).toHaveLength(20);
  });
});

describe("pointAt", () => {
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it("walks the outline by fraction of a lap and wraps", () => {
    expect(pointAt(square, 0)).toEqual([0, 0]);
    expect(pointAt(square, 0.125)).toEqual([5, 0]);
    expect(pointAt(square, 1.25)).toEqual([10, 0]);
    expect(pointAt([], 0.5)).toEqual([0, 0]);
  });
});

describe("radioRaceTime", () => {
  const car = { carNumber: 4, lineTimes: [100, 190, 280], finished: true };
  const other = { carNumber: 81, lineTimes: [98, 186], finished: true };
  const clocks = [car, other];
  const byCar = new Map(clocks.map((c) => [c.carNumber, c]));

  it("places a message as far into the lap as it was sent, on its car's clock", () => {
    expect(radioRaceTime(clocks, byCar, { car_number: 4, lap: 2, lap_fraction: 0.5 })).toBe(145);
    expect(radioRaceTime(clocks, byCar, { car_number: 4, lap: 1, lap_fraction: 0.25 })).toBe(25);
  });

  it("uses the lap start without a fraction, and the start before the first lap", () => {
    expect(radioRaceTime(clocks, byCar, { car_number: 4, lap: 3, lap_fraction: null })).toBe(190);
    expect(radioRaceTime(clocks, byCar, { car_number: 4, lap: null })).toBe(0);
  });

  it("falls back on the leader for a car without a clock", () => {
    expect(radioRaceTime(clocks, byCar, { car_number: 99, lap: 2, lap_fraction: 0.5 })).toBe(98);
  });
});

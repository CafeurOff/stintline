import { advance, gapsAt, indexAtTime, playWindow, ReplayClock, valueAt } from "./playback";

import { telemetryCompare } from "@/test/fixtures/telemetry";

describe("playback", () => {
  it("finds the fractional point a car has reached", () => {
    const times = [0, 1, 2, 4];

    expect(indexAtTime(times, 1.5)).toBeCloseTo(1.5);
    expect(indexAtTime(times, 3)).toBeCloseTo(2.5);
    expect(indexAtTime(times, -1)).toBe(0);
    expect(indexAtTime(times, 9)).toBe(3);
    expect(indexAtTime([], 1)).toBe(0);
  });

  it("reads a channel between two points", () => {
    expect(valueAt([10, 20, 40], 1.25)).toBeCloseTo(25);
    expect(valueAt([10, 20, 40], 2)).toBe(40);
  });

  it("loops inside the replay window", () => {
    const window = { start: 10, end: 20 };

    expect(advance(12, 1, 2, window)).toBeCloseTo(14);
    expect(advance(19, 1, 4, window)).toBeCloseTo(13);
    expect(advance(5, 0, 1, window)).toBeCloseTo(15);
    expect(advance(5, 1, 1, { start: 3, end: 3 })).toBe(3);
  });

  it("plays a zoomed part of the lap from the reference car's times", () => {
    const [reference] = telemetryCompare.cars;
    if (!reference) throw new Error("fixture has cars");

    const window = playWindow(reference, 0, 100);

    expect(window.start).toBe(0);
    expect(window.end).toBeCloseTo(reference.t_s[100] ?? 0);
  });

  it("measures the gap on track at the same moment", () => {
    const { cars, step_m } = telemetryCompare;
    const [norris, piastri] = cars;
    if (!norris || !piastri) throw new Error("fixture has two cars");

    const gaps = gapsAt(cars, 70, step_m);

    expect(gaps[0]).toEqual({ metres: 0, seconds: 0 });
    // Piastri gained on Norris through the last sector: he is ahead, so the gap is negative.
    expect(gaps[1]?.metres).toBeLessThan(0);
    expect(gaps[1]?.seconds).toBeLessThan(0);
    expect(gapsAt([], 1, step_m)).toEqual([]);
  });
});

describe("ReplayClock", () => {
  it("runs only while playing, at its speed, inside its window", () => {
    const clock = new ReplayClock({ start: 0, end: 10 });

    expect(clock.tick(0.05)).toBe(0);
    clock.configure(true, 2, { start: 0, end: 10 });
    expect(clock.tick(0.05)).toBeCloseTo(0.1);
    expect(clock.tick(5)).toBeCloseTo(0.3);
    clock.seek(42);
    expect(clock.time).toBe(10);
    clock.configure(false, 1, { start: 2, end: 4 });
    expect(clock.time).toBe(2);
  });
});

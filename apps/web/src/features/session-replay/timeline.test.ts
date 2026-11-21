import { describe, expect, it } from "vitest";

import {
  carStateAt,
  clockLabel,
  flagAt,
  initialTime,
  latestAt,
  segmentAt,
  standingsAt,
  type Timeline,
  type TimelineLap,
} from "./timeline";

function lap(n: number, start: number, time: number | null, extra: Partial<TimelineLap> = {}) {
  return {
    lap: n,
    start_s: start,
    end_s: time === null ? null : start + time,
    drive_start_s: time === null ? null : start,
    drive_from: 0,
    time_s: time,
    sectors_s: [null, null, null],
    compound: "SOFT",
    tyre_age: n,
    pit_out: false,
    pit_in: false,
    deleted: false,
    ...extra,
  } satisfies TimelineLap;
}

function timeline(extra: Partial<Timeline> = {}): Timeline {
  return {
    starts_at: "2025-08-02T14:00:00Z",
    duration_s: 3600,
    cars: [
      { car_number: 4, laps: [lap(1, 100, 90, { pit_out: true }), lap(2, 190, 80)] },
      { car_number: 16, laps: [lap(1, 150, 95), lap(2, 245, 79, { deleted: true })] },
      { car_number: 81, laps: [lap(1, 2000, 90), lap(2, 2090, 78)] },
    ],
    segments: [],
    flags: [],
    race_control: [],
    weather: [],
    ...extra,
  };
}

describe("carStateAt", () => {
  const [car] = timeline().cars;
  if (!car) throw new Error("fixture without cars");

  it("places a car partway through the lap it is running", () => {
    const state = carStateAt(car, 230);
    expect(state.kind).toBe("track");
    if (state.kind === "track") {
      expect(state.lap.lap).toBe(2);
      expect(state.fraction).toBeCloseTo(0.5);
    }
  });

  it("puts a car in the pits before its first lap and after its last", () => {
    expect(carStateAt(car, 50)).toEqual({ kind: "pits", lastLap: null });
    const after = carStateAt(car, 400);
    expect(after.kind === "pits" && after.lastLap?.lap).toBe(2);
  });

  it("shows an out lap only for the part driven after the garage", () => {
    const out = {
      car_number: 1,
      laps: [lap(1, 0, 300, { pit_out: true, drive_start_s: 250, drive_from: 1 / 3 })],
    };
    expect(carStateAt(out, 100).kind).toBe("pits");
    const state = carStateAt(out, 275);
    expect(state.kind === "track" && state.fraction).toBeCloseTo(2 / 3);
  });

  it("never draws a lap whose end is unknown", () => {
    const stopped = { car_number: 1, laps: [lap(1, 0, null)] };
    expect(carStateAt(stopped, 10).kind).toBe("pits");
  });
});

describe("standingsAt", () => {
  it("orders by best lap so far and ignores deleted laps", () => {
    const lines = standingsAt(timeline(), 400);
    expect(lines.map((l) => l.carNumber)).toEqual([4, 16, 81]);
    expect(lines[0]?.best?.time_s).toBe(80);
    expect(lines[1]?.best?.time_s).toBe(95); // 79 was deleted
    expect(lines[1]?.gapS).toBe(15);
    expect(lines[2]?.best).toBeNull();
    expect(lines[0]?.laps).toBe(2);
  });

  it("never ranks out laps or in laps", () => {
    const data = timeline({
      cars: [
        {
          car_number: 4,
          laps: [lap(1, 0, 60, { pit_out: true }), lap(2, 60, 70, { pit_in: true })],
        },
        { car_number: 16, laps: [lap(1, 0, 90)] },
      ],
    });

    const lines = standingsAt(data, 500);

    expect(lines.map((l) => [l.carNumber, l.best?.time_s ?? null])).toEqual([
      [16, 90],
      [4, null],
    ]);
  });

  it("resets times at each segment and keeps the knocked-out cars at the bottom", () => {
    const data = timeline({
      segments: [
        { number: 1, start_s: 0, end_s: 1000, eliminated: [16] },
        { number: 2, start_s: 1500, end_s: 2500, eliminated: [] },
      ],
    });

    const lines = standingsAt(data, 2300);

    expect(lines.map((l) => [l.carNumber, l.outIn])).toEqual([
      [81, null],
      [4, null],
      [16, 1],
    ]);
    expect(lines[1]?.best).toBeNull(); // car 4's Q1 lap does not count in Q2
    expect(lines[2]?.best?.time_s).toBe(95); // its Q1 time is kept
    expect(lines[0]?.compound).toBe("SOFT");
  });
});

describe("helpers", () => {
  it("finds the segment under way, the latest sample and the flag", () => {
    const segments = [
      { number: 1, start_s: 0, end_s: 1080, eliminated: [] },
      { number: 2, start_s: 1500, end_s: 2400, eliminated: [] },
    ];
    expect(segmentAt(segments, 1200)?.number).toBe(1);
    expect(segmentAt(segments, 1600)?.number).toBe(2);
    expect(segmentAt([], 10)).toBeNull();

    const samples = [{ at: 0 }, { at: 60 }, { at: 120 }];
    expect(latestAt(samples, 90, (s) => s.at)).toEqual({ at: 60 });
    expect(latestAt(samples, -5, (s) => s.at)).toEqual({ at: 0 });

    const data = timeline({ flags: [{ status: "RED", start_s: 300, end_s: null }] });
    expect(flagAt(data, 200)).toBeNull();
    expect(flagAt(data, 500)?.status).toBe("RED");
  });

  it("formats the session clock and opens on the fastest lap", () => {
    expect(clockLabel(75.9)).toBe("1:15");
    expect(clockLabel(3725)).toBe("1:02:05");
    expect(initialTime(timeline())).toBe(2090);
    expect(initialTime(timeline({ cars: [] }))).toBe(0);
  });
});

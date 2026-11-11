import type { Schema } from "@stintline/api-types";
import { describe, expect, it } from "vitest";

import {
  clampSection,
  cornerSections,
  formatSection,
  indexRange,
  parseSection,
  sectionStats,
} from "./section";

function car(speeds: number[], throttle: number[], brake: boolean[]): Schema<"TelemetryCar"> {
  return {
    car_number: 4,
    entry: {} as Schema<"TelemetryCar">["entry"],
    lap_number: 10,
    lap_time_s: 80,
    max_speed_kph: Math.max(...speeds),
    full_throttle_share: 0.5,
    speed_kph: speeds,
    throttle_pct: throttle,
    brake,
    gear: speeds.map(() => 5),
    drs_open: speeds.map(() => false),
    x: speeds.map(() => 0),
    y: speeds.map(() => 0),
    delta_s: speeds.map(() => 0),
    braking_zones: [],
  };
}

describe("telemetry sections", () => {
  it("reads and writes the zoom kept in the address", () => {
    const section = parseSection("1850-1200", 5000);

    expect(section).toEqual({ start: 1200, end: 1850 });
    expect(section && formatSection(section)).toBe("1200-1850");
  });

  it("rejects malformed or too short sections", () => {
    expect(parseSection("abc", 5000)).toBeNull();
    expect(parseSection("100-120", 5000)).toBeNull();
  });

  it("clamps a section to the lap", () => {
    expect(clampSection(-50, 6000, 5000)).toEqual({ start: 0, end: 5000 });
  });

  it("maps a section to the samples it covers", () => {
    expect(indexRange({ start: 95, end: 205 }, 10, 100)).toEqual([9, 21]);
  });

  it("builds one corner section per braking zone", () => {
    const zones = [{ start_m: 1000, end_m: 1100, entry_kph: 300, min_kph: 90, x: 0, y: 0 }];

    expect(cornerSections(zones, 5000)).toEqual([{ start: 880, end: 1320 }]);
  });

  it("integrates the time over a section from speed", () => {
    // 100 m at a steady 36 km/h (10 m/s) take 10 s.
    const stats = sectionStats(car([36, 36, 36], [100, 100, 40], [false, false, true]), 50, 0, 2);

    expect(stats.time_s).toBeCloseTo(10);
    expect(stats.min_kph).toBe(36);
    expect(stats.full_throttle_share).toBeCloseTo(2 / 3);
    expect(stats.braking_share).toBeCloseTo(1 / 3);
  });
});

import { liveSnapshot } from "@/test/fixtures/live";

import { FALLBACK_LAP_S, raceGaps, referenceLap, ringAngle } from "./ring";

describe("gap ring maths", () => {
  it("measures gaps from the leader and counts a lapped car a lap down", () => {
    const cars = liveSnapshot.cars
      .slice(0, 3)
      .map((car) => (car.number === 12 ? { ...car, gap_s: null, laps_behind: 1 } : car));

    const gaps = raceGaps(cars);

    expect(gaps.get(3)).toBe(0);
    expect(gaps.get(44)).toBe(0.799);
    expect(gaps.get(12)).toBe(79.663);
  });

  it("falls back to a typical lap without a leader lap time", () => {
    const leader = liveSnapshot.cars.slice(0, 1).map((car) => ({ ...car, last_lap_s: null }));

    expect(referenceLap(leader)).toBe(FALLBACK_LAP_S);
    expect(referenceLap([])).toBe(FALLBACK_LAP_S);
  });

  it("places a quarter-lap gap a quarter turn back", () => {
    expect(ringAngle(20, 80)).toBeCloseTo(-Math.PI / 2);
    expect(ringAngle(100, 80)).toBeCloseTo(-Math.PI / 2);
  });
});

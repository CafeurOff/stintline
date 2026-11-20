import type { CarClock } from "@/features/race/replay";

/** One value per lap (index 0 = end of lap 1), `null` when the car had not completed it. */
export type PerLap = (number | null)[];

/** Running position of every car at the end of each lap, from line-crossing times. */
export function positionsByLap(
  clocks: readonly CarClock[],
  totalLaps: number,
): Map<number, PerLap> {
  const out = new Map<number, PerLap>(
    clocks.map((c) => [c.carNumber, Array<number | null>(totalLaps).fill(null)]),
  );
  for (let lap = 0; lap < totalLaps; lap += 1) {
    const crossed = clocks
      .map((c) => ({ car: c.carNumber, time: c.lineTimes[lap] }))
      .filter((c): c is { car: number; time: number } => c.time !== undefined)
      .sort((a, b) => a.time - b.time);
    crossed.forEach(({ car }, index) => {
      const row = out.get(car);
      if (row) row[lap] = index + 1;
    });
  }
  return out;
}

/** Seconds behind the leader at the end of each lap (the leader is at 0). */
export function gapsByLap(clocks: readonly CarClock[], totalLaps: number): Map<number, PerLap> {
  const out = new Map<number, PerLap>(
    clocks.map((c) => [c.carNumber, Array<number | null>(totalLaps).fill(null)]),
  );
  for (let lap = 0; lap < totalLaps; lap += 1) {
    const times = clocks.map((c) => c.lineTimes[lap]).filter((t): t is number => t !== undefined);
    if (times.length === 0) continue;
    const leader = Math.min(...times);
    for (const clock of clocks) {
      const time = clock.lineTimes[lap];
      const row = out.get(clock.carNumber);
      if (row && time !== undefined) row[lap] = time - leader;
    }
  }
  return out;
}

/** Places gained from the grid (positive) or lost; `null` without both positions. */
export function placesGained(grid: number | null | undefined, finish: number | null | undefined) {
  if (grid == null || finish == null || grid === 0) return null;
  return grid - finish;
}

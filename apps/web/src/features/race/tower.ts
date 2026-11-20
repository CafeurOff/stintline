import type { Schema } from "@stintline/api-types";

import { type CarClock, progressAt } from "./replay";

type ReplayCar = Schema<"ReplayCar">;

/** Race time at which the car had covered `progress` laps, or `null` if it never got there. */
export function timeAtProgress(clock: CarClock, progress: number): number | null {
  if (progress <= 0) return 0;
  const completed = Math.floor(progress);
  const start = completed === 0 ? 0 : clock.lineTimes[completed - 1];
  if (start === undefined) return null;
  const share = progress - completed;
  if (share === 0) return start;
  const end = clock.lineTimes[completed];
  return end === undefined ? null : start + (end - start) * share;
}

/** One line of the timing tower at a replay instant. */
export interface TowerLine {
  carNumber: number;
  position: number;
  progress: number;
  /** Seconds since the leader passed the same point; `null` for the leader. */
  toLeaderS: number | null;
  /** Seconds since the car ahead passed the same point; `null` for the leader. */
  intervalS: number | null;
  /** Whole laps behind the leader (0 on the lead lap). */
  lapsDown: number;
  compound: string | null;
  tyreAge: number | null;
  stops: number;
}

/**
 * The running order at race time `t` with the gaps a timing screen shows: how long ago the
 * leader, and the car ahead, went through the point where each car is now.
 */
export function towerLines(
  clocks: readonly CarClock[],
  cars: ReadonlyMap<number, ReplayCar>,
  t: number,
): TowerLine[] {
  const running = clocks
    .map((clock) => ({ clock, progress: progressAt(clock, t) }))
    .filter((r): r is { clock: CarClock; progress: number } => r.progress !== null)
    .sort((a, b) => b.progress - a.progress);
  const leader = running[0];
  return running.map(({ clock, progress }, index) => {
    const ahead = running[index - 1];
    const since = (other: CarClock) => {
      const passed = timeAtProgress(other, progress);
      return passed === null ? null : Math.max(t - passed, 0);
    };
    const car = cars.get(clock.carNumber);
    const lap = Math.floor(progress);
    return {
      carNumber: clock.carNumber,
      position: index + 1,
      progress,
      toLeaderS: leader && index > 0 ? since(leader.clock) : null,
      intervalS: ahead ? since(ahead.clock) : null,
      lapsDown: leader ? Math.max(Math.floor(leader.progress - progress), 0) : 0,
      compound: car?.compounds[lap] ?? null,
      tyreAge: car?.tyre_ages[lap] ?? null,
      // A stop counts once the car has started the lap after its in-lap.
      stops: car ? car.pit_in_laps.filter((inLap) => progress >= inLap).length : 0,
    };
  });
}

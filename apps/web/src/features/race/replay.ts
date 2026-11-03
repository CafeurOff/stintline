import type { Schema } from "@stintline/api-types";

type ReplayCar = Schema<"ReplayCar">;

/**
 * One car's race clock: the time it crossed the line at the end of each lap. Gaps in the
 * feed are filled by linear interpolation between the neighbouring crossings.
 */
export interface CarClock {
  carNumber: number;
  /** `lineTimes[k]` = race time at the end of lap `k + 1`. Only laps actually completed. */
  lineTimes: number[];
  /** True when the car took the chequered flag (it then waits at the line). */
  finished: boolean;
}

export function buildClock(car: ReplayCar, finished: boolean): CarClock {
  const raw = car.line_times_s;
  let last = raw.length - 1;
  while (last >= 0 && raw[last] == null) last -= 1;
  const lineTimes: number[] = [];
  for (let i = 0; i <= last; i += 1) {
    const value = raw[i];
    if (value != null) {
      lineTimes.push(value);
      continue;
    }
    const before = i > 0 ? lineTimes[i - 1] : 0;
    let j = i + 1;
    while (j <= last && raw[j] == null) j += 1;
    const after = raw[j] ?? before ?? 0;
    lineTimes.push((before ?? 0) + ((after - (before ?? 0)) * 1) / (j - i + 1));
  }
  return { carNumber: car.car_number, lineTimes, finished };
}

/**
 * Laps covered at race time `t` (2.25 = a quarter into lap 3), or `null` once a car that
 * retired has left the track. Lap 1 starts at t = 0 for everyone.
 */
export function progressAt(clock: CarClock, t: number): number | null {
  const times = clock.lineTimes;
  if (t <= 0) return 0;
  const last = times.length;
  const lastTime = times[last - 1];
  if (lastTime === undefined) return null;
  if (t >= lastTime) {
    if (clock.finished) return last;
    const lastLapDuration = lastTime - (times[last - 2] ?? 0);
    // A retired car is shown for the lap it did not finish, then removed.
    return t < lastTime + lastLapDuration
      ? last + Math.min((t - lastTime) / lastLapDuration, 0.99)
      : null;
  }
  let lo = 0;
  let hi = last - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((times[mid] ?? 0) <= t) lo = mid + 1;
    else hi = mid;
  }
  const start = lo === 0 ? 0 : (times[lo - 1] ?? 0);
  const end = times[lo] ?? start;
  return lo + (end > start ? (t - start) / (end - start) : 0);
}

/** Race time at which the leader starts `lap` (lap 1 starts at 0). */
export function leaderTimeAtLap(clocks: readonly CarClock[], lap: number): number {
  if (lap <= 1) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (const clock of clocks) {
    const value = clock.lineTimes[lap - 2];
    if (value !== undefined && value < best) best = value;
  }
  return Number.isFinite(best) ? best : 0;
}

/** End of the replay: when the last classified car takes the flag. */
export function raceEndTime(clocks: readonly CarClock[]): number {
  return clocks.reduce((max, clock) => Math.max(max, clock.lineTimes.at(-1) ?? 0), 0);
}

/** Lap the leader is on at time `t`, capped to the race distance. */
export function leaderLap(clocks: readonly CarClock[], t: number, totalLaps: number): number {
  let best = 0;
  for (const clock of clocks) {
    const progress = progressAt(clock, t);
    if (progress !== null && progress > best) best = progress;
  }
  return Math.min(Math.floor(best) + 1, totalLaps);
}

/** Point on the outline for a fraction of a lap. Samples are evenly spaced in time. */
export function pointAt(
  points: readonly (readonly number[])[],
  fraction: number,
): [number, number] {
  const n = points.length;
  if (n === 0) return [0, 0];
  const u = (((fraction % 1) + 1) % 1) * n;
  const i = Math.floor(u);
  const k = u - i;
  const p = points[i % n] ?? [0, 0];
  const q = points[(i + 1) % n] ?? p;
  const px = p[0] ?? 0;
  const py = p[1] ?? 0;
  return [px + ((q[0] ?? px) - px) * k, py + ((q[1] ?? py) - py) * k];
}

export interface Running {
  carNumber: number;
  progress: number;
}

/** Cars on track at `t`, race order first. */
export function runningOrder(clocks: readonly CarClock[], t: number): Running[] {
  const out: Running[] = [];
  for (const clock of clocks) {
    const progress = progressAt(clock, t);
    if (progress !== null) out.push({ carNumber: clock.carNumber, progress });
  }
  return out.sort((a, b) => b.progress - a.progress);
}

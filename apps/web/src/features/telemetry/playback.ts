import type { Schema } from "@stintline/api-types";

type Car = Schema<"TelemetryCar">;

/** Speeds of the 3D replay, slow motion to fast forward. */
export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/**
 * Fractional grid index where a car is at `time` seconds into its lap. Times grow along the
 * grid, so a binary search finds the two points around it. Before the start the car is at
 * 0; after its lap it stays on the line.
 */
export function indexAtTime(times: readonly number[], time: number): number {
  const last = times.length - 1;
  if (last < 0) return 0;
  if (time <= (times[0] ?? 0)) return 0;
  if (time >= (times[last] ?? 0)) return last;
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if ((times[mid] ?? 0) <= time) low = mid;
    else high = mid;
  }
  const from = times[low] ?? 0;
  const to = times[high] ?? from;
  return to > from ? low + (time - from) / (to - from) : low;
}

/** Linear read of a channel at a fractional index. */
export function valueAt(values: readonly number[], index: number): number {
  const low = Math.floor(index);
  const high = Math.min(low + 1, values.length - 1);
  const a = values[low] ?? 0;
  const b = values[high] ?? a;
  return a + (b - a) * (index - low);
}

/** Lap time of a car on the common grid (its last point). */
export function lapEnd(car: Car): number {
  return car.t_s[car.t_s.length - 1] ?? car.lap_time_s;
}

/** Replay window in seconds of the reference lap: the zoomed part, or the whole lap. */
export function playWindow(
  reference: Car,
  first: number,
  last: number,
): { start: number; end: number } {
  return { start: reference.t_s[first] ?? 0, end: reference.t_s[last] ?? lapEnd(reference) };
}

/**
 * Next clock value after `elapsed` real seconds at `speed`. The replay loops inside the
 * window, so a zoomed corner plays again and again.
 */
export function advance(
  clock: number,
  elapsed: number,
  speed: number,
  window: { start: number; end: number },
): number {
  const next = clock + elapsed * speed;
  const span = window.end - window.start;
  if (span <= 0) return window.start;
  if (next < window.start || next > window.end) {
    return window.start + ((((next - window.start) % span) + span) % span);
  }
  return next;
}

/**
 * Gap of each car to the reference at the same moment, in metres along the lap (positive:
 * behind) and in seconds at that spot. Measured on track, not at the line: what you see.
 */
export function gapsAt(
  cars: readonly Car[],
  clock: number,
  stepM: number,
): { metres: number; seconds: number }[] {
  const [reference] = cars;
  if (!reference) return [];
  const refIndex = indexAtTime(reference.t_s, clock);
  return cars.map((car) => {
    const index = indexAtTime(car.t_s, clock);
    return {
      metres: (refIndex - index) * stepM,
      seconds: valueAt(car.delta_s, index),
    };
  });
}

/**
 * The replay clock shared by the 3D scene (which advances it every frame) and its
 * controls (which read it a few times a second). A plain object outside React state: a
 * re-render per frame would be wasted work.
 */
export class ReplayClock {
  private now: number;
  private running = false;
  private rate = 1;
  private bounds: { start: number; end: number };

  constructor(window: { start: number; end: number }) {
    this.bounds = window;
    this.now = window.start;
  }

  get time(): number {
    return this.now;
  }

  /** New settings from the controls. The time is kept inside the window. */
  configure(playing: boolean, speed: number, window: { start: number; end: number }): void {
    this.running = playing;
    this.rate = speed;
    this.bounds = window;
    if (this.now < window.start || this.now > window.end) this.now = window.start;
  }

  seek(time: number): void {
    this.now = Math.min(Math.max(time, this.bounds.start), this.bounds.end);
  }

  /** One frame: `elapsed` real seconds (capped, so a hidden tab does not jump ahead). */
  tick(elapsed: number): number {
    if (this.running) this.now = advance(this.now, Math.min(elapsed, 0.1), this.rate, this.bounds);
    return this.now;
  }
}

/**
 * Smooth car motion between timing loops.
 *
 * The feed says where a car was at the last timing loop it passed (a share of the lap,
 * in time), how long ago, and its recent pace. Between loops the car is moved forward at
 * that pace, a little past the loop at most, and the shown position eases towards the
 * expected one: it slows down or waits when ahead, speeds up when behind, and never goes
 * backwards. Fractions are positions on the lap, from 0 at the line to 1.
 */

/** A car may run this share of a lap past its last loop before it waits for the next
 * one (loops are about a 25th of a lap apart, so this covers one late loop). */
export const MAX_AHEAD = 0.06;
/** Seconds the shown position takes to close most of a gap with the expected one. */
export const CATCH_UP_S = 1.5;
/** Fastest the shown position may move, as a multiple of the car's pace. */
export const MAX_SPEED_FACTOR = 3;
/** A gap larger than this share of a lap (a reconnection, a car out of the pits) is
 * closed at once rather than driven. */
export const SNAP_LAP = 0.2;

export interface Observation {
  /** Share of the lap at the last loop passed. */
  fraction: number;
  /** When the car passed it, in ms on the page clock. */
  at: number;
  /** Laps per second. */
  rate: number;
}

export interface Motion {
  shown: number;
  observation: Observation;
}

/** A change of lap share folded into [-0.5, 0.5): crossing the line is a small step. */
export function wrap(delta: number): number {
  return ((((delta + 0.5) % 1) + 1) % 1) - 0.5;
}

function lapShare(value: number): number {
  return ((value % 1) + 1) % 1;
}

/** Where the car should be at `now` (ms) from its last loop and pace. */
export function expected(observation: Observation, now: number): number {
  const elapsedS = Math.max(now - observation.at, 0) / 1000;
  return lapShare(observation.fraction + Math.min(elapsedS * observation.rate, MAX_AHEAD));
}

/** Take a new observation in: a far-off car jumps there, a near one keeps easing. */
export function observe(motion: Motion | undefined, observation: Observation, now: number): Motion {
  const target = expected(observation, now);
  if (!motion || Math.abs(wrap(target - motion.shown)) > SNAP_LAP) {
    return { shown: target, observation };
  }
  return { shown: motion.shown, observation };
}

/** Move the shown position on by `dtS` seconds. */
export function advance(motion: Motion, now: number, dtS: number): Motion {
  const { rate } = motion.observation;
  const error = wrap(expected(motion.observation, now) - motion.shown);
  const speed = Math.min(Math.max(rate + error / CATCH_UP_S, 0), rate * MAX_SPEED_FACTOR);
  // Never past the expected position when catching up: no overshoot, then no wait.
  const move = error > 0 ? Math.min(speed * dtS, error) : speed * dtS;
  return { ...motion, shown: lapShare(motion.shown + move) };
}

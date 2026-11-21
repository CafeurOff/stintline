import type { Schema } from "@stintline/api-types";

export type Timeline = Schema<"Timeline">;
export type TimelineCar = Schema<"TimelineCar">;
export type TimelineLap = Schema<"TimelineLap">;
export type TimelineSegment = Schema<"TimelineSegment">;

/** Where a car is at a session instant: on track partway through a lap, or in the pits. */
export type CarState =
  | { kind: "track"; lap: TimelineLap; fraction: number }
  | { kind: "pits"; lastLap: TimelineLap | null };

/**
 * A car is on track while one of its laps is being driven at `t`: from `drive_start_s` (the
 * start of a flying lap; for an out lap, when it left the pit lane) to its crossing of the
 * line. Otherwise it is in the pit lane or the garage, and is not drawn on the circuit.
 */
export function carStateAt(car: TimelineCar, t: number): CarState {
  let lastLap: TimelineLap | null = null;
  for (const lap of car.laps) {
    if (lap.start_s > t) break;
    lastLap = lap;
    const from = lap.drive_start_s;
    if (from !== null && lap.end_s !== null && from <= t && t < lap.end_s) {
      const span = lap.end_s - from;
      const share = span > 0 ? (t - from) / span : 0;
      return { kind: "track", lap, fraction: lap.drive_from + (1 - lap.drive_from) * share };
    }
  }
  return { kind: "pits", lastLap };
}

/** The qualifying segment under way at `t` (it lasts until the next one starts). */
export function segmentAt(segments: readonly TimelineSegment[], t: number): TimelineSegment | null {
  let current: TimelineSegment | null = null;
  for (const segment of segments) if (segment.start_s <= t) current = segment;
  return current;
}

function segmentWindow(
  segments: readonly TimelineSegment[],
  number: number,
): { from: number; to: number } {
  const index = segments.findIndex((s) => s.number === number);
  const next = segments[index + 1];
  return { from: segments[index]?.start_s ?? 0, to: next ? next.start_s : Infinity };
}

/**
 * A lap that counts for the classification: a timed flying lap finished by `t`, not deleted.
 * Out laps (timed from the previous crossing, garage included) and in laps never count.
 */
function counts(lap: TimelineLap, t: number): boolean {
  return (
    lap.time_s !== null &&
    lap.end_s !== null &&
    lap.end_s <= t &&
    !lap.deleted &&
    !lap.pit_out &&
    !lap.pit_in
  );
}

function bestLap(
  laps: readonly TimelineLap[],
  t: number,
  from = -Infinity,
  to = Infinity,
): TimelineLap | null {
  let best: TimelineLap | null = null;
  for (const lap of laps) {
    if (!counts(lap, t) || lap.start_s < from || lap.start_s >= to) continue;
    if (best === null || (lap.time_s ?? Infinity) < (best.time_s ?? Infinity)) best = lap;
  }
  return best;
}

/** One line of the session timing tower at a replay instant. */
export interface StandingLine {
  carNumber: number;
  position: number;
  best: TimelineLap | null;
  /** Seconds behind the fastest car still running in the segment; `null` for it. */
  gapS: number | null;
  /** Laps completed by `t`, out and in laps included. */
  laps: number;
  state: CarState;
  /** Segment the car was knocked out of (shown at the bottom, greyed), else `null`. */
  outIn: number | null;
  compound: string | null;
  tyreAge: number | null;
}

/**
 * The classification as a timing screen shows it at `t`: by best lap so far. In qualifying
 * only laps started in the current segment count (times are reset at each segment), and the
 * cars knocked out of earlier segments sit at the bottom in the order they went out.
 */
export function standingsAt(timeline: Timeline, t: number): StandingLine[] {
  const segment = segmentAt(timeline.segments, t);
  const outIn = new Map<number, number>();
  for (const s of timeline.segments) {
    if (segment !== null && s.number < segment.number) {
      for (const car of s.eliminated) outIn.set(car, s.number);
    }
  }

  const lines = timeline.cars.map((car) => {
    const out = outIn.get(car.car_number) ?? null;
    const window = segmentWindow(timeline.segments, out ?? segment?.number ?? -1);
    const best =
      segment === null ? bestLap(car.laps, t) : bestLap(car.laps, t, window.from, window.to);
    const state = carStateAt(car, t);
    const shown = state.kind === "track" ? state.lap : state.lastLap;
    return {
      carNumber: car.car_number,
      position: 0,
      best,
      gapS: null,
      laps: car.laps.filter((lap) => lap.end_s !== null && lap.end_s <= t).length,
      state,
      outIn: out,
      compound: shown?.compound ?? null,
      tyreAge: shown?.tyre_age ?? null,
    } satisfies StandingLine;
  });

  const time = (line: StandingLine) => line.best?.time_s ?? Infinity;
  lines.sort((a, b) =>
    (a.outIn ?? Infinity) === (b.outIn ?? Infinity)
      ? time(a) - time(b) || a.carNumber - b.carNumber
      : (b.outIn ?? Infinity) - (a.outIn ?? Infinity),
  );
  const fastest = lines[0]?.outIn === null ? lines[0].best?.time_s : undefined;
  return lines.map((line, index) => ({
    ...line,
    position: index + 1,
    gapS:
      index === 0 || line.outIn !== null || fastest == null || line.best?.time_s == null
        ? null
        : line.best.time_s - fastest,
  }));
}

/** The latest item at or before `t` (`at` gives its time), else the first one. */
export function latestAt<T>(items: readonly T[], t: number, at: (item: T) => number): T | null {
  let found: T | null = items[0] ?? null;
  for (const item of items) {
    if (at(item) > t) break;
    found = item;
  }
  return found;
}

/** Red flag or safety car under way at `t`. */
export function flagAt(timeline: Timeline, t: number): Timeline["flags"][number] | null {
  return (
    timeline.flags.find((flag) => flag.start_s <= t && t < (flag.end_s ?? timeline.duration_s)) ??
    null
  );
}

/** Session clock as `m:ss` (or `h:mm:ss`), from the start of the session. */
export function clockLabel(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${String(h)}:${String(m).padStart(2, "0")}:${s}` : `${String(m)}:${s}`;
}

/**
 * Where the replay opens: as the fastest lap of the session starts, so the cars are on
 * track and the best lap is about to be set.
 */
export function initialTime(timeline: Timeline): number {
  let best: TimelineLap | null = null;
  for (const car of timeline.cars) {
    const lap = bestLap(car.laps, Infinity);
    if (lap && (best === null || (lap.time_s ?? Infinity) < (best.time_s ?? Infinity))) best = lap;
  }
  return best ? best.start_s : 0;
}

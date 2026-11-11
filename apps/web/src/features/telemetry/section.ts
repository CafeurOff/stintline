import type { Schema } from "@stintline/api-types";

type Car = Schema<"TelemetryCar">;
type Zone = Schema<"BrakingZone">;

/** A part of the lap, in metres from the line, start < end. */
export interface Section {
  start: number;
  end: number;
}

/** Shortest section the zoom accepts: below that the 4 Hz samples say too little. */
export const MIN_SECTION_M = 60;
/** A corner section starts this far before the braking point... */
const CORNER_BEFORE_M = 120;
/** ...and ends this far after the driver is back on full throttle. */
const CORNER_AFTER_M = 220;
const FULL_THROTTLE = 99;

/** `?zoom=1200-1850` in metres; null when absent, malformed or too short. */
export function parseSection(raw: string | null, length: number): Section | null {
  const match = /^(\d+)-(\d+)$/.exec(raw ?? "");
  if (!match) return null;
  return clampSection(Number(match[1]), Number(match[2]), length);
}

export function formatSection(section: Section): string {
  return `${String(Math.round(section.start))}-${String(Math.round(section.end))}`;
}

/** Orders, clamps to the lap and rejects sections shorter than {@link MIN_SECTION_M}. */
export function clampSection(a: number, b: number, length: number): Section | null {
  const start = Math.max(0, Math.min(a, b));
  const end = Math.min(length, Math.max(a, b));
  return end - start >= MIN_SECTION_M ? { start, end } : null;
}

/** Sample indices covered by a section (inclusive), on a grid of `step` metres. */
export function indexRange(section: Section, step: number, points: number): [number, number] {
  const first = Math.max(0, Math.floor(section.start / step));
  const last = Math.min(points - 1, Math.ceil(section.end / step));
  return [first, last];
}

/** One section per braking zone of the reference lap: the approach, the corner, the exit. */
export function cornerSections(zones: readonly Zone[], length: number): Section[] {
  return zones
    .map((zone) =>
      clampSection(zone.start_m - CORNER_BEFORE_M, zone.end_m + CORNER_AFTER_M, length),
    )
    .filter((section): section is Section => section !== null);
}

export interface SectionStats {
  /** Time to cover the section, from speed (the feed has no distance channel). */
  time_s: number;
  min_kph: number;
  max_kph: number;
  avg_kph: number;
  full_throttle_share: number;
  braking_share: number;
}

/** What a car did over samples `first..last`. Time integrates step / speed. */
export function sectionStats(car: Car, step: number, first: number, last: number): SectionStats {
  const speeds = car.speed_kph.slice(first, last + 1);
  const throttle = car.throttle_pct.slice(first, last + 1);
  const brake = car.brake.slice(first, last + 1);
  const n = Math.max(speeds.length, 1);
  let time = 0;
  for (let i = first; i < last; i += 1) {
    const v = ((car.speed_kph[i] ?? 0) + (car.speed_kph[i + 1] ?? 0)) / 2 / 3.6;
    time += v > 0 ? step / v : 0;
  }
  return {
    time_s: time,
    min_kph: Math.min(...speeds),
    max_kph: Math.max(...speeds),
    avg_kph: speeds.reduce((sum, v) => sum + v, 0) / n,
    full_throttle_share: throttle.filter((v) => v >= FULL_THROTTLE).length / n,
    braking_share: brake.filter(Boolean).length / n,
  };
}

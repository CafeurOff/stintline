import type { Schema } from "@stintline/api-types";

import { indexAtTime, valueAt } from "./playback";

type Compare = Schema<"TelemetryCompare">;
type Car = Schema<"TelemetryCar">;

/**
 * Relief is drawn this many times higher than it is. Circuits climb 5 to 100 m over several
 * kilometres: at true scale a 35 m hill is a barely visible ramp from the chase camera.
 */
export const ELEVATION_EXAGGERATION = 2;
/**
 * The ground under a raised part of the track spreads out this far for each unit of
 * height on both sides (an embankment of about 1 in 2.5), so the relief reads as hills
 * rather than a bridge in the air.
 */
export const EMBANKMENT_SPREAD = 2.5;
/** Ground level, just under the lowest point of the track (scene units). */
export const GROUND_LEVEL = -0.6;
/**
 * A car points along its line from this far behind it to this far ahead (m). Over a
 * single 10 m step two samples can nearly coincide (the start of a lap) and the heading or
 * slope goes wild; 20 m each way still follows the tightest hairpin.
 */
export const HEADING_SPAN_M = 20;
/**
 * Steepest nose-up or nose-down drawn (radians, about 17°). Relief is exaggerated, so the
 * steepest real slopes (Eau Rouge, ~18 %) would otherwise tip the car unnaturally.
 */
export const MAX_PITCH = 0.3;
/** Track width drawn, in metres (most F1 circuits are 12 to 15 m wide). */
export const TRACK_WIDTH_M = 14;

/**
 * Scene axes: x to the right as on the 2D map, y up (altitude), z towards the viewer
 * (the map's y, which grows downwards). One scene unit is one screen unit of the map.
 */
export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface Pose extends Point3 {
  /** Rotation around the vertical axis, radians (0 points along +x). */
  yaw: number;
  /** Nose up (positive) or down, radians. */
  pitch: number;
  /** Fractional grid index the car has reached. */
  index: number;
}

/** Altitude channel used for the track: the first car that has one, else flat. */
export function trackElevation(data: Compare): readonly number[] | null {
  return data.cars.find((car) => car.elevation_m)?.elevation_m ?? null;
}

/** Scene height of an altitude in metres (exaggerated, in map units). */
export function sceneHeight(data: Compare, metres: number): number {
  return (metres / data.metres_per_unit) * ELEVATION_EXAGGERATION;
}

function point(data: Compare, car: Car, index: number, heights: readonly number[] | null) {
  const metres = heights ? valueAt(heights, index) : 0;
  return {
    x: valueAt(car.x, index) - data.width / 2,
    y: sceneHeight(data, metres),
    z: valueAt(car.y, index) - data.height / 2,
  };
}

/** Point `index` of the reference line, in scene units. */
export function trackPoint(data: Compare, index: number): Point3 {
  const [reference] = data.cars;
  if (!reference) return { x: 0, y: 0, z: 0 };
  return point(data, reference, index, trackElevation(data));
}

/**
 * The track as a ribbon along the first car's line: two vertices (left, right) per
 * point and two triangles between consecutive points. Plain arrays, turned into a
 * BufferGeometry by the scene.
 */
export function trackRibbon(data: Compare): { positions: Float32Array; indices: Uint32Array } {
  const count = data.points;
  const half = TRACK_WIDTH_M / 2 / data.metres_per_unit;
  const reach = Math.max(1, Math.round(HEADING_SPAN_M / data.step_m));
  const positions = new Float32Array(count * 6);
  const centre = Array.from({ length: count }, (_, i) => trackPoint(data, i));
  centre.forEach((p, i) => {
    const before = centre[Math.max(i - reach, 0)] ?? p;
    const after = centre[Math.min(i + reach, count - 1)] ?? p;
    const dx = after.x - before.x;
    const dz = after.z - before.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;
    positions.set(
      [p.x + nx * half, p.y, p.z + nz * half, p.x - nx * half, p.y, p.z - nz * half],
      i * 6,
    );
  });
  // Open at the line: the two ends of a lap overlap by a few metres, and joining them
  // would twist the last strip into a knot.
  const indices = new Uint32Array((count - 1) * 6);
  for (let i = 0; i < count - 1; i++) {
    const a = i * 2;
    const b = (i + 1) * 2;
    indices.set([a, b, a + 1, a + 1, b, b + 1], i * 6);
  }
  return { positions, indices };
}

/** Where a car is at `clock` seconds into the lap, and where it points. */
export function carPose(data: Compare, car: Car, clock: number): Pose {
  const heights = car.elevation_m ?? trackElevation(data);
  const index = indexAtTime(car.t_s, clock);
  const last = data.points - 1;
  const here = point(data, car, index, heights);
  const reach = Math.max(1, Math.round(HEADING_SPAN_M / data.step_m));
  const before = point(data, car, Math.max(index - reach, 0), heights);
  const after = point(data, car, Math.min(index + reach, last), heights);
  const dx = after.x - before.x;
  const dz = after.z - before.z;
  const flat = Math.hypot(dx, dz);
  const slope = flat > 0 ? Math.atan2(after.y - before.y, flat) : 0;
  return {
    ...here,
    index,
    yaw: Math.atan2(-dz, dx),
    pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, slope)),
  };
}

/** The start and finish line: where the first car's lap begins, and the way it runs. */
export function startLine(data: Compare): { at: Point3; yaw: number } {
  const at = trackPoint(data, 0);
  const reach = Math.max(1, Math.round(HEADING_SPAN_M / data.step_m));
  const ahead = trackPoint(data, Math.min(reach, data.points - 1));
  return { at, yaw: Math.atan2(-(ahead.z - at.z), ahead.x - at.x) };
}

/** Unit vector the car points along, in the ground plane. */
export function heading(pose: Pose): { x: number; z: number } {
  return { x: Math.cos(pose.yaw), z: -Math.sin(pose.yaw) };
}

/**
 * Trackside camera: the next post ahead of the car, every `every` metres, set back from
 * the track edge. The view cuts to the following post once the car has passed.
 */
export function tracksidePost(
  data: Compare,
  index: number,
  every: number,
  setBackM: number,
  heightM: number,
): Point3 {
  const step = Math.max(1, Math.round(every / data.step_m));
  const post = (Math.floor(index / step) + 1) * step;
  const at = Math.min(post, data.points - 1);
  const p = trackPoint(data, at);
  const before = trackPoint(data, Math.max(at - 1, 0));
  const after = trackPoint(data, Math.min(at + 1, data.points - 1));
  const dx = after.x - before.x;
  const dz = after.z - before.z;
  const length = Math.hypot(dx, dz) || 1;
  const out = setBackM / data.metres_per_unit;
  return {
    x: p.x - (dz / length) * out,
    y: p.y + heightM / data.metres_per_unit,
    z: p.z + (dx / length) * out,
  };
}

/**
 * Slopes from both edges of the track down to the ground: for each point and side, the
 * edge on top and a foot pushed outwards in proportion to the height.
 */
export function trackEmbankments(ribbon: Float32Array): {
  positions: Float32Array;
  indices: Uint32Array;
} {
  const count = ribbon.length / 6;
  const positions = new Float32Array(count * 12);
  for (let i = 0; i < count; i++) {
    const left = ribbon.subarray(i * 6, i * 6 + 3);
    const right = ribbon.subarray(i * 6 + 3, i * 6 + 6);
    const lx = left[0] ?? 0;
    const ly = left[1] ?? 0;
    const lz = left[2] ?? 0;
    const rx = right[0] ?? 0;
    const ry = right[1] ?? 0;
    const rz = right[2] ?? 0;
    const width = Math.hypot(lx - rx, lz - rz) || 1;
    const ox = (lx - rx) / width;
    const oz = (lz - rz) / width;
    const leftFoot = (ly - GROUND_LEVEL) * EMBANKMENT_SPREAD;
    const rightFoot = (ry - GROUND_LEVEL) * EMBANKMENT_SPREAD;
    positions.set(
      [
        lx,
        ly,
        lz,
        lx + ox * leftFoot,
        GROUND_LEVEL,
        lz + oz * leftFoot,
        rx,
        ry,
        rz,
        rx - ox * rightFoot,
        GROUND_LEVEL,
        rz - oz * rightFoot,
      ],
      i * 12,
    );
  }
  const indices = new Uint32Array((count - 1) * 12);
  for (let i = 0; i < count - 1; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    // Left slope (edge a, foot a + 1), right slope (edge a + 2, foot a + 3).
    indices.set([a, a + 1, b, b, a + 1, b + 1, a + 2, b + 2, a + 3, b + 2, b + 3, a + 3], i * 12);
  }
  return { positions, indices };
}

/**
 * Cars closer than this along the lap (m) would overlap: a car is 5.6 m long, and two laps
 * driven on almost the same line put one inside the other.
 */
export const SIDE_BY_SIDE_M = 8;
/** Distance between the centres of two cars side by side (m): 2 m wide plus a gap. */
export const LANE_M = 2.4;

/**
 * Moves a car that would overlap another out to the side, like two cars running side by
 * side, and lets it back onto its own line as the gap opens. Drivers' lines differ by a
 * metre or two, so the shift is measured from the car it would hit: the later car is
 * pushed until the two are a lane apart across the track. It keeps the side it is already
 * on (the first car's right when exactly behind, the left for a third car), and the shift
 * eases in with the closeness, so nothing jumps.
 */
export function sideBySide(data: Compare, poses: readonly Pose[]): Pose[] {
  const lane = LANE_M / data.metres_per_unit;
  const reach = SIDE_BY_SIDE_M / data.metres_per_unit;
  const placed: Pose[] = [];
  poses.forEach((pose, index) => {
    let moved = pose;
    for (const other of placed) {
      const ahead = heading(other);
      const dx = moved.x - other.x;
      const dz = moved.z - other.z;
      const along = dx * ahead.x + dz * ahead.z;
      const across = -dx * ahead.z + dz * ahead.x;
      const closeness = Math.max(0, 1 - Math.abs(along) / reach);
      const needed = lane * closeness * closeness * (3 - 2 * closeness);
      if (Math.abs(across) >= needed) continue;
      const side = Math.abs(across) > lane * 0.1 ? Math.sign(across) : index % 2 === 1 ? 1 : -1;
      const push = side * needed - across;
      moved = { ...moved, x: moved.x - ahead.z * push, z: moved.z + ahead.x * push };
    }
    placed.push(moved);
  });
  return placed;
}

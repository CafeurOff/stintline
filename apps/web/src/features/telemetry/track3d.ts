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
 * The track as a closed ribbon along the first car's line: two vertices (left, right) per
 * point and two triangles between consecutive points. Plain arrays, turned into a
 * BufferGeometry by the scene.
 */
export function trackRibbon(data: Compare): { positions: Float32Array; indices: Uint32Array } {
  const count = data.points;
  const half = TRACK_WIDTH_M / 2 / data.metres_per_unit;
  const positions = new Float32Array(count * 6);
  const centre = Array.from({ length: count }, (_, i) => trackPoint(data, i));
  centre.forEach((p, i) => {
    const before = centre[(i - 1 + count) % count] ?? p;
    const after = centre[(i + 1) % count] ?? p;
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
  const indices = new Uint32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const a = i * 2;
    const b = ((i + 1) % count) * 2;
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
  const before = point(data, car, Math.max(index - 1, 0), heights);
  const after = point(data, car, Math.min(index + 1, last), heights);
  const dx = after.x - before.x;
  const dz = after.z - before.z;
  const flat = Math.hypot(dx, dz);
  return {
    ...here,
    index,
    yaw: Math.atan2(-dz, dx),
    pitch: flat > 0 ? Math.atan2(after.y - before.y, flat) : 0,
  };
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
  const indices = new Uint32Array(count * 12);
  for (let i = 0; i < count; i++) {
    const a = i * 4;
    const b = ((i + 1) % count) * 4;
    // Left slope (edge a, foot a + 1), right slope (edge a + 2, foot a + 3).
    indices.set([a, a + 1, b, b, a + 1, b + 1, a + 2, b + 2, a + 3, b + 2, b + 3, a + 3], i * 12);
  }
  return { positions, indices };
}

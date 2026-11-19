/**
 * Geometry of our own low-poly single-seater (no team livery, no official model). Sizes are
 * metres in the car's frame: +x forward, +y up, +z to the car's left. The car is 5.6 m long
 * and 2 m wide like a current Formula 1 car.
 *
 * Bodywork is lofted: rounded cross-sections (superellipses) placed along the car and joined
 * into one smooth tapered volume, so the nose narrows, the sidepods swell and the engine
 * cover falls towards the rear wing.
 */

export interface Station {
  /** Position along the car (m, forward positive). */
  x: number;
  /** Half the width of the section (m). */
  halfWidth: number;
  bottom: number;
  top: number;
}

export interface Mesh {
  positions: Float32Array;
  indices: Uint32Array;
}

/** Points around each section: enough for a smooth outline, few enough to stay low-poly. */
export const SECTION_POINTS = 16;
/** 2 is an ellipse; higher is boxier. Bodywork reads as moulded carbon around 2.5. */
export const SECTION_ROUNDNESS = 2.5;

function superellipse(angle: number, exponent: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const e = 2 / exponent;
  return [Math.sign(c) * Math.abs(c) ** e, Math.sign(s) * Math.abs(s) ** e];
}

/**
 * One closed volume through `stations` (front first). Faces point outwards: each ring is
 * joined to the next, and both ends are capped.
 */
export function loft(
  stations: readonly Station[],
  points = SECTION_POINTS,
  exponent = SECTION_ROUNDNESS,
): Mesh {
  const rings = stations.length;
  const positions = new Float32Array((rings * points + 2) * 3);
  stations.forEach((station, ring) => {
    const centre = (station.top + station.bottom) / 2;
    const half = (station.top - station.bottom) / 2;
    for (let k = 0; k < points; k++) {
      const [z, y] = superellipse((2 * Math.PI * k) / points, exponent);
      positions.set([station.x, centre + y * half, z * station.halfWidth], (ring * points + k) * 3);
    }
  });
  const first = stations[0];
  const last = stations[rings - 1];
  const front = rings * points;
  const back = front + 1;
  if (first) positions.set([first.x, (first.top + first.bottom) / 2, 0], front * 3);
  if (last) positions.set([last.x, (last.top + last.bottom) / 2, 0], back * 3);

  const indices: number[] = [];
  for (let ring = 0; ring < rings - 1; ring++) {
    for (let k = 0; k < points; k++) {
      const a = ring * points + k;
      const b = ring * points + ((k + 1) % points);
      const c = a + points;
      const d = b + points;
      indices.push(a, b, c, b, d, c);
    }
  }
  const lastRing = (rings - 1) * points;
  for (let k = 0; k < points; k++) {
    const next = (k + 1) % points;
    indices.push(front, next, k);
    indices.push(back, lastRing + k, lastRing + next);
  }
  return { positions, indices: Uint32Array.from(indices) };
}

/** Survival cell and nose: thin at the tip, widest at the cockpit. */
export const CHASSIS: readonly Station[] = [
  { x: 2.85, halfWidth: 0.05, bottom: 0.2, top: 0.27 },
  { x: 2.45, halfWidth: 0.12, bottom: 0.18, top: 0.34 },
  { x: 1.8, halfWidth: 0.2, bottom: 0.16, top: 0.45 },
  { x: 1.1, halfWidth: 0.29, bottom: 0.14, top: 0.56 },
  { x: 0.45, halfWidth: 0.37, bottom: 0.12, top: 0.6 },
  { x: -0.2, halfWidth: 0.36, bottom: 0.12, top: 0.6 },
];

/** Sidepods: an intake at the front, undercut and tapering to the gearbox. */
export const SIDEPODS: readonly Station[] = [
  { x: 0.45, halfWidth: 0.6, bottom: 0.2, top: 0.5 },
  { x: 0.25, halfWidth: 0.78, bottom: 0.14, top: 0.54 },
  { x: -0.5, halfWidth: 0.74, bottom: 0.12, top: 0.52 },
  { x: -1.2, halfWidth: 0.5, bottom: 0.12, top: 0.42 },
  { x: -1.85, halfWidth: 0.22, bottom: 0.14, top: 0.32 },
];

/** Engine cover: the airbox above the driver's head, falling to the rear wing. */
export const ENGINE_COVER: readonly Station[] = [
  { x: 0.2, halfWidth: 0.2, bottom: 0.45, top: 0.72 },
  { x: -0.1, halfWidth: 0.26, bottom: 0.45, top: 0.98 },
  { x: -0.7, halfWidth: 0.24, bottom: 0.4, top: 0.86 },
  { x: -1.5, halfWidth: 0.14, bottom: 0.32, top: 0.6 },
  { x: -2.15, halfWidth: 0.07, bottom: 0.3, top: 0.46 },
];

/** Floor: a flat plank, widest between the wheels. */
export const FLOOR: readonly Station[] = [
  { x: 1.5, halfWidth: 0.45, bottom: 0.05, top: 0.09 },
  { x: 0.9, halfWidth: 0.82, bottom: 0.05, top: 0.09 },
  { x: -1.3, halfWidth: 0.82, bottom: 0.05, top: 0.09 },
  { x: -2.0, halfWidth: 0.55, bottom: 0.06, top: 0.1 },
];

export interface Wheel {
  x: number;
  /** Distance of the wheel centre from the car's axis. */
  z: number;
  radius: number;
  width: number;
}

/** Front tyres are narrower than the rears. */
export const WHEELS: readonly Wheel[] = [
  { x: 1.75, z: 0.8, radius: 0.36, width: 0.34 },
  { x: 1.75, z: -0.8, radius: 0.36, width: 0.34 },
  { x: -1.6, z: 0.76, radius: 0.37, width: 0.42 },
  { x: -1.6, z: -0.76, radius: 0.37, width: 0.42 },
];

export interface Plate {
  size: [number, number, number];
  at: [number, number, number];
  /** Angle of attack around the z axis (radians, leading edge up when positive). */
  pitch?: number;
  paint: "team" | "carbon";
}

/** Wings, endplates, mirrors and the rear wing pillar. */
export const PLATES: readonly Plate[] = [
  // Front wing: main plane, two flaps, endplates.
  { size: [0.34, 0.025, 1.84], at: [2.72, 0.1, 0], pitch: 0.06, paint: "carbon" },
  { size: [0.22, 0.02, 1.7], at: [2.55, 0.16, 0], pitch: 0.3, paint: "team" },
  { size: [0.16, 0.02, 1.6], at: [2.42, 0.22, 0], pitch: 0.55, paint: "team" },
  { size: [0.52, 0.24, 0.025], at: [2.62, 0.18, 0.93], paint: "carbon" },
  { size: [0.52, 0.24, 0.025], at: [2.62, 0.18, -0.93], paint: "carbon" },
  // Rear wing: main plane, flap, endplates, beam wing, pillar.
  { size: [0.3, 0.03, 1.0], at: [-2.36, 0.82, 0], pitch: 0.12, paint: "carbon" },
  { size: [0.2, 0.022, 0.98], at: [-2.47, 0.95, 0], pitch: 0.5, paint: "team" },
  { size: [0.62, 0.46, 0.03], at: [-2.36, 0.8, 0.51], paint: "team" },
  { size: [0.62, 0.46, 0.03], at: [-2.36, 0.8, -0.51], paint: "team" },
  { size: [0.2, 0.02, 0.8], at: [-2.3, 0.4, 0], pitch: 0.2, paint: "carbon" },
  { size: [0.06, 0.38, 0.03], at: [-2.25, 0.62, 0], paint: "carbon" },
  // Mirrors.
  { size: [0.1, 0.06, 0.16], at: [0.78, 0.68, 0.48], paint: "team" },
  { size: [0.1, 0.06, 0.16], at: [0.78, 0.68, -0.48], paint: "team" },
];

export interface Arm {
  from: [number, number, number];
  to: [number, number, number];
}

/** Suspension wishbones: from the body to each wheel, an upper and a lower arm. */
export const ARMS: readonly Arm[] = WHEELS.flatMap((wheel) => {
  const inboard = wheel.x > 0 ? 0.25 : 0.3;
  const side = Math.sign(wheel.z);
  return [
    {
      from: [wheel.x + 0.15, 0.42, side * inboard],
      to: [wheel.x, 0.5, wheel.z - (side * wheel.width) / 2],
    },
    {
      from: [wheel.x - 0.15, 0.2, side * inboard],
      to: [wheel.x, 0.24, wheel.z - (side * wheel.width) / 2],
    },
  ];
});

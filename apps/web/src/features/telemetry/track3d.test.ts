import { telemetryCompare } from "@/test/fixtures/telemetry";

import {
  carPose,
  ELEVATION_EXAGGERATION,
  EMBANKMENT_SPREAD,
  GROUND_LEVEL,
  heading,
  sceneHeight,
  trackElevation,
  trackEmbankments,
  trackPoint,
  trackRibbon,
  tracksidePost,
} from "./track3d";

const data = telemetryCompare;
const [norris] = data.cars;
if (!norris) throw new Error("fixture has cars");

describe("track in 3D", () => {
  it("centres the circuit and raises it by its exaggerated relief", () => {
    const start = trackPoint(data, 0);

    expect(start.x).toBeCloseTo((norris.x[0] ?? 0) - data.width / 2);
    expect(start.z).toBeCloseTo((norris.y[0] ?? 0) - data.height / 2);
    expect(start.y).toBeCloseTo(sceneHeight(data, norris.elevation_m[0] ?? 0));
    expect(sceneHeight(data, data.metres_per_unit)).toBe(ELEVATION_EXAGGERATION);
  });

  it("builds a closed ribbon of two vertices and two triangles per point", () => {
    const { positions, indices } = trackRibbon(data);

    expect(positions).toHaveLength(data.points * 6);
    expect(indices).toHaveLength(data.points * 6);
    expect(Math.max(...indices)).toBe(data.points * 2 - 1);
    // Left and right edges sit one track width apart.
    const width = Math.hypot(
      (positions[0] ?? 0) - (positions[3] ?? 0),
      (positions[2] ?? 0) - (positions[5] ?? 0),
    );
    expect(width * data.metres_per_unit).toBeCloseTo(14, 0);
  });

  it("lies flat without altitude", () => {
    const flat = { ...data, cars: data.cars.map((car) => ({ ...car, elevation_m: null })) };

    expect(trackElevation(flat)).toBeNull();
    expect(trackPoint(flat, 100).y).toBe(0);
    expect(trackPoint({ ...data, cars: [] }, 3)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("points each car along its line and tilts it with the slope", () => {
    const pose = carPose(data, norris, 20);
    const ahead = trackPoint(data, Math.min(Math.round(pose.index) + 3, data.points - 1));
    const direction = heading(pose);

    expect(pose.index).toBeGreaterThan(0);
    expect(direction.x * (ahead.x - pose.x) + direction.z * (ahead.z - pose.z)).toBeGreaterThan(0);
    expect(Math.abs(pose.pitch)).toBeLessThan(0.5);
  });

  it("places trackside posts ahead of the car, off the track", () => {
    const post = tracksidePost(data, 10, 350, 30, 6);
    const near = trackPoint(data, 35);

    expect(Math.hypot(post.x - near.x, post.z - near.z) * data.metres_per_unit).toBeCloseTo(30, -1);
    expect(post.y).toBeGreaterThan(near.y);
    expect(tracksidePost(data, data.points - 1, 350, 30, 6)).toBeDefined();
  });
});

describe("embankments", () => {
  it("slope from each track edge down to the ground, wider under higher track", () => {
    const { positions: ribbon } = trackRibbon(data);

    const { positions, indices } = trackEmbankments(ribbon);

    expect(positions).toHaveLength(data.points * 12);
    expect(indices).toHaveLength(data.points * 12);
    const edgeHeight = (positions[1] ?? 0) - GROUND_LEVEL;
    const foot = Math.hypot(
      (positions[3] ?? 0) - (positions[0] ?? 0),
      (positions[5] ?? 0) - (positions[2] ?? 0),
    );
    expect(positions[4]).toBeCloseTo(GROUND_LEVEL);
    expect(foot).toBeCloseTo(edgeHeight * EMBANKMENT_SPREAD, 3);
  });
});

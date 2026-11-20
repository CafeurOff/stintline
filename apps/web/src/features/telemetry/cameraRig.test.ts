import { PerspectiveCamera, Vector3 } from "three";

import { telemetryCompare } from "@/test/fixtures/telemetry";

import { moveCamera } from "./cameraRig";
import { carPose } from "./track3d";

const data = telemetryCompare;
const [reference] = data.cars;

function settle(mode: "top" | "chase" | "trackside") {
  const view = new PerspectiveCamera(50, 16 / 9, 0.5, 20000);
  const target = new Vector3();
  if (!reference) throw new Error("no car in the fixture");
  const pose = carPose(data, reference, 10);
  for (let frame = 0; frame < 200; frame++) moveCamera(view, target, data, mode, pose, 1 / 60);
  return { view, target, pose };
}

describe("moveCamera", () => {
  it("looks at the middle of the circuit from above in the top view", () => {
    const { view, target } = settle("top");

    expect(target.length()).toBeLessThan(1);
    expect(view.position.y).toBeGreaterThan(Math.max(data.width, data.height) / 2);
  });

  it("follows the car from behind and just above it", () => {
    const { view, target, pose } = settle("chase");

    expect(view.position.y).toBeGreaterThan(pose.y);
    expect(view.position.distanceTo(new Vector3(pose.x, pose.y, pose.z))).toBeLessThan(
      20 / data.metres_per_unit,
    );
    expect(target.distanceTo(new Vector3(pose.x, pose.y, pose.z))).toBeGreaterThan(0);
  });

  it("uses a long lens from the trackside post", () => {
    const { view } = settle("trackside");

    expect(view.getEffectiveFOV()).toBeCloseTo(24, 1);
  });
});

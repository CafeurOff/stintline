import { trackPoint } from "@/features/telemetry/track3d";
import { telemetryCompare } from "@/test/fixtures/telemetry";

import { racePoses } from "./race3d";

const data = telemetryCompare;

describe("racePoses", () => {
  it("puts a car at the start of its lap on the line", () => {
    const [pose] = racePoses(data, [0]);
    const line = trackPoint(data, 0);

    expect(pose?.x).toBeCloseTo(line.x, 0);
    expect(pose?.z).toBeCloseTo(line.z, 0);
  });

  it("moves cars along the lap with the share they have run", () => {
    const [early, late] = racePoses(data, [0.25, 0.75]);

    expect(early?.index).toBeGreaterThan(0);
    expect(late?.index ?? 0).toBeGreaterThan(early?.index ?? 0);
    expect(late?.index ?? 0).toBeLessThan(data.points);
  });

  it("reads a whole number of laps as the start of the next one", () => {
    const [next, start] = racePoses(data, [3, 0]);

    expect(next?.index).toBeCloseTo(start?.index ?? -1, 5);
  });

  it("sets cars on the same spot side by side", () => {
    const [a, b] = racePoses(data, [0.5, 0.5]);

    expect(Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0))).toBeGreaterThan(0);
  });

  it("has nothing to draw without a reference lap", () => {
    expect(racePoses({ ...data, cars: [] }, [0.5])).toEqual([]);
  });
});

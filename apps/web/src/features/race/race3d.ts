import type { Schema } from "@stintline/api-types";

import { lapEnd } from "@/features/telemetry/playback";
import { carPose, type Pose, sideBySide } from "@/features/telemetry/track3d";

type Compare = Schema<"TelemetryCompare">;

/** A car of the race replay as the 3D view draws it. */
export interface RaceCar3D {
  carNumber: number;
  code: string;
  colour: string;
  /** Share of its current lap the car has run, from 0 at the line. */
  fraction: number;
  selected: boolean;
}

/**
 * Where each car stands on the 3D track. A car that has run a share of its lap is placed
 * where the reference lap was after the same share of its time, as on the 2D map, whose
 * outline is sampled evenly in time. Cars on the same spot are set side by side.
 */
export function racePoses(data: Compare, fractions: readonly number[]): Pose[] {
  const [reference] = data.cars;
  if (!reference) return [];
  const lap = lapEnd(reference);
  return sideBySide(
    data,
    fractions.map((fraction) => carPose(data, reference, (((fraction % 1) + 1) % 1) * lap)),
  );
}

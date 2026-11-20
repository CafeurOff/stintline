import type { Schema } from "@stintline/api-types";
import { type PerspectiveCamera, Vector3 } from "three";

import { heading, type Pose, tracksidePost } from "./track3d";

type Compare = Schema<"TelemetryCompare">;
export type CameraMode = "chase" | "top" | "trackside";

/** Chase camera: this far behind the car and above it, looking this far ahead (metres). */
const CHASE_BACK_M = 14;
const CHASE_UP_M = 4.5;
const CHASE_AHEAD_M = 18;
/** Top camera: room kept around the circuit, and how far it leans back (radians from
 * straight down) so the relief still reads. */
const TOP_MARGIN = 1.15;
const TOP_TILT = 0.3;
/** Share of the gap to the target position the camera closes each frame at 60 fps. */
const CAMERA_EASE = 0.15;
/** Trackside posts: one every this many metres, set back and raised (metres). */
const TRACKSIDE_EVERY_M = 180;
const TRACKSIDE_SET_BACK_M = 30;
const TRACKSIDE_HEIGHT_M = 6;
/** Vertical field of view in degrees: a long lens by the track, a wider one behind. */
const TRACKSIDE_FOV = 24;
const CHASE_FOV = 50;

/**
 * Moves the camera one frame towards its place for `mode`: the whole circuit from above,
 * behind the followed car, or on the next trackside post ahead of it. `target` keeps the
 * point the camera looks at between frames.
 */
export function moveCamera(
  view: PerspectiveCamera,
  target: Vector3,
  data: Compare,
  mode: CameraMode,
  followed: Pose,
  delta: number,
  tilt = TOP_TILT,
): void {
  const ease = 1 - Math.pow(1 - CAMERA_EASE, delta * 60);
  const unit = 1 / data.metres_per_unit;
  if (mode === "top") {
    // Far enough for the whole circuit to fit the panel, whatever its shape.
    const half = Math.tan((view.fov * Math.PI) / 360);
    const fit = Math.max(data.height / 2, data.width / 2 / view.aspect) / half;
    const distance = fit * TOP_MARGIN;
    view.position.lerp(new Vector3(0, distance * Math.cos(tilt), distance * Math.sin(tilt)), ease);
    target.lerp(new Vector3(0, 0, 0), ease);
  } else if (mode === "chase") {
    const ahead = heading(followed);
    view.position.lerp(
      new Vector3(
        followed.x - ahead.x * CHASE_BACK_M * unit,
        followed.y + CHASE_UP_M * unit,
        followed.z - ahead.z * CHASE_BACK_M * unit,
      ),
      ease,
    );
    target.set(
      followed.x + ahead.x * CHASE_AHEAD_M * unit,
      followed.y,
      followed.z + ahead.z * CHASE_AHEAD_M * unit,
    );
  } else {
    const post = tracksidePost(
      data,
      followed.index,
      TRACKSIDE_EVERY_M,
      TRACKSIDE_SET_BACK_M,
      TRACKSIDE_HEIGHT_M,
    );
    view.position.set(post.x, post.y, post.z);
    target.set(followed.x, followed.y, followed.z);
  }
  const fov = mode === "trackside" ? TRACKSIDE_FOV : CHASE_FOV;
  if (Math.abs(view.getEffectiveFOV() - fov) > 0.01) {
    // A method call, not a field write: it also updates the projection.
    view.setFocalLength((0.5 * view.getFilmHeight()) / Math.tan((fov * Math.PI) / 360));
  }
  view.lookAt(target);
}

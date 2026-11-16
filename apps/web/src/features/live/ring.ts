import type { Schema } from "@stintline/api-types";

type Car = Schema<"LiveCar">;

/** Lap time used to place lapped cars when the leader has no lap time yet. */
export const FALLBACK_LAP_S = 90;

export function running(cars: readonly Car[]): Car[] {
  return cars.filter((c) => !c.retired && !c.stopped && c.position != null);
}

/** One leader lap, the scale of the ring. */
export function referenceLap(cars: readonly Car[]): number {
  return running(cars)[0]?.last_lap_s ?? FALLBACK_LAP_S;
}

/** Seconds behind the leader for every running car (a lap down = one leader lap), as the
 * API's pit-now estimate counts them. */
export function raceGaps(cars: readonly Car[]): Map<number, number> {
  const list = running(cars);
  const lap = referenceLap(cars);
  const out = new Map<number, number>();
  list.forEach((car, index) => {
    if (index === 0) out.set(car.number, 0);
    else if (car.gap_s != null) out.set(car.number, car.gap_s);
    else out.set(car.number, (car.laps_behind || 1) * lap);
  });
  return out;
}

/** Angle on the ring (radians, 0 at the top, cars behind counter-clockwise). */
export function ringAngle(gapS: number, lapS: number): number {
  return -((gapS % lapS) / lapS) * 2 * Math.PI;
}

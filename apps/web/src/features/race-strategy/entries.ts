import type { Schema } from "@stintline/api-types";

export type Entry = Schema<"Entry">;

/** Short label for charts (`NOR`), falling back to the car number. */
export function driverCode(entry: Pick<Entry, "driver" | "car_number">): string {
  return entry.driver.code ?? `#${entry.car_number}`;
}

export function driverName(entry: Pick<Entry, "driver">): string {
  return `${entry.driver.given_name} ${entry.driver.family_name}`;
}

/** Classified finishers first by position, then everyone else by car number. */
export function byFinish<T extends { finish_position?: number | null; car_number: number }>(
  a: T,
  b: T,
): number {
  const pa = a.finish_position ?? Number.POSITIVE_INFINITY;
  const pb = b.finish_position ?? Number.POSITIVE_INFINITY;
  return pa === pb ? a.car_number - b.car_number : pa - pb;
}

export function entriesByCar(entries: readonly Entry[]): Map<number, Entry> {
  return new Map(entries.map((entry) => [entry.car_number, entry]));
}

import type { Schema } from "@stintline/api-types";

export type LiveSnapshot = Schema<"LiveSnapshot">;

export interface Buffered {
  receivedAt: number;
  snapshot: LiveSnapshot;
}

/** Snapshots kept for the TV delay: enough for the longest delay offered. */
export const BUFFER_MS = 5 * 60_000;
/** Delays offered to match the TV picture, in seconds. */
export const TV_DELAYS = [0, 15, 30, 60] as const;
export type TvDelay = (typeof TV_DELAYS)[number];

/** Add a snapshot and drop those older than the buffer. */
export function push(buffer: readonly Buffered[], item: Buffered): Buffered[] {
  return [...buffer.filter((b) => item.receivedAt - b.receivedAt <= BUFFER_MS), item];
}

/** The snapshot to show `delayS` seconds behind real time (the oldest one if the buffer is
 * not that long yet, so the page never goes blank while the delay fills up). */
export function delayed(buffer: readonly Buffered[], now: number, delayS: number): Buffered | null {
  const target = now - delayS * 1000;
  let shown: Buffered | null = null;
  for (const item of buffer) {
    if (item.receivedAt <= target) shown = item;
  }
  return shown ?? buffer[0] ?? null;
}

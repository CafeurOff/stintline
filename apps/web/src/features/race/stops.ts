import type { Schema } from "@stintline/api-types";

import type { Entry } from "./entries";

type PitExit = Schema<"PitExitResult">;

export interface StopNeighbours {
  ahead: { entry: Entry; gap: number } | null;
  behind: { entry: Entry; gap: number } | null;
  close: Entry[];
}

/** Closest rival rejoining ahead and behind, and the fights inside the uncertainty. */
export function neighbours(result: PitExit, byCar: Map<number, Entry>): StopNeighbours {
  let ahead: StopNeighbours["ahead"] = null;
  let behind: StopNeighbours["behind"] = null;
  const close: Entry[] = [];
  for (const rival of result.rivals) {
    const entry = byCar.get(rival.car);
    if (!entry) continue;
    if (rival.margin_s < 0 && (!ahead || -rival.margin_s < ahead.gap))
      ahead = { entry, gap: -rival.margin_s };
    if (rival.margin_s >= 0 && (!behind || rival.margin_s < behind.gap))
      behind = { entry, gap: rival.margin_s };
    if (Math.abs(rival.margin_s) < result.sigma_s) close.push(entry);
  }
  return { ahead, behind, close };
}

import type { Schema } from "@stintline/api-types";

import { compoundInfo } from "@/lib/compounds";

type EntryStints = Schema<"EntryStints">;

/** Compound letters in stint order (`M-H`), the usual way to name a strategy. */
export function strategyLabel(row: Pick<EntryStints, "stints">): string {
  return [...row.stints]
    .sort((a, b) => a.stint_number - b.stint_number)
    .map((stint) => compoundInfo(stint.compound).letter)
    .join("-");
}

/** Strategies used by the field, most common first. */
export function strategyCounts(rows: readonly EntryStints[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.stints.length === 0) continue;
    const label = strategyLabel(row);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

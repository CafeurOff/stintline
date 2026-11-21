import type { Schema } from "@stintline/api-types";

export type FormRace = Schema<"FormRace">;

/** Jolpica gives retired cars an order too: only a numeric classification is a finish. */
export function finishOf(race: FormRace): number | null {
  return /^\d+$/.test(race.classification) ? race.finish_position : null;
}

/** Places gained (positive) or lost from the grid; null for a pit-lane start or no finish. */
export function placesGained(race: FormRace): number | null {
  const finish = finishOf(race);
  if (finish === null || race.grid_position === null || race.grid_position === 0) return null;
  return race.grid_position - finish;
}

export interface FormSummary {
  races: number;
  wins: number;
  /** Podiums other than wins. */
  podiums: number;
  /** Mean grid slot, pit-lane starts left out. */
  averageGrid: number | null;
  /** Mean finishing place over the classified finishes. */
  averageFinish: number | null;
  /** Mean pace gap to the teammate (negative: quicker), over the races that have one. */
  averageGap: number | null;
  /** Races with a pace gap, and how many of them the driver was quicker. */
  paced: number;
  quicker: number;
  /** Family name of the teammate when every paced race was against the same one. */
  teammate: string | null;
}

function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** The figures of the strip's summary line, which is also its text alternative. */
export function formSummary(races: readonly FormRace[]): FormSummary {
  const finishes = races.map(finishOf).filter((p): p is number => p !== null);
  const grids = races.map((r) => r.grid_position).filter((g): g is number => g !== null && g > 0);
  const paced = races.filter((r): r is FormRace & { pace_gap_s: number } => r.pace_gap_s !== null);
  const teammates = new Set(paced.map((r) => r.teammate?.ref ?? ""));
  return {
    races: races.length,
    wins: finishes.filter((p) => p === 1).length,
    podiums: finishes.filter((p) => p === 2 || p === 3).length,
    averageGrid: mean(grids),
    averageFinish: mean(finishes),
    averageGap: mean(paced.map((r) => r.pace_gap_s)),
    paced: paced.length,
    quicker: paced.filter((r) => r.pace_gap_s < 0).length,
    teammate: teammates.size === 1 ? (paced[0]?.teammate?.family_name ?? null) : null,
  };
}

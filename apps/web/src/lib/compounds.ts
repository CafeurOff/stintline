export type CompoundKey = "SOFT" | "MEDIUM" | "HARD" | "INTERMEDIATE" | "WET" | "UNKNOWN";

export interface CompoundInfo {
  key: CompoundKey;
  label: string;
  letter: string;
  /** CSS colour (a theme token), shared by both themes and paired with a dark letter. */
  fill: string;
}

const COMPOUNDS: Record<CompoundKey, CompoundInfo> = {
  SOFT: { key: "SOFT", label: "Soft", letter: "S", fill: "var(--color-tyre-soft)" },
  MEDIUM: { key: "MEDIUM", label: "Medium", letter: "M", fill: "var(--color-tyre-medium)" },
  HARD: { key: "HARD", label: "Hard", letter: "H", fill: "var(--color-tyre-hard)" },
  INTERMEDIATE: {
    key: "INTERMEDIATE",
    label: "Intermediate",
    letter: "I",
    fill: "var(--color-tyre-inter)",
  },
  WET: { key: "WET", label: "Wet", letter: "W", fill: "var(--color-tyre-wet)" },
  UNKNOWN: { key: "UNKNOWN", label: "Unknown", letter: "?", fill: "var(--color-tyre-unknown)" },
};

/** Dry and wet compounds a simulation can be run with, in display order. */
export const RACE_COMPOUNDS = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"] as const;

function isCompoundKey(value: string): value is CompoundKey {
  return value in COMPOUNDS;
}

/** Display info for an upstream compound string. Unknown or null values map to UNKNOWN. */
export function compoundInfo(compound: string | null | undefined): CompoundInfo {
  const key = (compound ?? "").toUpperCase();
  return isCompoundKey(key) ? COMPOUNDS[key] : COMPOUNDS.UNKNOWN;
}

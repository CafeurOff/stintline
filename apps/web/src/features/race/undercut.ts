type TyreCompound = "SOFT" | "MEDIUM" | "HARD";

/** Dry compounds offered for the attacker's new set (the defender gets the same). */
export const UNDERCUT_COMPOUNDS: readonly TyreCompound[] = ["SOFT", "MEDIUM", "HARD"];
/** Laps the defender waits before reacting; the API accepts up to 10. */
export const REACTIONS = ["0", "1", "2", "3"] as const;

export interface UndercutChoice {
  defender: number;
  compound: TyreCompound;
  reaction: (typeof REACTIONS)[number];
}

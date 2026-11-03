import type { Schema } from "@stintline/api-types";

import { RACE_COMPOUNDS } from "@/lib/compounds";
import { intParam } from "@/lib/useSearchParam";

type TyreCompound = Schema<"TyreCompoundEnum">;
type Neutralisation = Schema<"NeutralisationEnum">;

/** Debounce applied to slider-driven simulations, short enough to feel live. */
export const SIMULATION_DEBOUNCE_MS = 250;
/** Upper bound of the defender reaction slider (the API accepts up to 10). */
export const MAX_REACTION_LAPS = 5;
/** Default stop laps as a share of race distance, typical one-stop windows. */
export const DEFAULT_UNDERCUT_SHARE = 0.3;
export const DEFAULT_PIT_EXIT_SHARE = 0.5;

export function compoundParam(params: URLSearchParams, key: string, fallback: TyreCompound) {
  const raw = params.get(key);
  return (RACE_COMPOUNDS as readonly string[]).includes(raw ?? "")
    ? (raw as TyreCompound)
    : fallback;
}

export function neutralisationParam(params: URLSearchParams): Neutralisation | null {
  const raw = params.get("neut");
  return raw === "SC" || raw === "VSC" ? raw : null;
}

/** Integer param clamped to [min, max], or the fallback when missing. */
export function clampedParam(
  params: URLSearchParams,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = intParam(params, key) ?? fallback;
  return Math.min(Math.max(value, min), max);
}

/** Car param that must belong to the session, else the fallback. */
export function carParam(params: URLSearchParams, key: string, cars: number[], fallback: number) {
  const value = intParam(params, key);
  return value !== null && cars.includes(value) ? value : fallback;
}

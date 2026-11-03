import type { Schema } from "@stintline/api-types";

import { compoundInfo, RACE_COMPOUNDS } from "@/lib/compounds";

export type RaceCompound = (typeof RACE_COMPOUNDS)[number];

export interface PlanStop {
  lap: number;
  compound: RaceCompound;
}

/** A tyre strategy: the starting set, then each stop's in-lap and the set fitted. */
export interface Plan {
  start: RaceCompound;
  stops: PlanStop[];
}

export interface PlanStint {
  compound: RaceCompound;
  from: number;
  to: number;
}

/** Fewest laps between two stops the simulator accepts (`WhatIfConfig.min_stint_laps`). */
export const MIN_STINT_LAPS = 3;
/** Most stops the simulator accepts (`MAX_STOPS` in the API). */
export const MAX_STOPS = 5;

function asRaceCompound(value: string | null | undefined): RaceCompound | null {
  const key = compoundInfo(value).key;
  return (RACE_COMPOUNDS as readonly string[]).includes(key) ? (key as RaceCompound) : null;
}

/** The strategy a car actually ran, read from the replay data (new set after the in-lap). */
export function realPlan(car: Schema<"ReplayCar">): Plan | null {
  const start = asRaceCompound(car.compounds[0]);
  if (!start) return null;
  const stops: PlanStop[] = [];
  for (const lap of car.pit_in_laps) {
    const compound = asRaceCompound(car.compounds[lap]);
    if (compound) stops.push({ lap, compound });
  }
  return { start, stops };
}

/** Stints of a plan over a race of `totalLaps` laps. */
export function planStints(plan: Plan, totalLaps: number): PlanStint[] {
  const out: PlanStint[] = [];
  let from = 1;
  let compound = plan.start;
  for (const stop of plan.stops) {
    out.push({ compound, from, to: stop.lap });
    from = stop.lap + 1;
    compound = stop.compound;
  }
  out.push({ compound, from, to: totalLaps });
  return out;
}

/** `M-31H-46S`: short, readable and shareable in the address. */
export function encodePlan(plan: Plan): string {
  return [
    compoundInfo(plan.start).letter,
    ...plan.stops.map((s) => `${String(s.lap)}${compoundInfo(s.compound).letter}`),
  ].join("-");
}

const BY_LETTER = new Map(RACE_COMPOUNDS.map((c) => [compoundInfo(c).letter, c]));

export function decodePlan(raw: string | null): Plan | null {
  if (!raw) return null;
  const [first, ...rest] = raw.split("-");
  const start = BY_LETTER.get(first ?? "");
  if (!start) return null;
  const stops: PlanStop[] = [];
  for (const part of rest) {
    const match = /^(\d{1,3})([A-Z])$/.exec(part);
    const compound = match ? BY_LETTER.get(match[2] ?? "") : undefined;
    if (!match || !compound) return null;
    stops.push({ lap: Number(match[1]), compound });
  }
  return { start, stops };
}

/** Insert a stop in the middle of the longest stint, on the hardest-wearing choice. */
export function addStop(plan: Plan, totalLaps: number, compound: RaceCompound): Plan {
  const longest = planStints(plan, totalLaps).reduce((a, b) =>
    b.to - b.from > a.to - a.from ? b : a,
  );
  const lap = Math.round((longest.from + longest.to) / 2);
  const stops = [...plan.stops, { lap, compound }].sort((a, b) => a.lap - b.lap);
  return { ...plan, stops };
}

/** Problems the form can show before asking the server (the server checks again). */
export function planProblem(plan: Plan, totalLaps: number): "order" | "short" | null {
  const laps = plan.stops.map((s) => s.lap);
  if (laps.some((lap, i) => i > 0 && lap <= (laps[i - 1] ?? 0))) return "order";
  const stints = planStints(plan, totalLaps);
  if (stints.some((s) => s.to - s.from + 1 < MIN_STINT_LAPS)) return "short";
  return null;
}

export function samePlan(a: Plan, b: Plan): boolean {
  return encodePlan(a) === encodePlan(b);
}

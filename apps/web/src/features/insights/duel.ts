import { teamColour } from "@/lib/teams";

/** Grey that marks the second driver of a duel when both share a team colour. */
export const SECOND_DRIVER = "var(--color-muted)";

/**
 * Colours of the two sides of a duel. Teammates share the team colour, so the second
 * driver is drawn in grey; names always sit next to the marks.
 */
export function duelColours(
  a: string | null | undefined,
  b: string | null | undefined,
): [string, string] {
  const first = teamColour(a);
  const second = teamColour(b);
  return [first, first === second ? SECOND_DRIVER : second];
}

/** Share of A in a two-way tally, 0.5 when nothing was decided. */
export function share([a, b]: readonly number[]): number {
  const total = (a ?? 0) + (b ?? 0);
  return total === 0 ? 0.5 : (a ?? 0) / total;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] ?? null)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Centred rolling median of a lap series (null laps stay null), for pace evolution. */
export function rollingMedian(values: readonly (number | null)[], window = 5): (number | null)[] {
  const half = Math.floor(window / 2);
  return values.map((value, i) => {
    if (value === null) return null;
    const around = values
      .slice(Math.max(0, i - half), i + half + 1)
      .filter((v): v is number => v !== null);
    return median(around);
  });
}

/** Value below which `q` of the values fall (linear interpolation), `null` when empty. */
export function quantile(values: readonly number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const position = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const low = Math.floor(position);
  const high = Math.ceil(position);
  const a = sorted[low] ?? 0;
  const b = sorted[high] ?? a;
  return a + (b - a) * (position - low);
}

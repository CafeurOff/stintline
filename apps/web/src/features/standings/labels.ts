/**
 * Label positions near the wanted ones but at least `gap` apart: labels are pushed down
 * in order, then the whole stack is shifted back up if it overflowed.
 */
export function spreadLabels(wanted: readonly (number | null)[], gap: number): (number | null)[] {
  const order = wanted
    .map((value, index) => ({ value, index }))
    .filter((d): d is { value: number; index: number } => d.value !== null)
    .sort((a, b) => a.value - b.value);
  const out: (number | null)[] = wanted.map(() => null);
  let previous = Number.NEGATIVE_INFINITY;
  for (const { value, index } of order) {
    const placed = Math.max(value, previous + gap);
    out[index] = placed;
    previous = placed;
  }
  return out;
}

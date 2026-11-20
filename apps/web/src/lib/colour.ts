/**
 * Text in a context colour (team, circuit) that stays readable in both themes: the colour
 * mixed towards the ink, so a yellow or a dark navy still reads on the ground.
 */
export function readable(colour: string, pct = 70): string {
  return `color-mix(in oklab, ${colour} ${String(pct)}%, var(--color-ink))`;
}

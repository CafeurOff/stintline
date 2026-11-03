const FALLBACK_TEAM_COLOUR = "#8a8984";
const HEX = /^#?([0-9a-f]{6})$/i;

/** Team colour from the API (`F47600`) as a CSS hex colour, with a neutral fallback. */
export function teamColour(raw: string | null | undefined): string {
  const match = HEX.exec(raw ?? "");
  const hex = match?.[1];
  return hex ? `#${hex.toLowerCase()}` : FALLBACK_TEAM_COLOUR;
}

/** Dark or light ink, whichever reads better on the given hex background. */
export function inkOn(colour: string): string {
  const match = HEX.exec(colour);
  const hex = match?.[1];
  if (!hex) return "#ffffff";
  const value = Number.parseInt(hex, 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return luminance > 0.36 ? "#1c1b19" : "#ffffff";
}

/**
 * A surface tinted with the team colour (`pct` % of it over the panel), readable with the
 * normal ink in both themes. Solid colour mixing, not a gradient.
 */
export function teamTint(raw: string | null | undefined, pct = 18): string {
  return `color-mix(in oklab, ${teamColour(raw)} ${String(pct)}%, var(--color-panel))`;
}

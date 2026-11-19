/**
 * Accent colour of a circuit for the glass skin: each Grand Prix gets its own glow, always the
 * same for a circuit. Saturated hues that read on black and on white (as a glow, never text).
 */
const ACCENTS = [
  "#1ed760", // green
  "#2f6bff", // blue
  "#ff6a1a", // orange
  "#e10613", // red
  "#9b5cff", // violet
  "#00b8e6", // cyan
  "#ffc400", // yellow
  "#ff3d8b", // pink
] as const;

export function circuitAccent(ref: string): string {
  let hash = 0;
  for (const char of ref) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ACCENTS[hash % ACCENTS.length] ?? ACCENTS[0];
}

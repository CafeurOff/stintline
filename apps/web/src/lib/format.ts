const EM_DASH = "—";
const MINUS = "−";

/** Lap time as `m:ss.sss` (`1:20.642`). Null or non-finite values render as an em dash. */
export function formatLapTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return EM_DASH;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  const secs = rest.toFixed(3).padStart(6, "0");
  return minutes > 0 ? `${minutes}:${secs}` : rest.toFixed(3);
}

/** Duration in seconds with a unit (`21.3 s`). */
export function formatSeconds(seconds: number | null | undefined, digits = 1): string {
  if (seconds == null || !Number.isFinite(seconds)) return EM_DASH;
  return `${seconds.toFixed(digits)} s`;
}

/** Signed delta with a true minus sign (`+0.12 s`, `−1.30 s`). */
export function formatDelta(seconds: number, digits = 2): string {
  const rounded = Number(seconds.toFixed(digits));
  const sign = rounded > 0 ? "+" : rounded < 0 ? MINUS : "±";
  return `${sign}${Math.abs(rounded).toFixed(digits)} s`;
}

/** Probability as a percentage, clamped at the extremes (`<1%`, `>99%`). */
export function formatProbability(p: number): string {
  if (p < 0.01) return "<1%";
  if (p > 0.99) return ">99%";
  return `${Math.round(p * 100)}%`;
}

/** Ratio as a whole percentage (`49%`). */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Track position (`P4`). */
export function formatPosition(position: number | null | undefined): string {
  return position == null ? EM_DASH : `P${position}`;
}

/** Calendar date in UTC (`3 Aug 2025`). Race dates are dates, not instants. */
export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}

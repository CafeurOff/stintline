import type { Schema } from "@stintline/api-types";

/** The circuit drawn from its reference lap, decorative (the name is written next to it). */
export function CircuitOutline({
  track,
  className = "",
}: {
  track: Schema<"Track">;
  className?: string;
}) {
  const path = `M${track.points.map(([x, y]) => `${String(x)} ${String(y)}`).join(" L")} Z`;
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${String(track.width)} ${String(track.height)}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={path}
        fill="none"
        stroke="var(--color-track-edge)"
        strokeWidth={34}
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={10}
        strokeLinejoin="round"
      />
    </svg>
  );
}

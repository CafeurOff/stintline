import { useId } from "react";

/** Racing lines across the card, in a 100 × 100 box stretched to the card. */
const LINES = [
  "M -10 92 C 30 88, 55 60, 110 18",
  "M -10 100 C 35 94, 62 70, 110 34",
  "M 20 110 C 48 86, 70 64, 110 52",
] as const;

/**
 * Light trails, like a long exposure of cars at night, sweeping across a card in the context
 * colour: a soft blurred band and a sharp core for each line. Decorative.
 */
export function Trails({ colour, className = "" }: { colour: string; className?: string }) {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 size-full ${className}`}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={colour} stopOpacity="0" />
          <stop offset="0.55" stopColor={colour} stopOpacity="1" />
          <stop offset="1" stopColor={colour} stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-b`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <g style={{ opacity: "var(--trail-strength)" }}>
        {LINES.map((d, i) => (
          <g key={d} opacity={1 - i * 0.28}>
            <path
              d={d}
              fill="none"
              stroke={`url(#${id}-g)`}
              strokeWidth="5"
              vectorEffect="non-scaling-stroke"
              filter={`url(#${id}-b)`}
              opacity="0.45"
            />
            <path
              d={d}
              fill="none"
              stroke={`url(#${id}-g)`}
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </g>
    </svg>
  );
}

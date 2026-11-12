import { useId } from "react";

import { useElementWidth } from "@/lib/useElementWidth";

export interface StripDot {
  key: string;
  value: number;
  label: string;
}

/**
 * Gaps as dots on one line centred on zero (left: the first driver was faster). Each dot
 * keeps its round in a tooltip; the median is a tick.
 */
export function GapStrip({
  label,
  dots,
  colours,
  ends,
  median,
  format,
  limit,
}: {
  label: string;
  dots: readonly StripDot[];
  colours: readonly [string, string];
  /** Labels under the left and right ends (who is faster on that side). */
  ends: readonly [string, string];
  median: number | null;
  format: (value: number) => string;
  /** Half-width of the axis in seconds; larger gaps sit at the edge. */
  limit: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>(320);
  const titleId = useId();
  const height = 34;
  const pad = 8;
  const x = (v: number) =>
    pad + ((Math.max(-limit, Math.min(limit, v)) + limit) / (2 * limit)) * (width - 2 * pad);
  return (
    <div ref={ref} className="flex flex-col gap-1">
      <svg width={width} height={height} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>{label}</title>
        <line
          x1={pad}
          x2={width - pad}
          y1={height / 2}
          y2={height / 2}
          stroke="var(--color-line-strong)"
        />
        <line
          x1={x(0)}
          x2={x(0)}
          y1={4}
          y2={height - 4}
          stroke="var(--color-muted)"
          strokeDasharray="2 3"
        />
        {dots.map((dot, i) => (
          <circle
            key={dot.key}
            cx={x(dot.value)}
            cy={height / 2 + ((i % 3) - 1) * 6}
            r={4.5}
            fill={dot.value <= 0 ? colours[0] : colours[1]}
            stroke="var(--color-panel)"
            strokeWidth={1.5}
          >
            <title>{`${dot.label}: ${format(dot.value)}`}</title>
          </circle>
        ))}
        {median !== null && (
          <line
            x1={x(median)}
            x2={x(median)}
            y1={2}
            y2={height - 2}
            stroke="var(--color-ink)"
            strokeWidth={2}
          >
            <title>{format(median)}</title>
          </line>
        )}
      </svg>
      <div className="flex justify-between text-[0.7rem] text-muted">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
    </div>
  );
}

import { AxisBottom } from "@visx/axis";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { useId } from "react";

import { formatProbability } from "@/lib/format";
import { useElementWidth } from "@/lib/useElementWidth";

const HEIGHT = 200;
const MARGIN = { top: 20, right: 8, bottom: 32, left: 8 };
/** Positions below this probability are left out of the spoken summary. */
const SUMMARY_THRESHOLD = 0.01;

interface PositionChartProps {
  distribution: readonly number[];
  interval: readonly number[];
  mostLikely: number;
}

/** Probability of each rejoin position, the reported interval highlighted. */
export function PositionChart({ distribution, interval, mostLikely }: PositionChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const positions = distribution.map((_, i) => i + 1);
  const [low = mostLikely, high = mostLikely] = interval;
  const x = scaleBand({ domain: positions, range: [0, innerWidth], padding: 0.2 });
  const y = scaleLinear({ domain: [0, Math.max(...distribution, 0.05)], range: [innerHeight, 0] });
  const summary = distribution
    .map((p, i) => [i + 1, p] as const)
    .filter(([, p]) => p >= SUMMARY_THRESHOLD)
    .map(([pos, p]) => `P${pos} ${formatProbability(p)}`)
    .join(", ");

  return (
    <div ref={ref} className="w-full min-w-0 overflow-hidden">
      <svg width={width} height={HEIGHT} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>Rejoin position probabilities: {summary}.</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          {distribution.map((p, i) => {
            const position = i + 1;
            const inInterval = position >= low && position <= high;
            const barX = x(position) ?? 0;
            const barY = y(p);
            return (
              <g key={position}>
                <rect
                  x={barX}
                  y={barY}
                  width={x.bandwidth()}
                  height={innerHeight - barY}
                  rx={2}
                  fill={inInterval ? "var(--color-accent)" : "var(--color-border-strong)"}
                />
                {p >= 0.05 && (
                  <text
                    x={barX + x.bandwidth() / 2}
                    y={barY - 4}
                    textAnchor="middle"
                    className="tabular fill-text text-[10px] font-semibold"
                  >
                    {formatProbability(p)}
                  </text>
                )}
              </g>
            );
          })}
          <AxisBottom
            top={innerHeight}
            scale={x}
            tickFormat={(v) => `P${v}`}
            stroke="var(--color-border-strong)"
            tickStroke="var(--color-border-strong)"
            tickLabelProps={{ fill: "var(--color-text-muted)", fontSize: 10, textAnchor: "middle" }}
          />
        </Group>
      </svg>
    </div>
  );
}

import { AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { useId } from "react";

import { useElementWidth } from "@/lib/useElementWidth";

export interface RoundGap {
  key: string;
  short: string;
  label: string;
  /** A minus B; negative means A was faster. Null rounds leave a gap in the row. */
  value: number | null;
}

const MARGIN = { top: 22, right: 8, bottom: 26, left: 52 };

/**
 * One bar per round: up when the first driver was faster, down when the second was.
 * Bars carry the round and the gap as a tooltip; the table below the chart has the figures.
 */
export function RoundGapBars({
  label,
  rounds,
  colours,
  names,
  format,
  height = 220,
}: {
  label: string;
  rounds: readonly RoundGap[];
  colours: readonly [string, string];
  names: readonly [string, string];
  format: (value: number) => string;
  height?: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const values = rounds.map((r) => r.value).filter((v): v is number => v !== null);
  const reach = Math.max(0.1, ...values.map((v) => Math.abs(v)));
  const y = scaleLinear({ domain: [-reach, reach], range: [innerHeight, 0], nice: true });
  const x = scaleBand({ domain: rounds.map((r) => r.key), range: [0, innerWidth], padding: 0.25 });
  return (
    <div ref={ref} className="w-full min-w-0">
      <svg width={width} height={height} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>{label}</title>
        <text x={MARGIN.left} y={12} fontSize={11} fontWeight={700} fill="var(--color-ink)">
          ▲ {names[0]}
        </text>
        <text x={MARGIN.left} y={height - 4} fontSize={11} fontWeight={700} fill="var(--color-ink)">
          ▼ {names[1]}
        </text>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={y} width={innerWidth} numTicks={4} stroke="var(--color-line)" />
          {rounds.map((round) => {
            if (round.value === null) return null;
            // Up = first driver faster: the bar runs from zero towards −gap.
            const lifted = -round.value;
            const top = y(Math.max(0, lifted));
            const bottom = y(Math.min(0, lifted));
            return (
              <rect
                key={round.key}
                x={x(round.key) ?? 0}
                width={x.bandwidth()}
                y={top}
                height={Math.max(1, bottom - top)}
                rx={2}
                fill={lifted >= 0 ? colours[0] : colours[1]}
              >
                <title>{`${round.label}: ${format(round.value)}`}</title>
              </rect>
            );
          })}
          <line x1={0} x2={innerWidth} y1={y(0)} y2={y(0)} stroke="var(--color-line-strong)" />
          <AxisLeft
            scale={y}
            numTicks={4}
            tickFormat={(v) => format(Math.abs(Number(v)))}
            stroke="var(--color-line-strong)"
            tickStroke="var(--color-line-strong)"
            tickLabelProps={{ fill: "var(--color-muted)", fontSize: 10 }}
          />
        </Group>
      </svg>
    </div>
  );
}

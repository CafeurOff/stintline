import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { useId } from "react";

import { spreadLabels } from "@/features/standings/labels";
import { teamColour } from "@/lib/teams";
import { useElementWidth } from "@/lib/useElementWidth";

import type { PerLap } from "../laps";

export interface LapSeries {
  key: number;
  label: string;
  colour: string | null | undefined;
  dashed: boolean;
  values: PerLap;
}

interface LapChartProps {
  label: string;
  series: readonly LapSeries[];
  /** Highlighted series are drawn thick and labelled; the others stay faint. */
  highlighted: ReadonlySet<number>;
  totalLaps: number;
  /** Positions: 1 at the top. */
  invert?: boolean;
  yDomain?: [number, number];
  yFormat?: (value: number) => string;
  xLabel: string;
  height?: number;
}

const MARGIN = { top: 12, right: 48, bottom: 40, left: 52 };
const LABEL_GAP = 12;
const FAINT = 0.18;

/** Lap-by-lap lines (positions, gaps or lap times), one per car, team colours. */
export function LapChart({
  label,
  series,
  highlighted,
  totalLaps,
  invert = false,
  yDomain,
  yFormat = String,
  xLabel,
  height = 420,
}: LapChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const [low, high] = yDomain ?? [Math.min(0, ...all), Math.max(1, ...all)];
  const x = scaleLinear({ domain: [1, Math.max(totalLaps, 2)], range: [0, innerWidth] });
  const y = scaleLinear({
    domain: [low, high],
    range: invert ? [0, innerHeight] : [innerHeight, 0],
  });

  const ends = series.map((s) => {
    if (!highlighted.has(s.key)) return null;
    for (let i = s.values.length - 1; i >= 0; i -= 1) {
      const value = s.values[i];
      if (value != null) return { lap: i + 1, y: y(value) };
    }
    return null;
  });
  const labelY = spreadLabels(
    ends.map((e) => e?.y ?? null),
    LABEL_GAP,
  );
  // Faint lines first so highlighted ones are drawn on top.
  const order = series
    .map((s, index) => ({ s, index }))
    .sort((a, b) => Number(highlighted.has(a.s.key)) - Number(highlighted.has(b.s.key)));

  return (
    <div ref={ref} className="w-full min-w-0 overflow-hidden">
      <svg width={width} height={height} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>{label}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={y} width={innerWidth} numTicks={6} stroke="var(--color-line)" />
          {order.map(({ s, index }) => {
            const on = highlighted.has(s.key);
            const data = s.values
              .map((value, lap) => ({ lap: lap + 1, value }))
              .filter((d): d is { lap: number; value: number } => d.value !== null);
            const end = ends[index];
            const placed = labelY[index];
            return (
              <g key={s.key} opacity={on || highlighted.size === 0 ? 1 : FAINT}>
                <LinePath
                  data={data}
                  x={(d) => x(d.lap)}
                  y={(d) => y(d.value)}
                  stroke={teamColour(s.colour)}
                  strokeWidth={on ? 2.5 : 1.25}
                  strokeDasharray={s.dashed ? "5 4" : undefined}
                />
                {end && placed != null && (
                  <text
                    x={x(end.lap) + 6}
                    y={placed}
                    dy="0.33em"
                    fontSize={11}
                    fontWeight={700}
                    fill="var(--color-ink)"
                  >
                    {s.label}
                  </text>
                )}
              </g>
            );
          })}
          <AxisLeft
            scale={y}
            numTicks={6}
            tickFormat={(value) => yFormat(Number(value))}
            stroke="var(--color-line-strong)"
            tickStroke="var(--color-line-strong)"
            tickLabelProps={{ fill: "var(--color-muted)", fontSize: 11 }}
          />
          <AxisBottom
            top={innerHeight}
            scale={x}
            numTicks={Math.min(totalLaps, 12)}
            stroke="var(--color-line-strong)"
            tickStroke="var(--color-line-strong)"
            tickLabelProps={{ fill: "var(--color-muted)", fontSize: 11 }}
            label={xLabel}
            labelProps={{ fill: "var(--color-muted)", fontSize: 12, textAnchor: "middle" }}
          />
        </Group>
      </svg>
    </div>
  );
}

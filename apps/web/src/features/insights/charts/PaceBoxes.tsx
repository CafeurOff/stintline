import { AxisBottom } from "@visx/axis";
import { GridColumns } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { useId } from "react";

import { teamColour, teamTint } from "@/lib/teams";
import { useElementWidth } from "@/lib/useElementWidth";

export interface PaceBox {
  key: number;
  label: string;
  colour: string | null | undefined;
  median: number;
  q1: number;
  q3: number;
  low: number;
  high: number;
  outliers: readonly number[];
}

const ROW = 44;
const MARGIN = { top: 4, right: 16, bottom: 36, left: 52 };

/**
 * Lap-time distribution of every driver as horizontal box plots (median, quartiles,
 * whiskers at 1.5 IQR, outliers as dots), fastest median on top, team colours.
 */
export function PaceBoxes({
  label,
  boxes,
  format,
  axisLabel,
}: {
  label: string;
  boxes: readonly PaceBox[];
  format: (value: number) => string;
  axisLabel: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const height = MARGIN.top + MARGIN.bottom + boxes.length * ROW;
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const lows = boxes.map((b) => b.low);
  const highs = boxes.map((b) => b.high);
  const x = scaleLinear({
    domain: [Math.min(...lows), Math.max(...highs)],
    range: [0, innerWidth],
    nice: true,
  });
  const [lo, hi] = x.domain() as [number, number];
  const clamp = (v: number) => x(Math.max(lo, Math.min(hi, v)));
  return (
    <div ref={ref} className="w-full min-w-0">
      <svg width={width} height={height} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>{label}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridColumns
            scale={x}
            height={boxes.length * ROW}
            numTicks={6}
            stroke="var(--color-line)"
          />
          {boxes.map((box, i) => {
            const cy = i * ROW + ROW / 2;
            const fill = teamColour(box.colour);
            return (
              <g key={box.key}>
                <title>{`${box.label}: ${format(box.median)} (${format(box.q1)} – ${format(box.q3)})`}</title>
                <text
                  x={-8}
                  y={cy}
                  dy="0.33em"
                  textAnchor="end"
                  fontSize={11}
                  fontWeight={700}
                  fill="var(--color-ink)"
                >
                  {box.label}
                </text>
                <line
                  x1={clamp(box.low)}
                  x2={clamp(box.high)}
                  y1={cy}
                  y2={cy}
                  stroke={fill}
                  strokeWidth={1.5}
                />
                <rect
                  x={clamp(box.q1)}
                  width={Math.max(2, clamp(box.q3) - clamp(box.q1))}
                  y={cy - 8}
                  height={16}
                  rx={3}
                  fill={teamTint(box.colour, 45)}
                  stroke={fill}
                  strokeWidth={1.5}
                />
                <line
                  x1={clamp(box.median)}
                  x2={clamp(box.median)}
                  y1={cy - 8}
                  y2={cy + 8}
                  stroke="var(--color-ink)"
                  strokeWidth={2.5}
                />
                {box.outliers
                  .filter((v) => v >= lo && v <= hi)
                  .map((v, j) => (
                    <circle key={j} cx={x(v)} cy={cy} r={2.5} fill="none" stroke={fill} />
                  ))}
              </g>
            );
          })}
          <AxisBottom
            top={boxes.length * ROW}
            scale={x}
            numTicks={6}
            tickFormat={(v) => format(Number(v))}
            stroke="var(--color-line-strong)"
            tickStroke="var(--color-line-strong)"
            tickLabelProps={{ fill: "var(--color-muted)", fontSize: 11 }}
            label={axisLabel}
            labelProps={{ fill: "var(--color-muted)", fontSize: 12, textAnchor: "middle" }}
          />
        </Group>
      </svg>
    </div>
  );
}

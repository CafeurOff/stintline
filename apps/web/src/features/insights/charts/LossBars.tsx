import { AxisBottom } from "@visx/axis";
import { GridColumns } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { useId } from "react";

import { useElementWidth } from "@/lib/useElementWidth";

export interface LossRow {
  key: string;
  label: string;
  value: number;
  sigma: number | null;
}

const ROW = 22;
const MARGIN = { top: 4, right: 20, bottom: 36, left: 150 };

/** Horizontal bars with a ±σ whisker: pit loss per race as our engine measured it. */
export function LossBars({
  label,
  rows,
  format,
  axisLabel,
}: {
  label: string;
  rows: readonly LossRow[];
  format: (value: number) => string;
  axisLabel: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const height = MARGIN.top + MARGIN.bottom + rows.length * ROW;
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 100);
  const top = Math.max(...rows.map((r) => r.value + (r.sigma ?? 0)), 1);
  const x = scaleLinear({ domain: [0, top], range: [0, innerWidth], nice: true });
  return (
    <div ref={ref} className="w-full min-w-0">
      <svg width={width} height={height} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>{label}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridColumns
            scale={x}
            height={rows.length * ROW}
            numTicks={5}
            stroke="var(--color-line)"
          />
          {rows.map((row, i) => {
            const cy = i * ROW + ROW / 2;
            const lo = x(Math.max(0, row.value - (row.sigma ?? 0)));
            const hi = x(row.value + (row.sigma ?? 0));
            return (
              <g key={row.key}>
                <title>{`${row.label}: ${format(row.value)}${row.sigma ? ` ± ${format(row.sigma)}` : ""}`}</title>
                <text
                  x={-8}
                  y={cy}
                  dy="0.33em"
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--color-ink)"
                >
                  {row.label.length > 22 ? `${row.label.slice(0, 21)}…` : row.label}
                </text>
                <rect
                  x={0}
                  y={cy - 6}
                  width={Math.max(1, x(row.value))}
                  height={12}
                  rx={2}
                  fill="var(--color-t-blue)"
                />
                {row.sigma ? (
                  <g stroke="var(--color-ink)" strokeWidth={1.5}>
                    <line x1={lo} x2={hi} y1={cy} y2={cy} />
                    <line x1={lo} x2={lo} y1={cy - 4} y2={cy + 4} />
                    <line x1={hi} x2={hi} y1={cy - 4} y2={cy + 4} />
                  </g>
                ) : null}
              </g>
            );
          })}
          <AxisBottom
            top={rows.length * ROW}
            scale={x}
            numTicks={5}
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

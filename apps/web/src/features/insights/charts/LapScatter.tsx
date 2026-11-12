import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { useId } from "react";

import { compoundInfo } from "@/lib/compounds";
import { useElementWidth } from "@/lib/useElementWidth";

export interface ScatterSeries {
  key: number;
  label: string;
  points: readonly { lap: number; value: number; compound: string; tip: string }[];
}

const MARGIN = { top: 12, right: 16, bottom: 40, left: 60 };
const SHAPES = ["circle", "square", "diamond"] as const;

/**
 * Every kept lap of the chosen drivers: lap on x, time on y, the compound as the fill and
 * one marker shape per driver (so drivers and compounds both read without colour alone).
 */
export function LapScatter({
  label,
  series,
  totalLaps,
  format,
  xLabel,
  height = 360,
}: {
  label: string;
  series: readonly ScatterSeries[];
  totalLaps: number;
  format: (value: number) => string;
  xLabel: string;
  height?: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const values = series.flatMap((s) => s.points.map((p) => p.value));
  const x = scaleLinear({ domain: [1, Math.max(totalLaps, 2)], range: [0, innerWidth] });
  const y = scaleLinear({
    domain: [Math.min(...values), Math.max(...values)],
    range: [innerHeight, 0],
    nice: true,
  });
  return (
    <div ref={ref} className="w-full min-w-0">
      <svg width={width} height={height} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>{label}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={y} width={innerWidth} numTicks={6} stroke="var(--color-line)" />
          {series.map((s, index) =>
            s.points.map((p) => {
              const fill = compoundInfo(p.compound).fill;
              const cx = x(p.lap);
              const cy = y(p.value);
              const shape = SHAPES[index % SHAPES.length];
              const common = { fill, stroke: "var(--color-panel)", strokeWidth: 1 };
              return (
                <g key={`${String(s.key)}-${String(p.lap)}`}>
                  <title>{p.tip}</title>
                  {shape === "circle" ? (
                    <circle cx={cx} cy={cy} r={4} {...common} />
                  ) : shape === "square" ? (
                    <rect x={cx - 3.5} y={cy - 3.5} width={7} height={7} {...common} />
                  ) : (
                    <path d={`M${String(cx)} ${String(cy - 5)}l5 5l-5 5l-5-5z`} {...common} />
                  )}
                </g>
              );
            }),
          )}
          <AxisLeft
            scale={y}
            numTicks={6}
            tickFormat={(v) => format(Number(v))}
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
      <ul className="flex flex-wrap gap-4 px-1 text-xs text-muted">
        {series.map((s, index) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <svg width={12} height={12} aria-hidden="true">
              {SHAPES[index % SHAPES.length] === "circle" ? (
                <circle cx={6} cy={6} r={4.5} fill="var(--color-ink)" />
              ) : SHAPES[index % SHAPES.length] === "square" ? (
                <rect x={2} y={2} width={8} height={8} fill="var(--color-ink)" />
              ) : (
                <path d="M6 0.5l5.5 5.5l-5.5 5.5l-5.5-5.5z" fill="var(--color-ink)" />
              )}
            </svg>
            <span className="font-semibold text-ink">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

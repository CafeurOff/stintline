import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar } from "@visx/shape";
import { useId } from "react";

import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";
import { useElementWidth } from "@/lib/useElementWidth";

export interface SeasonBar {
  year: number;
  points: number;
  position: number | null;
}

const HEIGHT = 240;
const MARGIN = { top: 22, right: 8, bottom: 28, left: 40 };
/** Champion seasons are drawn in full colour; the others are lighter. */
const OTHER_OPACITY = 0.55;

/**
 * Points scored each season, one bar per season, the championship place written on top.
 * The seasons table below the chart carries the same numbers for screen readers.
 */
export function SeasonBars({
  seasons,
  colour,
  label,
}: {
  seasons: readonly SeasonBar[];
  colour: string | null | undefined;
  label: string;
}) {
  const { f } = useI18n();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const ordered = [...seasons].sort((a, b) => a.year - b.year);
  const x = scaleBand({
    domain: ordered.map((s) => s.year),
    range: [0, innerWidth],
    padding: 0.2,
  });
  const y = scaleLinear({
    domain: [0, Math.max(10, ...ordered.map((s) => s.points))],
    range: [innerHeight, 0],
    nice: true,
  });
  const fill = colour ? teamColour(colour) : "var(--color-mark)";
  const tickEvery = Math.max(1, Math.ceil(ordered.length / Math.max(innerWidth / 48, 1)));
  const showPlaces = x.bandwidth() >= 18;

  return (
    <div ref={ref} className="w-full min-w-0 overflow-hidden">
      <svg width={width} height={HEIGHT} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>{label}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={y} width={innerWidth} numTicks={4} stroke="var(--color-line)" />
          {ordered.map((season) => {
            const barX = x(season.year) ?? 0;
            const barY = y(season.points);
            return (
              <g key={season.year}>
                <Bar
                  x={barX}
                  y={barY}
                  width={x.bandwidth()}
                  height={innerHeight - barY}
                  fill={fill}
                  opacity={season.position === 1 ? 1 : OTHER_OPACITY}
                  rx={2}
                />
                {showPlaces && season.position !== null && (
                  <text
                    x={barX + x.bandwidth() / 2}
                    y={barY - 5}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={700}
                    fill="var(--color-ink)"
                  >
                    {f.ordinal(season.position)}
                  </text>
                )}
              </g>
            );
          })}
          <AxisLeft
            scale={y}
            numTicks={4}
            stroke="var(--color-line-strong)"
            tickStroke="var(--color-line-strong)"
            tickLabelProps={{ fill: "var(--color-muted)", fontSize: 11 }}
          />
          <AxisBottom
            top={innerHeight}
            scale={x}
            tickValues={ordered.map((s) => s.year).filter((_, i) => i % tickEvery === 0)}
            stroke="var(--color-line-strong)"
            tickStroke="var(--color-line-strong)"
            tickLabelProps={{ fill: "var(--color-muted)", fontSize: 11 }}
          />
        </Group>
      </svg>
    </div>
  );
}

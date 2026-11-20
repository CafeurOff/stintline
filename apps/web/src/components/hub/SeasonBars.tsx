import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar } from "@visx/shape";
import { useId, useState } from "react";

import { ChartTools } from "@/components/charts/ChartTools";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { type Range, useZoom } from "@/components/charts/zoom";
import { ZoomLayer } from "@/components/charts/ZoomLayer";

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
  const { t, f } = useI18n();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const all = [...seasons].sort((a, b) => a.year - b.year);
  const full = { x: [0, all.length] as Range, y: [0, 1] as Range };
  const zoom = useZoom(full, all.map((s) => s.year).join(","));
  const [hover, setHover] = useState<number | null>(null);
  const from = Math.max(0, Math.floor(zoom.view.x[0]));
  const to = Math.min(all.length, Math.ceil(zoom.view.x[1]));
  const ordered = all.slice(from, to);
  const index = scaleLinear({ domain: [from, to], range: [0, innerWidth] });
  const hovered = hover === null ? undefined : all[hover];
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
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden">
      {all.length > 6 && (
        <ChartTools
          zoom={zoom}
          csv={() => [
            [t("col.season"), t("chart.points"), t("chart.place")],
            ...all.map((s) => [s.year, s.points, s.position]),
          ]}
        />
      )}
      {hovered && (
        <ChartTooltip
          left={MARGIN.left + (x(hovered.year) ?? 0) + x.bandwidth() / 2}
          top={MARGIN.top + 44}
          width={width}
          title={String(hovered.year)}
          rows={[
            {
              key: "pts",
              colour: fill,
              label: t("chart.points"),
              value: f.number(hovered.points, hovered.points % 1 ? 1 : 0),
              strong: true,
            },
            ...(hovered.position !== null
              ? [
                  {
                    key: "pos",
                    colour: fill,
                    label: t("chart.place"),
                    value: f.ordinal(hovered.position),
                  },
                ]
              : []),
          ]}
        />
      )}
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
                  opacity={
                    hovered && hovered.year !== season.year
                      ? 0.3
                      : season.position === 1
                        ? 1
                        : OTHER_OPACITY
                  }
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
          <ZoomLayer
            width={innerWidth}
            height={innerHeight}
            x={index}
            y={y}
            onZoom={(next) => {
              if (next.x)
                zoom.zoomTo({ x: [Math.floor(next.x[0]), Math.ceil(next.x[1])], y: full.y });
            }}
            onReset={zoom.reset}
            onHover={(p) => {
              setHover(Math.min(Math.floor(index.invert(p.x)), to - 1));
            }}
            onLeave={() => {
              setHover(null);
            }}
          />
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

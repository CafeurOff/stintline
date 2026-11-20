import { AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { useId, useState } from "react";

import { ChartTools } from "@/components/charts/ChartTools";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { type Range, useZoom } from "@/components/charts/zoom";
import { ZoomLayer } from "@/components/charts/ZoomLayer";
import { useI18n } from "@/lib/i18n/context";
import { useElementWidth } from "@/lib/useElementWidth";

interface RoundGap {
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
  const { t } = useI18n();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const values = rounds.map((r) => r.value).filter((v): v is number => v !== null);
  const reach = Math.max(0.1, ...values.map((v) => Math.abs(v)));
  const y = scaleLinear({ domain: [-reach, reach], range: [innerHeight, 0], nice: true });
  const full = { x: [0, rounds.length] as Range, y: [-reach, reach] as Range };
  const zoom = useZoom(full, rounds.map((r) => r.key).join(","));
  const [hover, setHover] = useState<number | null>(null);
  const from = Math.max(0, Math.floor(zoom.view.x[0]));
  const to = Math.min(rounds.length, Math.ceil(zoom.view.x[1]));
  const shown = rounds.slice(from, to);
  const x = scaleBand({ domain: shown.map((r) => r.key), range: [0, innerWidth], padding: 0.25 });
  const index = scaleLinear({ domain: [from, to], range: [0, innerWidth] });
  const hovered = hover === null ? undefined : rounds[hover];
  return (
    <div ref={ref} className="relative w-full min-w-0">
      <ChartTools
        zoom={zoom}
        csv={() => [
          [t("col.round"), t("col.grandPrix"), label],
          ...rounds.map((r) => [r.short, r.label, r.value]),
        ]}
      />
      {hovered?.value != null && (
        <ChartTooltip
          left={MARGIN.left + (x(hovered.key) ?? 0) + x.bandwidth() / 2}
          top={MARGIN.top + 44}
          width={width}
          title={hovered.label}
          rows={[
            {
              key: "gap",
              colour: hovered.value <= 0 ? colours[0] : colours[1],
              label: hovered.value <= 0 ? names[0] : names[1],
              value: format(Math.abs(hovered.value)),
              strong: true,
            },
          ]}
        />
      )}
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
          {shown.map((round, i) => {
            if (round.value === null) return null;
            const faded = hover !== null && hover !== from + i;
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
                opacity={faded ? 0.35 : 1}
              />
            );
          })}
          <line x1={0} x2={innerWidth} y1={y(0)} y2={y(0)} stroke="var(--color-line-strong)" />
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

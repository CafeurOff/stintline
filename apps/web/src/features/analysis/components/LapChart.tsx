import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { useId, useState } from "react";

import { ChartTools } from "@/components/charts/ChartTools";
import { ChartTooltip, type TipRow } from "@/components/charts/ChartTooltip";
import { ClipArea } from "@/components/charts/ClipArea";
import { type Range, useZoom } from "@/components/charts/zoom";
import { ZoomLayer } from "@/components/charts/ZoomLayer";
import { useI18n } from "@/lib/i18n/context";

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

/** A stewards' decision placed on a car's line (ADR 0018). */
export interface LapMark {
  key: string;
  car: number;
  lap: number;
  label: string;
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
  /** Decisions drawn as small flags on the cars' lines, with their text as a tooltip. */
  marks?: readonly LapMark[];
  /** A click on the chart picks the car whose line is nearest (to highlight it). */
  onPick?: (key: number) => void;
  /** Values in the tooltip, more precise than the axis; the axis format by default. */
  tipFormat?: (value: number) => string;
}

/** Rows the tooltip lists when no car is highlighted: the lines nearest the pointer. */
const TIP_ROWS = 8;

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
  marks = [],
  onPick,
  tipFormat,
}: LapChartProps) {
  const { t } = useI18n();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const [low, high] = yDomain ?? [Math.min(0, ...all), Math.max(1, ...all)];
  const full = { x: [1, Math.max(totalLaps, 2)] as Range, y: [low, high] as Range };
  const zoom = useZoom(
    full,
    `${series.map((s) => s.key).join(",")}|${String(totalLaps)}|${String(low)}|${String(high)}`,
  );
  const [hover, setHover] = useState<{ lap: number; py: number } | null>(null);
  const x = scaleLinear({ domain: [...zoom.view.x], range: [0, innerWidth] });
  const y = scaleLinear({
    domain: [...zoom.view.y],
    range: invert ? [0, innerHeight] : [innerHeight, 0],
  });

  /** Values of the visible laps, to fit the y axis after a zoom on laps only. */
  const fitY = ([from, to]: Range): Range => {
    const seen = series.flatMap((s) =>
      s.values.filter((v, i): v is number => v !== null && i + 1 >= from && i + 1 <= to),
    );
    if (seen.length === 0) return full.y;
    const lo = Math.min(...seen);
    const hi = Math.max(...seen);
    const pad = Math.max((hi - lo) * 0.06, 0.5);
    return [Math.max(full.y[0], lo - pad), Math.min(full.y[1], hi + pad)];
  };
  const lapAt = (px: number) =>
    Math.min(Math.max(Math.round(x.invert(px)), 1), Math.max(totalLaps, 1));
  const nearest = (lap: number, py: number) =>
    series
      .map((s) => ({ s, value: s.values[lap - 1] ?? null }))
      .filter((d): d is { s: LapSeries; value: number } => d.value !== null)
      .sort((a, b) => Math.abs(y(a.value) - py) - Math.abs(y(b.value) - py));

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

  const hits = hover ? nearest(hover.lap, hover.py) : [];
  const tipSeries = (
    highlighted.size > 0 ? hits.filter((d) => highlighted.has(d.s.key)) : hits.slice(0, TIP_ROWS)
  ).sort((a, b) => a.value - b.value);
  const closest = hits[0]?.s.key;
  const rows: TipRow[] = tipSeries.map(({ s, value }) => ({
    key: s.key,
    colour: teamColour(s.colour),
    label: s.label,
    value: (tipFormat ?? yFormat)(value),
    dashed: s.dashed,
    strong: s.key === closest,
  }));
  const tipMarks = hover ? marks.filter((m) => m.lap === hover.lap) : [];

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden">
      <ChartTools
        zoom={zoom}
        csv={() => [
          [xLabel, ...series.map((s) => s.label)],
          ...Array.from({ length: totalLaps }, (_, i) => [
            i + 1,
            ...series.map((s) => s.values[i] ?? null),
          ]),
        ]}
      />
      {hover && rows.length > 0 && (
        <ChartTooltip
          left={MARGIN.left + x(hover.lap)}
          top={MARGIN.top + 44}
          width={width}
          title={t("chart.lap", { n: hover.lap })}
          rows={rows}
          footer={tipMarks.length > 0 ? tipMarks.map((m) => m.label).join(" · ") : undefined}
        />
      )}
      <svg width={width} height={height} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>{label}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={y} width={innerWidth} numTicks={6} stroke="var(--color-line)" />
          <ClipArea width={innerWidth} height={innerHeight}>
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
            {marks.map((mark) => {
              const value = series.find((s) => s.key === mark.car)?.values[mark.lap - 1];
              if (value == null) return null;
              const cx = x(mark.lap);
              const cy = y(value);
              return (
                <g key={mark.key} data-testid="lap-mark">
                  <title>{mark.label}</title>
                  <path
                    d={`M${String(cx)} ${String(cy - 4)}l-5 -9h10z`}
                    fill="var(--color-t-yellow)"
                    stroke="var(--color-panel)"
                    strokeWidth={1}
                  />
                  <circle cx={cx} cy={cy} r={2.5} fill="var(--color-t-yellow)" />
                </g>
              );
            })}
            {hover && (
              <g pointerEvents="none">
                <line
                  x1={x(hover.lap)}
                  x2={x(hover.lap)}
                  y1={0}
                  y2={innerHeight}
                  stroke="var(--color-ink)"
                  strokeOpacity={0.35}
                  strokeDasharray="3 3"
                />
                {tipSeries.map(({ s, value }) => (
                  <circle
                    key={s.key}
                    cx={x(hover.lap)}
                    cy={y(value)}
                    r={4}
                    fill={teamColour(s.colour)}
                    stroke="var(--color-bg)"
                    strokeWidth={1.5}
                  />
                ))}
              </g>
            )}
          </ClipArea>
          <ZoomLayer
            width={innerWidth}
            height={innerHeight}
            x={x}
            y={y}
            onZoom={(next) => {
              const xs = next.x ?? zoom.view.x;
              zoom.zoomTo({ x: xs, y: next.y ?? (next.x ? fitY(xs) : zoom.view.y) });
            }}
            onReset={zoom.reset}
            onHover={(p) => {
              setHover({ lap: lapAt(p.x), py: p.y });
            }}
            onLeave={() => {
              setHover(null);
            }}
            {...(onPick
              ? {
                  onPick: (p: { x: number; y: number }) => {
                    const hit = nearest(lapAt(p.x), p.y)[0];
                    if (hit) onPick(hit.s.key);
                  },
                }
              : {})}
          />
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
            numTicks={Math.min(Math.ceil(zoom.view.x[1] - zoom.view.x[0]), 12)}
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

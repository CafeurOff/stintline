import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { useId, useState } from "react";

import { ChartTools } from "@/components/charts/ChartTools";
import { useI18n } from "@/lib/i18n/context";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { ClipArea } from "@/components/charts/ClipArea";
import { type Range, useZoom } from "@/components/charts/zoom";
import { ZoomLayer } from "@/components/charts/ZoomLayer";

import { compoundInfo } from "@/lib/compounds";
import { useElementWidth } from "@/lib/useElementWidth";

interface ScatterSeries {
  key: number;
  label: string;
  points: readonly { lap: number; value: number; compound: string; tip: string }[];
}

const MARGIN = { top: 12, right: 16, bottom: 40, left: 60 };
const SHAPES = ["circle", "square", "diamond"] as const;
/** A point counts as under the pointer within this many pixels. */
const NEAR_PX = 24;

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
  const { t } = useI18n();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const values = series.flatMap((s) => s.points.map((p) => p.value));
  const spread = Math.max((Math.max(...values) - Math.min(...values)) * 0.05, 0.05);
  const full = {
    x: [0.5, Math.max(totalLaps, 2) + 0.5] as Range,
    y: [Math.min(...values) - spread, Math.max(...values) + spread] as Range,
  };
  const zoom = useZoom(full, `${series.map((s) => s.key).join(",")}|${String(totalLaps)}`);
  const [hover, setHover] = useState<{ px: number; py: number } | null>(null);
  const x = scaleLinear({ domain: [...zoom.view.x], range: [0, innerWidth] });
  const y = scaleLinear({ domain: [...zoom.view.y], range: [innerHeight, 0] });
  const near = hover
    ? series
        .flatMap((s) => s.points.map((p) => ({ s, p })))
        .map((d) => ({
          ...d,
          distance: Math.hypot(x(d.p.lap) - hover.px, y(d.p.value) - hover.py),
        }))
        .filter((d) => d.distance < NEAR_PX)
        .sort((a, b) => a.distance - b.distance)[0]
    : undefined;
  return (
    <div ref={ref} className="relative w-full min-w-0">
      <ChartTools
        zoom={zoom}
        csv={() => [
          [t("tyres.col.driver"), xLabel, label, t("tyres.col.compound")],
          ...series.flatMap((s) => s.points.map((p) => [s.label, p.lap, p.value, p.compound])),
        ]}
      />
      {near && (
        <ChartTooltip
          left={MARGIN.left + x(near.p.lap)}
          top={MARGIN.top + 44 + y(near.p.value) / 2}
          width={width}
          title={near.s.label}
          rows={[
            {
              key: "v",
              colour: compoundInfo(near.p.compound).fill,
              label: xLabel + " " + String(near.p.lap),
              value: format(near.p.value),
              strong: true,
            },
          ]}
          footer={near.p.tip}
        />
      )}
      <svg width={width} height={height} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>{label}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={y} width={innerWidth} numTicks={6} stroke="var(--color-line)" />
          <ClipArea width={innerWidth} height={innerHeight}>
            {series.map((s, index) =>
              s.points.map((p) => {
                const fill = compoundInfo(p.compound).fill;
                const cx = x(p.lap);
                const cy = y(p.value);
                const shape = SHAPES[index % SHAPES.length];
                const common = { fill, stroke: "var(--color-panel)", strokeWidth: 1 };
                return (
                  <g
                    key={`${String(s.key)}-${String(p.lap)}`}
                    opacity={near && near.s.key !== s.key ? 0.3 : 1}
                  >
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
            {near && (
              <circle
                cx={x(near.p.lap)}
                cy={y(near.p.value)}
                r={7}
                fill="none"
                stroke="var(--color-ink)"
                strokeWidth={2}
                pointerEvents="none"
              />
            )}
          </ClipArea>
          <ZoomLayer
            width={innerWidth}
            height={innerHeight}
            x={x}
            y={y}
            onZoom={(next) => {
              zoom.zoomTo({ x: next.x ?? zoom.view.x, y: next.y ?? zoom.view.y });
            }}
            onReset={zoom.reset}
            onHover={(pt) => {
              setHover({ px: pt.x, py: pt.y });
            }}
            onLeave={() => {
              setHover(null);
            }}
          />
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
            numTicks={Math.min(Math.ceil(zoom.view.x[1] - zoom.view.x[0]), 12)}
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

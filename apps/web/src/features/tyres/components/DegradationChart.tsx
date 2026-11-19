import type { Schema } from "@stintline/api-types";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { useId, useState } from "react";

import { ChartTools } from "@/components/charts/ChartTools";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { ClipArea } from "@/components/charts/ClipArea";
import { type Range, useZoom } from "@/components/charts/zoom";
import { ZoomLayer } from "@/components/charts/ZoomLayer";

import { useI18n } from "@/lib/i18n/context";
import { useElementWidth } from "@/lib/useElementWidth";

import { evaluateFit } from "../fit";

type StintFit = Schema<"StintFit">;

export interface SeriesStyle {
  colour: string;
  dashed: boolean;
  label: string;
}

const HEIGHT = 340;
const MARGIN = { top: 12, right: 16, bottom: 40, left: 64 };
/** A point counts as under the pointer within this many pixels. */
const NEAR_PX = 28;

interface DegradationChartProps {
  label: string;
  stints: readonly StintFit[];
  styleFor: (carNumber: number) => SeriesStyle;
}

/** Fuel-corrected lap time against tyre age, one colour per driver, fitted curve per stint. */
export function DegradationChart({ label, stints, styleFor }: DegradationChartProps) {
  const { t, f } = useI18n();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  const points = stints.flatMap((stint) => stint.points);
  const maxAge = Math.max(5, ...points.map((p) => p.tyre_age));
  const times = points.map((p) => p.corrected_time_s);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const pad = Math.max((maxTime - minTime) * 0.08, 0.2);

  const full = { x: [0, maxAge + 1] as Range, y: [minTime - pad, maxTime + pad] as Range };
  const zoom = useZoom(
    full,
    stints.map((s) => `${String(s.car_number)}-${String(s.stint)}`).join(","),
  );
  const [hover, setHover] = useState<{ px: number; py: number } | null>(null);
  const x = scaleLinear({ domain: [...zoom.view.x], range: [0, innerWidth] });
  const y = scaleLinear({ domain: [...zoom.view.y], range: [innerHeight, 0] });
  const near = hover
    ? stints
        .flatMap((stint) => stint.points.map((point) => ({ stint, point })))
        .map((d) => ({
          ...d,
          distance: Math.hypot(
            x(d.point.tyre_age) - hover.px,
            y(d.point.corrected_time_s) - hover.py,
          ),
        }))
        .filter((d) => d.distance < NEAR_PX)
        .sort((a, b) => a.distance - b.distance)[0]
    : undefined;

  const nearStyle = near ? styleFor(near.stint.car_number) : null;
  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden">
      <ChartTools zoom={zoom} />
      {near && nearStyle && (
        <ChartTooltip
          left={MARGIN.left + x(near.point.tyre_age)}
          top={MARGIN.top + 44 + y(near.point.corrected_time_s) / 2}
          width={width}
          title={nearStyle.label}
          rows={[
            {
              key: "time",
              colour: nearStyle.colour,
              label: t("tyres.age"),
              value: String(near.point.tyre_age),
            },
            {
              key: "lap",
              colour: nearStyle.colour,
              label: label,
              value: f.lapTime(near.point.corrected_time_s),
              strong: true,
            },
          ]}
        />
      )}
      <svg width={width} height={HEIGHT} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>{label}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows
            scale={y}
            width={innerWidth}
            numTicks={6}
            stroke="var(--color-line)"
            strokeDasharray="2 4"
          />
          <ClipArea width={innerWidth} height={innerHeight}>
            {stints.map((stint) => {
              const style = styleFor(stint.car_number);
              const faded = near !== undefined && near.stint.car_number !== stint.car_number;
              const ages = stint.points.map((p) => p.tyre_age);
              const from = Math.min(...ages);
              const to = Math.max(...ages);
              const curve = Array.from({ length: 24 }, (_, i) => from + ((to - from) * i) / 23);
              return (
                <g key={`${stint.car_number}-${stint.stint}`} opacity={faded ? 0.25 : 1}>
                  {stint.points.map((point) => (
                    <circle
                      key={point.tyre_age}
                      cx={x(point.tyre_age)}
                      cy={y(point.corrected_time_s)}
                      r={3}
                      fill={style.colour}
                      fillOpacity={0.55}
                    />
                  ))}
                  <LinePath
                    data={curve}
                    x={(age) => x(age)}
                    y={(age) => y(evaluateFit(stint.coefficients, age))}
                    stroke={style.colour}
                    strokeWidth={2.5}
                    strokeDasharray={style.dashed ? "6 4" : undefined}
                  />
                </g>
              );
            })}
            {near && (
              <circle
                cx={x(near.point.tyre_age)}
                cy={y(near.point.corrected_time_s)}
                r={6}
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
            onHover={(p) => {
              setHover({ px: p.x, py: p.y });
            }}
            onLeave={() => {
              setHover(null);
            }}
          />
          <AxisLeft
            scale={y}
            numTicks={6}
            tickFormat={(value) => f.lapTime(Number(value))}
            stroke="var(--color-line-strong)"
            tickStroke="var(--color-line-strong)"
            tickLabelProps={{ fill: "var(--color-muted)", fontSize: 11, textAnchor: "end" }}
          />
          <AxisBottom
            top={innerHeight}
            scale={x}
            numTicks={Math.min(10, Math.floor(innerWidth / 60))}
            stroke="var(--color-line-strong)"
            tickStroke="var(--color-line-strong)"
            tickLabelProps={{ fill: "var(--color-muted)", fontSize: 11, textAnchor: "middle" }}
            label={t("tyres.age")}
            labelProps={{ fill: "var(--color-muted)", fontSize: 11, textAnchor: "middle" }}
          />
        </Group>
      </svg>
    </div>
  );
}

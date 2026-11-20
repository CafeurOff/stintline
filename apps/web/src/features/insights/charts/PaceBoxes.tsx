import { AxisBottom } from "@visx/axis";
import { GridColumns } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { useId, useState } from "react";

import { ChartTools } from "@/components/charts/ChartTools";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { ClipArea } from "@/components/charts/ClipArea";
import { type Range, useZoom } from "@/components/charts/zoom";
import { ZoomLayer } from "@/components/charts/ZoomLayer";
import { useI18n } from "@/lib/i18n/context";

import { teamColour, teamTint } from "@/lib/teams";
import { useElementWidth } from "@/lib/useElementWidth";

interface PaceBox {
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
  const { t } = useI18n();
  const lows = boxes.map((b) => b.low);
  const highs = boxes.map((b) => b.high);
  const base = scaleLinear({ domain: [Math.min(...lows), Math.max(...highs)], nice: true });
  const rows = boxes.length * ROW;
  const full = { x: base.domain() as unknown as Range, y: [0, rows] as Range };
  const zoom = useZoom(full, boxes.map((b) => b.key).join(","));
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const x = scaleLinear({ domain: [...zoom.view.x], range: [0, innerWidth] });
  const rowScale = scaleLinear({ domain: [0, rows], range: [0, rows] });
  const [lo, hi] = x.domain() as [number, number];
  const hovered = hoverRow === null ? undefined : boxes[hoverRow];
  const clamp = (v: number) => x(Math.max(lo, Math.min(hi, v)));
  return (
    <div ref={ref} className="relative w-full min-w-0">
      <ChartTools
        zoom={zoom}
        csv={() => [
          [
            t("tyres.col.driver"),
            t("chart.median"),
            "Q1",
            "Q3",
            t("chart.fastestKept"),
            t("chart.slowestKept"),
          ],
          ...boxes.map((b) => [b.label, b.median, b.q1, b.q3, b.low, b.high]),
        ]}
      />
      {hovered && hoverRow !== null && (
        <ChartTooltip
          left={MARGIN.left + clamp(hovered.median)}
          top={MARGIN.top + 44 + hoverRow * ROW}
          width={width}
          title={hovered.label}
          rows={[
            ["median", t("chart.median"), hovered.median, true],
            ["q", t("chart.middleHalf"), null, false],
            ["low", t("chart.fastestKept"), hovered.low, false],
            ["high", t("chart.slowestKept"), hovered.high, false],
          ].map(([key, name, value, strong]) => ({
            key: String(key),
            colour: teamColour(hovered.colour),
            label: String(name),
            value:
              value === null
                ? `${format(hovered.q1)} – ${format(hovered.q3)}`
                : format(Number(value)),
            strong: Boolean(strong),
          }))}
          footer={
            hovered.outliers.length > 0
              ? t("chart.outliers", { n: hovered.outliers.length })
              : undefined
          }
        />
      )}
      <svg width={width} height={height} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>{label}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridColumns
            scale={x}
            height={boxes.length * ROW}
            numTicks={6}
            stroke="var(--color-line)"
          />
          {hoverRow !== null && (
            <rect
              y={hoverRow * ROW}
              width={innerWidth}
              height={ROW}
              fill="var(--color-ink)"
              fillOpacity={0.05}
              pointerEvents="none"
            />
          )}
          {boxes.map((box, i) => {
            const cy = i * ROW + ROW / 2;
            const fill = teamColour(box.colour);
            return (
              <g key={box.key}>
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
          <ClipArea width={innerWidth} height={rows}>
            <ZoomLayer
              width={innerWidth}
              height={rows}
              x={x}
              y={rowScale}
              onZoom={(next) => {
                if (next.x) zoom.zoomTo({ x: next.x, y: full.y });
              }}
              onReset={zoom.reset}
              onHover={(pt) => {
                setHoverRow(Math.min(Math.floor(pt.y / ROW), boxes.length - 1));
              }}
              onLeave={() => {
                setHoverRow(null);
              }}
            />
          </ClipArea>
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

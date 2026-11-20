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
import { teamColour } from "@/lib/teams";
import { useElementWidth } from "@/lib/useElementWidth";

import { spreadLabels } from "../labels";

interface ProgressionLine {
  key: string;
  label: string;
  colour: string | null | undefined;
  points: readonly (number | null)[];
}

const HEIGHT = 380;
/** Minimum vertical distance between two end-of-line labels, in pixels. */
const LABEL_GAP = 12;
const MARGIN = { top: 12, right: 56, bottom: 36, left: 48 };

/** Championship points after each round, one line per driver or team. */
export function ProgressionChart({
  lines,
  rounds,
  label,
}: {
  lines: readonly ProgressionLine[];
  rounds: readonly number[];
  label: string;
}) {
  const { t } = useI18n();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const max = Math.max(10, ...lines.flatMap((l) => l.points.map((p) => p ?? 0)));
  const full = { x: [0, Math.max(rounds.length - 1, 1)] as Range, y: [0, max * 1.05] as Range };
  const zoom = useZoom(full, `${lines.map((l) => l.key).join(",")}|${String(rounds.length)}`);
  const [hover, setHover] = useState<{ i: number; py: number } | null>(null);
  const x = scaleLinear({ domain: [...zoom.view.x], range: [0, innerWidth] });
  const y = scaleLinear({ domain: [...zoom.view.y], range: [innerHeight, 0], nice: !zoom.zoomed });
  const indexAt = (px: number) =>
    Math.min(Math.max(Math.round(x.invert(px)), 0), Math.max(rounds.length - 1, 0));
  const fitY = ([from, to]: Range): Range => {
    const seen = lines.flatMap((l) =>
      l.points.filter((p, i): p is number => p !== null && i >= from && i <= to),
    );
    if (seen.length === 0) return full.y;
    const pad = Math.max((Math.max(...seen) - Math.min(...seen)) * 0.06, 2);
    return [Math.max(0, Math.min(...seen) - pad), Math.max(...seen) + pad];
  };

  const labelY = spreadLabels(
    lines.map((line) => {
      const last = [...line.points].reverse().find((p) => p !== null);
      return last == null ? null : y(last);
    }),
    LABEL_GAP,
  );
  const seen = new Set<string>();
  const styled = lines.map((line, index) => {
    const colour = teamColour(line.colour);
    const dashed = seen.has(colour);
    seen.add(colour);
    return { ...line, stroke: colour, dashed, labelY: labelY[index] ?? null };
  });

  const at = hover
    ? styled
        .map((line) => ({ line, value: line.points[hover.i] ?? null }))
        .filter((d): d is { line: (typeof styled)[number]; value: number } => d.value !== null)
    : [];
  const closest = hover
    ? [...at].sort((a, b) => Math.abs(y(a.value) - hover.py) - Math.abs(y(b.value) - hover.py))[0]
    : undefined;

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden">
      <ChartTools
        zoom={zoom}
        csv={() => [
          [t("standings.round"), ...lines.map((l) => l.label)],
          ...rounds.map((round, i) => [round, ...lines.map((l) => l.points[i] ?? null)]),
        ]}
      />
      {hover && at.length > 0 && (
        <ChartTooltip
          left={MARGIN.left + x(hover.i)}
          top={MARGIN.top + 44}
          width={width}
          title={t("chart.round", { n: rounds[hover.i] ?? hover.i + 1 })}
          rows={[...at]
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)
            .map(({ line, value }) => ({
              key: line.key,
              colour: line.stroke,
              label: line.label,
              value: String(Math.round(value)),
              dashed: line.dashed,
              strong: line.key === closest?.line.key,
            }))}
        />
      )}
      <svg width={width} height={HEIGHT} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>{label}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={y} width={innerWidth} numTicks={6} stroke="var(--color-line)" />
          <ClipArea width={innerWidth} height={innerHeight + 1}>
            {styled.map((line) => {
              const data = line.points
                .map((p, i) => ({ i, p }))
                .filter((d): d is { i: number; p: number } => d.p !== null);
              const last = data[data.length - 1];
              return (
                <g key={line.key} opacity={closest && closest.line.key !== line.key ? 0.3 : 1}>
                  <LinePath
                    data={data}
                    x={(d) => x(d.i)}
                    y={(d) => y(d.p)}
                    stroke={line.stroke}
                    strokeWidth={closest?.line.key === line.key ? 3 : 2}
                    strokeDasharray={line.dashed ? "5 4" : undefined}
                  />
                  {last && line.labelY !== null && (
                    <text
                      x={x(last.i) + 6}
                      y={line.labelY}
                      dy="0.33em"
                      fontSize={11}
                      fontWeight={700}
                      fill="var(--color-ink)"
                    >
                      {line.label}
                    </text>
                  )}
                </g>
              );
            })}
            {hover && (
              <line
                x1={x(hover.i)}
                x2={x(hover.i)}
                y1={0}
                y2={innerHeight}
                stroke="var(--color-ink)"
                strokeOpacity={0.35}
                strokeDasharray="3 3"
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
              const xs = next.x ?? zoom.view.x;
              zoom.zoomTo({ x: xs, y: next.y ?? (next.x ? fitY(xs) : zoom.view.y) });
            }}
            onReset={zoom.reset}
            onHover={(p) => {
              setHover({ i: indexAt(p.x), py: p.y });
            }}
            onLeave={() => {
              setHover(null);
            }}
          />
          <AxisLeft
            scale={y}
            numTicks={6}
            stroke="var(--color-line-strong)"
            tickStroke="var(--color-line-strong)"
            tickLabelProps={{ fill: "var(--color-muted)", fontSize: 11 }}
            label={t("chart.points")}
            labelOffset={30}
            labelProps={{ fill: "var(--color-muted)", fontSize: 12, textAnchor: "middle" }}
          />
          <AxisBottom
            top={innerHeight}
            scale={x}
            numTicks={Math.min(rounds.length, 12)}
            tickFormat={(value) => String(rounds[Math.round(Number(value))] ?? "")}
            stroke="var(--color-line-strong)"
            tickStroke="var(--color-line-strong)"
            tickLabelProps={{ fill: "var(--color-muted)", fontSize: 11 }}
            label={t("standings.round")}
            labelProps={{ fill: "var(--color-muted)", fontSize: 12, textAnchor: "middle" }}
          />
        </Group>
      </svg>
    </div>
  );
}

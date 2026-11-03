import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { useId } from "react";

import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";
import { useElementWidth } from "@/lib/useElementWidth";

import { spreadLabels } from "../labels";

export interface ProgressionLine {
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
  const x = scaleLinear({ domain: [0, Math.max(rounds.length - 1, 1)], range: [0, innerWidth] });
  const y = scaleLinear({ domain: [0, max * 1.05], range: [innerHeight, 0], nice: true });

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

  return (
    <div ref={ref} className="w-full min-w-0 overflow-hidden">
      <svg width={width} height={HEIGHT} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>{label}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={y} width={innerWidth} numTicks={6} stroke="var(--color-line)" />
          {styled.map((line) => {
            const data = line.points
              .map((p, i) => ({ i, p }))
              .filter((d): d is { i: number; p: number } => d.p !== null);
            const last = data[data.length - 1];
            return (
              <g key={line.key}>
                <LinePath
                  data={data}
                  x={(d) => x(d.i)}
                  y={(d) => y(d.p)}
                  stroke={line.stroke}
                  strokeWidth={2}
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
          <AxisLeft
            scale={y}
            numTicks={6}
            stroke="var(--color-line-strong)"
            tickStroke="var(--color-line-strong)"
            tickLabelProps={{ fill: "var(--color-muted)", fontSize: 11 }}
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

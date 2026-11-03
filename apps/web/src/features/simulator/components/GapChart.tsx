import type { Schema } from "@stintline/api-types";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { Line, LinePath } from "@visx/shape";
import { useId } from "react";

import { formatDelta } from "@/lib/format";
import { useElementWidth } from "@/lib/useElementWidth";

const HEIGHT = 220;
const MARGIN = { top: 12, right: 16, bottom: 44, left: 56 };

/** Gap from attacker to defender lap by lap through the stop sequence. Zero = side by side. */
export function GapChart({ gaps }: { gaps: readonly Schema<"LapGap">[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const laps = gaps.map((g) => g.lap);
  const values = gaps.map((g) => g.gap_s);
  const x = scaleLinear({
    domain: [Math.min(...laps), Math.max(...laps)],
    range: [0, innerWidth],
  });
  const extent = Math.max(2, ...values.map(Math.abs)) * 1.1;
  const y = scaleLinear({ domain: [-extent, extent], range: [innerHeight, 0] });

  return (
    <div ref={ref} className="w-full min-w-0 overflow-hidden">
      <svg width={width} height={HEIGHT} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>
          Gap to the defender by lap:{" "}
          {gaps.map((g) => `lap ${g.lap} ${formatDelta(g.gap_s, 1)}`).join(", ")}.
        </title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <rect
            x={0}
            y={y(0)}
            width={innerWidth}
            height={innerHeight - y(0)}
            fill="var(--color-ok)"
            opacity={0.06}
          />
          <Line
            from={{ x: 0, y: y(0) }}
            to={{ x: innerWidth, y: y(0) }}
            stroke="var(--color-border-strong)"
            strokeDasharray="4 4"
          />
          <text x={4} y={y(0) - 6} className="fill-text-muted text-[10px]">
            attacker behind
          </text>
          <text x={4} y={y(0) + 14} className="fill-ok text-[10px]">
            attacker ahead
          </text>
          <LinePath
            data={[...gaps]}
            x={(g) => x(g.lap)}
            y={(g) => y(g.gap_s)}
            stroke="var(--color-accent)"
            strokeWidth={2.5}
          />
          {gaps.map((g) => (
            <circle key={g.lap} cx={x(g.lap)} cy={y(g.gap_s)} r={4} fill="var(--color-accent)" />
          ))}
          <AxisLeft
            scale={y}
            numTicks={5}
            tickFormat={(v) => `${Number(v).toFixed(0)} s`}
            stroke="var(--color-border-strong)"
            tickStroke="var(--color-border-strong)"
            tickLabelProps={{ fill: "var(--color-text-muted)", fontSize: 11, textAnchor: "end" }}
          />
          <AxisBottom
            top={innerHeight}
            scale={x}
            numTicks={gaps.length}
            tickFormat={(v) => String(v)}
            stroke="var(--color-border-strong)"
            tickStroke="var(--color-border-strong)"
            tickLabelProps={{ fill: "var(--color-text-muted)", fontSize: 11, textAnchor: "middle" }}
            label="Lap"
            labelProps={{ fill: "var(--color-text-muted)", fontSize: 11, textAnchor: "middle" }}
          />
        </Group>
      </svg>
    </div>
  );
}

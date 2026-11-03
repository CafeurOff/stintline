import type { Schema } from "@stintline/api-types";
import { AxisBottom } from "@visx/axis";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { useId } from "react";

import { compoundInfo } from "@/lib/compounds";
import { teamColour } from "@/lib/teams";
import { useElementWidth } from "@/lib/useElementWidth";

import { byFinish, driverCode } from "../entries";

type EntryStints = Schema<"EntryStints">;
type Neutralisation = Schema<"Neutralisation">;

const ROW_HEIGHT = 22;
const MARGIN = { top: 22, right: 12, bottom: 30, left: 76 };
const MIN_WIDTH_FOR_LETTER = 16;

interface StintTimelineProps {
  rows: readonly EntryStints[];
  totalLaps: number;
  neutralisations: readonly Neutralisation[];
}

/** One row per driver in finishing order, one bar per stint coloured by compound. */
export function StintTimeline({ rows, totalLaps, neutralisations }: StintTimelineProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const ordered = [...rows].sort(byFinish);
  const height = MARGIN.top + MARGIN.bottom + ordered.length * ROW_HEIGHT;
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);

  const x = scaleLinear({ domain: [0, totalLaps], range: [0, innerWidth] });
  const y = scaleBand({
    domain: ordered.map((row) => row.car_number),
    range: [0, ordered.length * ROW_HEIGHT],
    padding: 0.18,
  });
  const band = y.bandwidth();

  return (
    <div ref={ref} className="w-full min-w-0 overflow-hidden">
      <svg
        width={width}
        height={height}
        role="img"
        aria-labelledby={titleId}
        className="block max-w-full"
      >
        <title id={titleId}>
          Stint timeline: {ordered.length} drivers over {totalLaps} laps, bars coloured and lettered
          by tyre compound.
        </title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          {neutralisations.map((period, index) => {
            const start = (period.lap_start ?? 1) - 1;
            const end = period.lap_end ?? totalLaps;
            return (
              <g key={index}>
                <rect
                  x={x(start)}
                  y={-MARGIN.top + 4}
                  width={Math.max(x(end) - x(start), 2)}
                  height={ordered.length * ROW_HEIGHT + MARGIN.top - 4}
                  fill="var(--color-warn)"
                  opacity={0.14}
                />
                <text
                  x={x(start) + 3}
                  y={-MARGIN.top + 15}
                  className="fill-warn text-[10px] font-semibold"
                >
                  {period.status}
                </text>
              </g>
            );
          })}
          {ordered.map((row) => {
            const top = y(row.car_number) ?? 0;
            return (
              <g key={row.car_number}>
                <rect
                  x={-MARGIN.left + 4}
                  y={top}
                  width={3}
                  height={band}
                  rx={1}
                  fill={teamColour(row.team_colour)}
                />
                <text
                  x={-MARGIN.left + 12}
                  y={top + band / 2}
                  dominantBaseline="central"
                  className="tabular fill-text-muted text-[11px]"
                >
                  {row.finish_position ?? "–"}
                </text>
                <text
                  x={-MARGIN.left + 32}
                  y={top + band / 2}
                  dominantBaseline="central"
                  className="fill-text text-[11px] font-semibold"
                >
                  {driverCode(row)}
                </text>
                {row.stints.map((stint) => {
                  if (stint.lap_start == null || stint.lap_end == null) return null;
                  const info = compoundInfo(stint.compound);
                  const left = x(stint.lap_start - 1);
                  const barWidth = Math.max(x(stint.lap_end) - left, 1);
                  const used = (stint.tyre_age_at_start ?? 0) > 0;
                  return (
                    <g key={stint.stint_number}>
                      <rect
                        x={left}
                        y={top}
                        width={barWidth}
                        height={band}
                        rx={3}
                        fill={info.fill}
                        stroke="var(--color-surface)"
                        strokeWidth={1.5}
                      >
                        <title>
                          {`${driverCode(row)} stint ${stint.stint_number}: ${info.label}, laps ${stint.lap_start}–${stint.lap_end}${used ? `, used tyres (${stint.tyre_age_at_start} laps old)` : ""}`}
                        </title>
                      </rect>
                      {barWidth >= MIN_WIDTH_FOR_LETTER && (
                        <text
                          x={left + 6}
                          y={top + band / 2}
                          dominantBaseline="central"
                          className="pointer-events-none fill-ink text-[10px] font-bold"
                        >
                          {info.letter}
                          {used ? "*" : ""}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
          <AxisBottom
            top={ordered.length * ROW_HEIGHT}
            scale={x}
            numTicks={Math.min(10, Math.floor(innerWidth / 60))}
            stroke="var(--color-border-strong)"
            tickStroke="var(--color-border-strong)"
            tickLabelProps={{
              fill: "var(--color-text-muted)",
              fontSize: 11,
              textAnchor: "middle",
            }}
            label="Lap"
            labelProps={{ fill: "var(--color-text-muted)", fontSize: 11, textAnchor: "middle" }}
            labelOffset={8}
          />
        </Group>
      </svg>
      <p className="mt-1 text-xs text-text-muted">* stint started on used tyres.</p>
    </div>
  );
}

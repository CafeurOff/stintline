import type { Schema } from "@stintline/api-types";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { curveStepAfter } from "@visx/curve";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { type PointerEvent, useId } from "react";

import { useI18n } from "@/lib/i18n/context";
import { useElementWidth } from "@/lib/useElementWidth";

import type { CarStyle } from "./colours";

type Compare = Schema<"TelemetryCompare">;
type Channel = "speed" | "throttle" | "brake" | "gear" | "delta";

interface Panel {
  channel: Channel;
  height: number;
}

const PANELS: readonly Panel[] = [
  { channel: "speed", height: 190 },
  { channel: "throttle", height: 80 },
  { channel: "brake", height: 16 },
  { channel: "gear", height: 80 },
  { channel: "delta", height: 110 },
];
const GAP = 22;
const MARGIN = { top: 8, right: 16, bottom: 36, left: 56 };
const BRAKE_ROW = 6;

interface TelemetryChartProps {
  data: Compare;
  styles: readonly CarStyle[];
  /** Index of the hovered point, shared with the circuit drawing. */
  cursor: number | null;
  onCursor: (index: number | null) => void;
}

function values(car: Schema<"TelemetryCar">, channel: Channel): number[] {
  switch (channel) {
    case "speed":
      return car.speed_kph;
    case "throttle":
      return car.throttle_pct;
    case "gear":
      return car.gear;
    case "delta":
      return car.delta_s;
    default:
      return car.brake.map(Number);
  }
}

/**
 * Speed, throttle, brake, gear and time gap along the lap, one line per driver, all on
 * the same distance axis. Pointing anywhere shows every value at that spot.
 */
export function TelemetryChart({ data, styles, cursor, onCursor }: TelemetryChartProps) {
  const { t, f } = useI18n();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const titleId = useId();
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 160);
  const x = scaleLinear({ domain: [0, data.length_m], range: [0, innerWidth] });
  const distance = (index: number) => index * data.step_m;
  const multi = data.cars.length > 1;
  const panels = PANELS.filter((p) => p.channel !== "delta" || multi);
  const placed = panels.map((panel, index) => ({
    ...panel,
    top: panels.slice(0, index).reduce((sum, p) => sum + p.height + GAP, 0),
  }));
  const total = panels.reduce((sum, p) => sum + p.height, 0) + GAP * (panels.length - 1);
  const height = total + MARGIN.top + MARGIN.bottom;

  const onMove = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const metres = x.invert(event.clientX - box.left);
    const index = Math.round(metres / data.step_m);
    onCursor(Math.min(Math.max(index, 0), data.points - 1));
  };

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg width={width} height={height} role="img" aria-labelledby={titleId} className="block">
        <title id={titleId}>{t("telemetry.chartTitle")}</title>
        <Group left={MARGIN.left} top={MARGIN.top}>
          {placed.map((panel) => (
            <Group key={panel.channel} top={panel.top}>
              <PanelLines
                panel={panel}
                data={data}
                styles={styles}
                width={innerWidth}
                x={x}
                label={t(`telemetry.channel.${panel.channel}`)}
              />
            </Group>
          ))}
          <AxisBottom
            top={total}
            scale={x}
            numTicks={innerWidth < 420 ? 4 : 8}
            tickFormat={(value) => `${f.number(Number(value) / 1000, 1)} km`}
            stroke="var(--color-line-strong)"
            tickStroke="var(--color-line-strong)"
            tickLabelProps={{ fill: "var(--color-muted)", fontSize: 11 }}
          />
          {cursor !== null && (
            <line
              x1={x(distance(cursor))}
              x2={x(distance(cursor))}
              y1={0}
              y2={total}
              stroke="var(--color-ink)"
              strokeOpacity={0.5}
            />
          )}
          <rect
            width={innerWidth}
            height={total}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => {
              onCursor(null);
            }}
          />
        </Group>
      </svg>
      {cursor !== null && (
        <Readout data={data} styles={styles} index={cursor} distance={distance(cursor)} />
      )}
    </div>
  );
}

function PanelLines({
  panel,
  data,
  styles,
  width,
  x,
  label,
}: {
  panel: Panel;
  data: Compare;
  styles: readonly CarStyle[];
  width: number;
  x: (value: number) => number;
  label: string;
}) {
  const { f } = useI18n();
  const { channel, height } = panel;
  if (channel === "brake") {
    return (
      <g>
        <text
          x={-8}
          y={height / 2}
          dy="0.33em"
          textAnchor="end"
          fontSize={11}
          fill="var(--color-muted)"
        >
          {label}
        </text>
        {data.cars.map((car, row) => (
          <g key={car.car_number} transform={`translate(0 ${String(row * (BRAKE_ROW - 1))})`}>
            {car.brake.map((on, index) =>
              on ? (
                <rect
                  key={index}
                  x={x(index * data.step_m)}
                  width={Math.max(x(data.step_m) - x(0), 1)}
                  height={BRAKE_ROW - 1}
                  fill={styles[row]?.colour}
                />
              ) : null,
            )}
          </g>
        ))}
      </g>
    );
  }
  const all = data.cars.flatMap((car) => values(car, channel));
  const domain: [number, number] =
    channel === "throttle"
      ? [0, 100]
      : channel === "gear"
        ? [1, 8]
        : channel === "delta"
          ? [Math.min(-0.1, ...all), Math.max(0.1, ...all)]
          : [Math.max(0, Math.min(...all) - 10), Math.max(...all) + 10];
  const y = scaleLinear({ domain, range: [height, 0] });
  const format =
    channel === "delta"
      ? (v: number) => `${v > 0 ? "+" : ""}${f.number(v, 1)}`
      : (v: number) => String(Math.round(v));
  return (
    <g>
      <GridRows
        scale={y}
        width={width}
        numTicks={channel === "speed" ? 5 : 3}
        stroke="var(--color-line)"
      />
      {channel === "delta" && (
        <line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke="var(--color-line-strong)" />
      )}
      {data.cars.map((car, index) => (
        <LinePath
          key={car.car_number}
          data={values(car, channel)}
          x={(_, i) => x(i * data.step_m)}
          y={(v) => y(v)}
          {...(channel === "gear" ? { curve: curveStepAfter } : {})}
          stroke={styles[index]?.colour ?? "currentColor"}
          strokeWidth={1.75}
          strokeDasharray={styles[index]?.dashed ? "5 3" : undefined}
        />
      ))}
      <AxisLeft
        scale={y}
        numTicks={channel === "speed" ? 5 : 3}
        tickFormat={(v) => format(Number(v))}
        stroke="var(--color-line-strong)"
        tickStroke="var(--color-line-strong)"
        tickLabelProps={{ fill: "var(--color-muted)", fontSize: 10 }}
        label={label}
        labelOffset={30}
        labelProps={{ fill: "var(--color-muted)", fontSize: 11, textAnchor: "middle" }}
      />
    </g>
  );
}

function Readout({
  data,
  styles,
  index,
  distance,
}: {
  data: Compare;
  styles: readonly CarStyle[];
  index: number;
  distance: number;
}) {
  const { t, f } = useI18n();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none mt-2 flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-raised px-3 py-2 text-sm tabular-nums"
    >
      <span className="text-muted">{f.number(distance / 1000, 2)} km</span>
      {data.cars.map((car, i) => (
        <span key={car.car_number} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-3 w-1 rounded-full"
            style={{ backgroundColor: styles[i]?.colour }}
          />
          <span className="font-semibold">{car.entry.driver.code}</span>
          {t("telemetry.readout", {
            speed: Math.round(car.speed_kph[index] ?? 0),
            throttle: Math.round(car.throttle_pct[index] ?? 0),
            gear: car.gear[index] ?? 0,
          })}
          {car.brake[index] && (
            <span className="font-semibold text-loss">{t("telemetry.braking")}</span>
          )}
          {i > 0 && <span className="text-muted">{f.delta(car.delta_s[index] ?? 0, 3)}</span>}
        </span>
      ))}
    </div>
  );
}

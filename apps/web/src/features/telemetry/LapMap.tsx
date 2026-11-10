import type { Schema } from "@stintline/api-types";
import { useId } from "react";

import { useI18n } from "@/lib/i18n/context";

import type { CarStyle } from "./colours";

type Compare = Schema<"TelemetryCompare">;
type State = "full" | "brake" | "partial";

const STROKE: Record<State, string> = {
  full: "var(--color-gain)",
  brake: "var(--color-loss)",
  partial: "var(--color-caution)",
};
const FULL_THROTTLE = 99;

function stateAt(car: Schema<"TelemetryCar">, index: number): State {
  if (car.brake[index]) return "brake";
  return (car.throttle_pct[index] ?? 0) >= FULL_THROTTLE ? "full" : "partial";
}

/** Consecutive points in the same state, as polylines that overlap by one point. */
function segments(car: Schema<"TelemetryCar">): { state: State; points: string }[] {
  const out: { state: State; points: string[] }[] = [];
  car.x.forEach((x, index) => {
    const state = stateAt(car, index);
    const point = `${String(x)},${String(car.y[index] ?? 0)}`;
    const last = out.at(-1);
    if (last?.state === state) {
      last.points.push(point);
      return;
    }
    last?.points.push(point);
    out.push({ state, points: [point] });
  });
  return out.map((segment) => ({ state: segment.state, points: segment.points.join(" ") }));
}

interface LapMapProps {
  data: Compare;
  styles: readonly CarStyle[];
  cursor: number | null;
}

/**
 * The first driver's lap drawn on the circuit: green at full throttle, red under braking,
 * amber in between, with each braking zone numbered. The other drivers appear as dots
 * where they were at the pointed distance.
 */
export function LapMap({ data, styles, cursor }: LapMapProps) {
  const { t } = useI18n();
  const titleId = useId();
  const reference = data.cars[0];
  if (!reference) return null;
  const scale = Math.max(data.width, data.height) / 1000;
  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${String(data.width)} ${String(data.height)}`}
        role="img"
        aria-labelledby={titleId}
        className="h-auto max-h-[420px] w-full"
      >
        <title id={titleId}>
          {t("telemetry.mapTitle", { driver: reference.entry.driver.family_name })}
        </title>
        {segments(reference).map((segment, index) => (
          <polyline
            key={index}
            points={segment.points}
            fill="none"
            stroke={STROKE[segment.state]}
            strokeWidth={9 * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {reference.braking_zones.map((zone, index) => (
          <g key={zone.start_m} transform={`translate(${String(zone.x)} ${String(zone.y)})`}>
            <circle
              r={16 * scale}
              fill="var(--color-panel)"
              stroke="var(--color-loss)"
              strokeWidth={3 * scale}
            />
            <text
              dy="0.35em"
              textAnchor="middle"
              fontSize={17 * scale}
              fontWeight={700}
              fill="var(--color-ink)"
            >
              {index + 1}
            </text>
          </g>
        ))}
        {cursor !== null &&
          data.cars.map((car, index) => (
            <circle
              key={car.car_number}
              cx={car.x[cursor]}
              cy={car.y[cursor]}
              r={13 * scale}
              fill={styles[index]?.colour}
              stroke="var(--color-ink)"
              strokeWidth={3 * scale}
            />
          ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {(["full", "partial", "brake"] as const).map((state) => (
          <span key={state} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-1.5 w-5 rounded-full"
              style={{ backgroundColor: STROKE[state] }}
            />
            {t(`telemetry.state.${state}`)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

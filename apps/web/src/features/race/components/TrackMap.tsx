import type { Schema } from "@stintline/api-types";
import { useId } from "react";

import { useElementWidth } from "@/lib/useElementWidth";

export interface CarMarker {
  carNumber: number;
  code: string;
  name: string;
  colour: string;
  x: number;
  y: number;
  showLabel: boolean;
  selected: boolean;
  dimmed: boolean;
}

export interface Ghost {
  code: string;
  x: number;
  y: number;
  /** Uncertainty along the track, as a polyline. */
  zone: [number, number][];
}

interface TrackMapProps {
  track: Schema<"Track">;
  cars: readonly CarMarker[];
  ghost: Ghost | null;
  title: string;
  /** Circuit colour lighting the racing line; race red by default. */
  accent?: string;
  onSelect: (carNumber: number) => void;
}

const CAR_RADIUS = 12;
const LABEL_SIZE = 20;
/** Below this rendered width (px), markers and labels grow so they stay readable. */
const COMFORT_WIDTH = 760;
const MAX_MARKER_SCALE = 2;
/** Tarmac width in outline units: the outline spans about 1,000 units. */
const TARMAC = 26;

/**
 * The circuit as on a timing screen at night: dark tarmac, the racing line lit in the
 * circuit colour, the start line, and every car in its team colour. Cars are buttons:
 * click or Enter selects one.
 */
export function TrackMap({
  track,
  cars,
  ghost,
  title,
  accent = "var(--color-mark)",
  onSelect,
}: TrackMapProps) {
  const titleId = useId();
  const glowId = useId();
  const [ref, width] = useElementWidth<HTMLDivElement>(COMFORT_WIDTH);
  const k = Math.min(Math.max(COMFORT_WIDTH / width, 1), MAX_MARKER_SCALE);
  const r = CAR_RADIUS * k;
  const fontSize = LABEL_SIZE * k;
  const path = `M${track.points.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;
  const [a = [0, 0], b = [0, 0]] = [track.points[0], track.points[3]];
  const [ax = 0, ay = 0] = a;
  const [bx = 0, by = 0] = b;
  const length = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (-(by - ay) / length) * (TARMAC / 2 + 4);
  const ny = ((bx - ax) / length) * (TARMAC / 2 + 4);

  return (
    <div ref={ref} className="min-w-0">
      <svg
        viewBox={`-30 -30 ${track.width + 60} ${track.height + 60}`}
        role="group"
        aria-labelledby={titleId}
        className="mx-auto block h-auto max-h-[calc(100vh-26rem)] min-h-64 w-full overflow-visible"
      >
        <title id={titleId}>{title}</title>
        <defs>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>
        <g aria-hidden="true">
          <path
            d={path}
            fill="none"
            stroke="black"
            strokeOpacity={0.55}
            strokeWidth={TARMAC + 18}
            strokeLinejoin="round"
            transform="translate(0 10)"
            filter={`url(#${glowId})`}
          />
          <path
            d={path}
            fill="none"
            stroke={accent}
            strokeOpacity={0.35}
            strokeWidth={TARMAC + 10}
            strokeLinejoin="round"
            filter={`url(#${glowId})`}
          />
          <path
            d={path}
            fill="none"
            stroke="var(--color-track-edge)"
            strokeWidth={TARMAC + 4}
            strokeLinejoin="round"
          />
          <path
            d={path}
            fill="none"
            stroke="var(--color-track)"
            strokeWidth={TARMAC}
            strokeLinejoin="round"
          />
          <path
            d={path}
            fill="none"
            stroke={accent}
            strokeOpacity={0.85}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <line
            x1={ax + nx}
            y1={ay + ny}
            x2={ax - nx}
            y2={ay - ny}
            stroke="var(--color-ink)"
            strokeWidth={5}
            strokeDasharray="5 5"
          />
        </g>
        {ghost && ghost.zone.length > 1 && (
          <path
            d={`M${ghost.zone.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`}
            fill="none"
            stroke="var(--color-zone)"
            strokeWidth={TARMAC + 16}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          />
        )}
        {cars.map((car) => (
          <g
            key={car.carNumber}
            transform={`translate(${car.x.toFixed(1)} ${car.y.toFixed(1)})`}
            role="button"
            tabIndex={0}
            aria-label={car.name}
            aria-pressed={car.selected}
            onClick={() => {
              onSelect(car.carNumber);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(car.carNumber);
              }
            }}
            className="cursor-pointer outline-none [&:focus-visible>circle:last-of-type]:stroke-mark"
            opacity={car.dimmed ? 0.35 : 1}
          >
            {car.selected && (
              <circle
                r={r * 2}
                fill={car.colour}
                fillOpacity={0.25}
                className="car-halo"
                pointerEvents="none"
                aria-hidden="true"
              />
            )}
            <circle
              r={r}
              fill={car.colour}
              stroke={car.selected ? "var(--color-ink)" : "var(--color-bg)"}
              strokeWidth={car.selected ? 4 : 3}
            />
            {car.showLabel && (
              <text
                x={r + 6}
                y={fontSize / 3}
                className="timing fill-ink font-bold"
                pointerEvents="none"
                fontSize={fontSize}
                paintOrder="stroke"
                stroke="var(--color-bg)"
                strokeWidth={6}
              >
                {car.code}
              </text>
            )}
          </g>
        ))}
        {ghost && (
          <g
            transform={`translate(${ghost.x.toFixed(1)} ${ghost.y.toFixed(1)})`}
            aria-hidden="true"
          >
            <circle
              r={r + 3}
              fill="none"
              stroke="var(--color-ghost)"
              strokeWidth={4}
              strokeDasharray="6 5"
            />
            <text
              x={r + 9}
              y={fontSize / 3}
              className="timing fill-ghost font-bold"
              fontSize={fontSize}
              paintOrder="stroke"
              stroke="var(--color-bg)"
              strokeWidth={6}
            >
              {ghost.code}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

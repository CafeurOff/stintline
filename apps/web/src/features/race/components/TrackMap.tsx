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
  onSelect: (carNumber: number) => void;
}

const CAR_RADIUS = 13;
const LABEL_SIZE = 22;
/** Below this rendered width (px), markers and labels grow so they stay readable. */
const COMFORT_WIDTH = 760;
const MAX_MARKER_SCALE = 2;

/** The circuit with every car on it. Cars are buttons: click or Enter selects one. */
export function TrackMap({ track, cars, ghost, title, onSelect }: TrackMapProps) {
  const titleId = useId();
  const [ref, width] = useElementWidth<HTMLDivElement>(COMFORT_WIDTH);
  const k = Math.min(Math.max(COMFORT_WIDTH / width, 1), MAX_MARKER_SCALE);
  const r = CAR_RADIUS * k;
  const fontSize = LABEL_SIZE * k;
  const path = `M${track.points.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;
  const [a = [0, 0], b = [0, 0]] = [track.points[0], track.points[3]];
  const [ax = 0, ay = 0] = a;
  const [bx = 0, by = 0] = b;
  const length = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (-(by - ay) / length) * 17;
  const ny = ((bx - ax) / length) * 17;

  return (
    <div ref={ref} className="min-w-0">
      <svg
        viewBox={`0 0 ${track.width} ${track.height}`}
        role="group"
        aria-labelledby={titleId}
        className="block h-auto max-h-[calc(100vh-11rem)] w-full"
      >
        <title id={titleId}>{title}</title>
        <path
          d={path}
          fill="none"
          stroke="var(--color-track-edge)"
          strokeWidth={30}
          strokeLinejoin="round"
        />
        <path
          d={path}
          fill="none"
          stroke="var(--color-track)"
          strokeWidth={24}
          strokeLinejoin="round"
        />
        <line
          x1={ax + nx}
          y1={ay + ny}
          x2={ax - nx}
          y2={ay - ny}
          stroke="var(--color-ink)"
          strokeWidth={4}
          aria-hidden="true"
        />
        {ghost && ghost.zone.length > 1 && (
          <path
            d={`M${ghost.zone.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`}
            fill="none"
            stroke="var(--color-zone)"
            strokeWidth={40}
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
            className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-mark"
            opacity={car.dimmed ? 0.35 : 1}
          >
            <circle
              r={r}
              fill={car.colour}
              stroke={car.selected ? "var(--color-ink)" : "var(--color-bg)"}
              strokeWidth={car.selected ? 4 : 3}
            />
            {car.showLabel && (
              <text
                x={r + 5}
                y={fontSize / 3}
                className="fill-ink font-bold"
                fontSize={fontSize}
                paintOrder="stroke"
                stroke="var(--color-bg)"
                strokeWidth={5}
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
              className="fill-ghost font-bold"
              fontSize={fontSize}
              paintOrder="stroke"
              stroke="var(--color-bg)"
              strokeWidth={5}
            >
              {ghost.code}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

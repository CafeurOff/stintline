import type { Schema } from "@stintline/api-types";
import { Arc } from "@visx/shape";

import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import type { LiveSnapshot } from "../buffer";
import { raceGaps, referenceLap, ringAngle, running } from "../ring";

type Car = Schema<"LiveCar">;

const SIZE = 240;
const RADIUS = 92;
const BAND = 14;
/** Codes are written next to the leader, the selected car and the cars around its rejoin. */
const LABEL_OFFSET = 22;

function point(angle: number, radius: number): [number, number] {
  return [Math.sin(angle) * radius, -Math.cos(angle) * radius];
}

/**
 * Every running car around one lap, placed by its gap to the leader, and the window where
 * the selected car would rejoin if it pitted now: its gap plus the circuit's pit loss,
 * give or take one standard deviation (the same pit-exit model as the "pit now" panel).
 */
export function GapRing({ snapshot, selected }: { snapshot: LiveSnapshot; selected: Car }) {
  const { t, f } = useI18n();
  const cars = running(snapshot.cars);
  const gaps = raceGaps(snapshot.cars);
  const lap = referenceLap(snapshot.cars);
  const loss = snapshot.pit_loss_s;
  const sigma = snapshot.pit_loss_sigma_s ?? 0;
  const mine = gaps.get(selected.number);
  const rejoin = loss != null && mine != null && !selected.in_pit ? mine + loss : null;
  const named = new Set<number>([selected.number]);
  if (cars[0]) named.add(cars[0].number);
  const stop = selected.pit_now;
  if (stop?.ahead != null) named.add(stop.ahead);
  if (stop?.behind != null) named.add(stop.behind);

  return (
    <section aria-labelledby="live-ring" className="glass flex flex-col gap-2 rounded-[20px] p-5">
      <h2 id="live-ring" className="text-lg leading-tight font-bold">
        {t("live.ring.title")}
      </h2>
      <svg
        viewBox={`${String(-SIZE / 2)} ${String(-SIZE / 2)} ${String(SIZE)} ${String(SIZE)}`}
        role="img"
        aria-label={t("live.ring.label", { lap: f.lapTime(lap) })}
        className="mx-auto w-full max-w-64"
      >
        <circle r={RADIUS} fill="none" stroke="var(--color-track)" strokeWidth={BAND} />
        {rejoin != null && (
          <Arc
            innerRadius={RADIUS - BAND / 2 - 3}
            outerRadius={RADIUS + BAND / 2 + 3}
            startAngle={ringAngle(rejoin + sigma, lap)}
            endAngle={ringAngle(Math.max(rejoin - sigma, 0), lap)}
            fill="var(--color-zone)"
            stroke="var(--color-ghost)"
            strokeDasharray="3 3"
          />
        )}
        <line
          x1={0}
          x2={0}
          y1={-RADIUS - BAND}
          y2={-RADIUS + BAND}
          stroke="var(--color-ink)"
          strokeWidth={2}
        />
        {[...cars].reverse().map((car) => {
          const angle = ringAngle(gaps.get(car.number) ?? 0, lap);
          const [x, y] = point(angle, RADIUS);
          const [lx, ly] = point(angle, RADIUS - LABEL_OFFSET);
          const isSelected = car.number === selected.number;
          return (
            <g key={car.number} opacity={car.in_pit ? 0.4 : 1}>
              <circle
                cx={x}
                cy={y}
                r={isSelected ? 7 : 5}
                fill={teamColour(car.colour)}
                stroke={isSelected ? "var(--color-ink)" : "var(--color-panel)"}
                strokeWidth={2}
              />
              {named.has(car.number) && (
                <text
                  x={lx}
                  y={ly}
                  dy="0.35em"
                  textAnchor="middle"
                  className="num fill-ink text-[10px] font-semibold"
                >
                  {car.code}
                </text>
              )}
            </g>
          );
        })}
        {rejoin != null && (
          <circle
            cx={point(ringAngle(rejoin, lap), RADIUS)[0]}
            cy={point(ringAngle(rejoin, lap), RADIUS)[1]}
            r={6}
            fill="none"
            stroke="var(--color-ghost)"
            strokeWidth={2}
          />
        )}
      </svg>
      <p className="text-sm text-muted">
        {rejoin != null && loss != null
          ? t("live.ring.window", {
              code: selected.code,
              loss: f.seconds(loss, 0),
              sigma: f.seconds(sigma, 1),
            })
          : t("live.ring.noWindow")}
      </p>
    </section>
  );
}

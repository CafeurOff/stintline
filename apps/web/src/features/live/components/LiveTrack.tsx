import type { Schema } from "@stintline/api-types";
import { useEffect, useRef, useState } from "react";

import { type CarMarker, type Ghost, TrackMap } from "@/features/race/components/TrackMap";
import { pointAt } from "@/features/race/replay";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import { advance, type Motion, type Observation, observe } from "../motion";
import { FALLBACK_LAP_S } from "../ring";

type Car = Schema<"LiveCar">;

/** Longest step the animation takes at once (a background tab resumes in one step). */
const MAX_FRAME_S = 0.25;
/** Frames drawn per second at most: smooth enough for dots, light on phones. */
const FRAME_MS = 1000 / 30;

interface LiveTrackProps {
  track: Schema<"Track">;
  cars: readonly Car[];
  /** Page clock (ms) when the shown snapshot arrived. */
  receivedAt: number;
  /** TV delay in ms: the map runs that far behind the page clock. */
  delayMs: number;
  selected: number | null;
  pitLossS: number | null;
  pitLossSigmaS: number | null;
  /** After the flag, cars stay where they are. */
  still: boolean;
  title: string;
  onSelect: (car: number) => void;
}

function onTrack(car: Car): boolean {
  return !car.retired && !car.stopped && !car.in_pit;
}

function observation(car: Car, receivedAt: number, still: boolean): Observation {
  const lap = car.last_lap_s ?? car.best_lap_s ?? FALLBACK_LAP_S;
  return {
    fraction: car.lap_progress,
    at: receivedAt - (car.progress_age_s ?? 0) * 1000,
    rate: still ? 0 : (car.lap_rate ?? 1 / lap),
  };
}

function shownOf(motions: ReadonlyMap<number, Motion>): Map<number, number> {
  return new Map([...motions].map(([car, motion]) => [car, motion.shown]));
}

/**
 * The circuit with every car on track, moving smoothly between timing loops (see
 * `motion.ts`). Cars in the pits are listed under the map: the feed does not say where
 * they are in the pit lane.
 */
export function LiveTrack({
  track,
  cars,
  receivedAt,
  delayMs,
  selected,
  pitLossS,
  pitLossSigmaS,
  still,
  title,
  onSelect,
}: LiveTrackProps) {
  const { t } = useI18n();
  const motions = useRef(new Map<number, Motion>());
  const delay = useRef(delayMs);
  const [shown, setShown] = useState<Map<number, number>>(() => new Map());

  useEffect(() => {
    delay.current = delayMs;
    const now = Date.now() - delayMs;
    const next = new Map<number, Motion>();
    for (const car of cars) {
      if (!onTrack(car)) continue;
      next.set(
        car.number,
        observe(motions.current.get(car.number), observation(car, receivedAt, still), now),
      );
    }
    // Drawn on the next frame of the loop below.
    motions.current = next;
  }, [cars, receivedAt, delayMs, still]);

  useEffect(() => {
    let last = Date.now();
    let first = true;
    let handle = 0;
    const schedule =
      typeof requestAnimationFrame === "function"
        ? (step: () => void) => requestAnimationFrame(step)
        : (step: () => void) => window.setTimeout(step, FRAME_MS);
    const cancel =
      typeof cancelAnimationFrame === "function"
        ? (id: number) => {
            cancelAnimationFrame(id);
          }
        : (id: number) => {
            window.clearTimeout(id);
          };
    const step = () => {
      const now = Date.now();
      // The first frame draws at once: cars appear where they are, then move.
      if (now - last >= FRAME_MS || first) {
        first = false;
        const dtS = Math.min((now - last) / 1000, MAX_FRAME_S);
        last = now;
        const clock = now - delay.current;
        const next = new Map<number, Motion>();
        for (const [car, motion] of motions.current) next.set(car, advance(motion, clock, dtS));
        motions.current = next;
        setShown(shownOf(next));
      }
      handle = schedule(step);
    };
    handle = schedule(step);
    return () => {
      cancel(handle);
    };
  }, []);

  const points = track.points;
  const markers: CarMarker[] = [];
  // Leader drawn last, on top.
  for (const car of [...cars].reverse()) {
    const fraction = shown.get(car.number);
    if (fraction === undefined || !onTrack(car)) continue;
    const [x, y] = pointAt(points, fraction);
    markers.push({
      carNumber: car.number,
      code: car.code,
      name: `${car.first_name} ${car.last_name}`,
      colour: teamColour(car.colour),
      x,
      y,
      showLabel: car.number === selected || (car.position ?? 99) <= 3,
      selected: car.number === selected,
      dimmed: false,
    });
  }

  let ghost: Ghost | null = null;
  const chosen = cars.find((c) => c.number === selected);
  const at = chosen ? shown.get(chosen.number) : undefined;
  if (chosen && at !== undefined && pitLossS != null && !still) {
    const lap = chosen.lap_rate ? 1 / chosen.lap_rate : (chosen.last_lap_s ?? FALLBACK_LAP_S);
    const rejoin = at - pitLossS / lap;
    const sigma = (pitLossSigmaS ?? 0) / lap;
    const [x, y] = pointAt(points, rejoin);
    ghost = {
      code: chosen.code,
      x,
      y,
      zone: [-1, -0.5, 0, 0.5, 1].map((k) => pointAt(points, rejoin + k * sigma)),
    };
  }

  const inPit = cars.filter((c) => c.in_pit && !c.retired);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <TrackMap
        track={track}
        cars={markers}
        ghost={ghost}
        title={title}
        sizeClassName="max-h-[min(36rem,calc(100vh-16rem))] min-h-64"
        onSelect={onSelect}
      />
      {inPit.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-muted">{t("live.inPitList")}</span>
          {inPit.map((car) => (
            <button
              key={car.number}
              type="button"
              onClick={() => {
                onSelect(car.number);
              }}
              className="timing flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 font-bold hover:border-ink"
            >
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ backgroundColor: teamColour(car.colour) }}
              />
              {car.code}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

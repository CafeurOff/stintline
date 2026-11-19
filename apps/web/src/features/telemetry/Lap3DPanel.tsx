import type { Schema } from "@stintline/api-types";
import { Pause, Play } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n/context";

import type { CarStyle } from "./colours";
import type { CameraMode } from "./Lap3DScene";
import {
  gapsAt,
  indexAtTime,
  lapEnd,
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
  playWindow,
  ReplayClock,
  valueAt,
} from "./playback";
import { ELEVATION_EXAGGERATION, trackElevation } from "./track3d";

type Compare = Schema<"TelemetryCompare">;

const Lap3DScene = lazy(() => import("./Lap3DScene"));
const CAMERAS: readonly CameraMode[] = ["chase", "top", "trackside"];
/** The readout and the 2D charts follow the replay this often (ms): enough to read, light. */
const HUD_EVERY_MS = 120;

interface Lap3DPanelProps {
  data: Compare;
  styles: readonly CarStyle[];
  /** Shared pointer with the 2D charts (grid index of the first car). */
  cursor: number | null;
  onCursor: (index: number | null) => void;
  /** Grid indexes of the zoomed part, or the whole lap. */
  visible: [number, number];
}

function signedMetres(value: number, format: (v: number, digits?: number) => string): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "±";
  return `${sign}${format(Math.abs(rounded), 0)}`;
}

function background(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--color-panel");
  return value.trim() || "#10141c";
}

/**
 * The fastest laps replayed in 3D on the real relief, every car at its own pace. The
 * replay drives the pointer of the 2D charts, and pointing the charts while paused moves
 * the cars there. A zoomed part of the lap plays in a loop.
 */
export function Lap3DPanel({ data, styles, cursor, onCursor, visible }: Lap3DPanelProps) {
  const { t, f } = useI18n();
  const [reference] = data.cars;
  const window = reference ? playWindow(reference, visible[0], visible[1]) : { start: 0, end: 0 };
  const [clock] = useState(() => new ReplayClock(window));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [camera, setCamera] = useState<CameraMode>("chase");
  const [follow, setFollow] = useState(0);
  /** Clock read while playing. */
  const [played, setPlayed] = useState(window.start);
  /** Exact time picked on the slider (the shared pointer only has 10 m steps). */
  const [scrubbed, setScrubbed] = useState<number | null>(null);
  const { start, end } = window;

  useEffect(() => {
    clock.configure(playing, speed, { start, end });
  }, [clock, playing, speed, start, end]);

  // While playing, read the clock a few times a second for the readout and the charts.
  useEffect(() => {
    if (!playing || !reference) return;
    const timer = setInterval(() => {
      setPlayed(clock.time);
      onCursor(Math.round(indexAtTime(reference.t_s, clock.time)));
    }, HUD_EVERY_MS);
    return () => {
      clearInterval(timer);
    };
  }, [clock, playing, reference, onCursor]);

  // Paused: the shared pointer (the charts or the slider) says where the cars are.
  const atCursor =
    cursor === null || !reference
      ? played
      : scrubbed !== null && Math.round(indexAtTime(reference.t_s, scrubbed)) === cursor
        ? scrubbed
        : (reference.t_s[cursor] ?? played);
  const time = Math.min(Math.max(playing ? played : atCursor, start), end);
  useEffect(() => {
    if (!playing) clock.seek(time);
  }, [clock, playing, time]);

  if (!reference) return null;
  const scrub = (value: number) => {
    setScrubbed(value);
    setPlayed(value);
    onCursor(Math.round(indexAtTime(reference.t_s, value)));
  };
  const gaps = gapsAt(data.cars, time, data.step_m);
  const flat = trackElevation(data) === null;

  return (
    <section className="flex flex-col gap-3" aria-label={t("telemetry.3d.title")}>
      <div className="relative h-[420px] overflow-hidden rounded-xl bg-panel sm:h-[520px]">
        <Suspense fallback={<Skeleton className="h-full" />}>
          <Lap3DScene
            data={data}
            styles={styles}
            clock={clock}
            camera={camera}
            follow={follow}
            background={background()}
            label={t("telemetry.3d.label", { name: reference.entry.driver.family_name })}
          />
        </Suspense>
        <p className="pointer-events-none absolute top-2 right-3 rounded bg-bg/70 px-2 py-0.5 text-xs text-muted">
          {flat ? t("telemetry.3d.flat") : t("telemetry.3d.relief", { n: ELEVATION_EXAGGERATION })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-panel p-3">
        <button
          type="button"
          onClick={() => {
            // Hand over the exact time both ways, so play and pause never jump.
            const now = playing ? clock.time : time;
            setPlayed(now);
            setScrubbed(now);
            if (playing) onCursor(Math.round(indexAtTime(reference.t_s, now)));
            setPlaying(!playing);
          }}
          className="flex items-center gap-1.5 rounded-md bg-action px-3 py-1.5 text-sm font-semibold text-white"
        >
          {playing ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
          {playing ? t("telemetry.3d.pause") : t("telemetry.3d.play")}
        </button>
        <div role="group" aria-label={t("telemetry.3d.speed")} className="flex gap-1">
          {PLAYBACK_SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={speed === value}
              onClick={() => {
                setSpeed(value);
              }}
              className="rounded-md border border-line px-2 py-1 text-sm font-semibold tabular-nums hover:border-ink aria-pressed:border-ink aria-pressed:bg-raised"
            >
              ×{f.number(value, value < 1 ? 2 : 0)}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t("telemetry.3d.camera")} className="flex gap-1">
          {CAMERAS.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={camera === mode}
              onClick={() => {
                setCamera(mode);
              }}
              className="rounded-md border border-line px-2 py-1 text-sm font-semibold hover:border-ink aria-pressed:border-ink aria-pressed:bg-raised"
            >
              {t(`telemetry.3d.cam.${mode}`)}
            </button>
          ))}
        </div>
        {data.cars.length > 1 && camera !== "top" && (
          <div role="group" aria-label={t("telemetry.3d.follow")} className="flex gap-1">
            {data.cars.map((car, index) => (
              <button
                key={car.car_number}
                type="button"
                aria-pressed={follow === index}
                onClick={() => {
                  setFollow(index);
                }}
                className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-sm font-semibold hover:border-ink aria-pressed:border-ink aria-pressed:bg-raised"
              >
                <span
                  aria-hidden="true"
                  className="h-3 w-1 rounded-full"
                  style={{ backgroundColor: styles[index]?.colour }}
                />
                {car.entry.driver.code}
              </button>
            ))}
          </div>
        )}
        <label className="flex min-w-48 flex-1 items-center gap-2 text-sm text-muted">
          {t("telemetry.3d.scrub")}
          <input
            type="range"
            min={window.start}
            max={window.end}
            step={0.05}
            value={time}
            aria-valuetext={f.lapTime(time)}
            onChange={(event) => {
              scrub(Number(event.target.value));
            }}
            className="flex-1 accent-(--color-mark)"
          />
          <span className="num w-20 text-right text-ink">{f.lapTime(time)}</span>
        </label>
      </div>
      <ul
        aria-live="off"
        aria-label={t("telemetry.3d.hud")}
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {data.cars.map((car, index) => {
          const at = indexAtTime(car.t_s, time);
          const gap = gaps[index];
          const done = time >= lapEnd(car);
          return (
            <li
              key={car.car_number}
              className="flex items-center justify-between gap-3 rounded-lg border-l-4 bg-panel px-3 py-2 text-sm tabular-nums"
              style={{ borderLeftColor: styles[index]?.colour }}
            >
              <span className="font-bold">{car.entry.driver.code}</span>
              <span>
                {t("telemetry.3d.car", {
                  speed: Math.round(valueAt(car.speed_kph, at)),
                  gear: car.gear[Math.round(at)] ?? 0,
                })}
              </span>
              <span className="text-muted">
                {index === 0 || !gap
                  ? done
                    ? t("telemetry.3d.finished")
                    : t("telemetry.3d.reference")
                  : t("telemetry.3d.gap", {
                      metres: signedMetres(gap.metres, f.number),
                      seconds: f.delta(gap.seconds, 2),
                    })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

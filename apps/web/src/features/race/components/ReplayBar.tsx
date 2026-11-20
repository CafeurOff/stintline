import type { Schema } from "@stintline/api-types";

import { Slider } from "@/components/ui/Slider";
import { useI18n } from "@/lib/i18n/context";

import { REPLAY_SPEEDS, type ReplaySpeed } from "../useReplayClock";

type Neutralisation = Schema<"Neutralisation">;

const TONE: Record<Neutralisation["status"], string> = {
  SC: "bg-caution",
  VSC: "bg-caution/55",
  RED: "bg-loss",
};

const LABEL = {
  SC: "live.track.safety_car",
  VSC: "live.track.virtual_safety_car",
  RED: "live.track.red",
} as const;

interface ReplayBarProps {
  lap: number;
  totalLaps: number;
  finished: boolean;
  playing: boolean;
  speed: ReplaySpeed;
  neutralisations: readonly Neutralisation[];
  /** In-laps of the followed driver, marked under the laps. */
  pitLaps: readonly number[];
  onToggle: () => void;
  onLap: (lap: number) => void;
  onSpeed: (speed: ReplaySpeed) => void;
}

/** Play, the lap, a strip of the race's flag periods and stops, the lap slider and speed. */
export function ReplayBar(props: ReplayBarProps) {
  const { t } = useI18n();
  const { lap, totalLaps, playing } = props;
  const share = (value: number) => `${String(((value - 1) / Math.max(totalLaps, 1)) * 100)}%`;
  const periods = props.neutralisations.filter((n) => n.lap_start != null);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={props.onToggle}
        aria-label={playing ? t("replay.pause") : t("replay.play")}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-bg transition hover:opacity-90"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="currentColor">
          {playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M5 3l8 5-8 5z" />}
        </svg>
      </button>
      <p className="timing shrink-0 text-2xl font-bold" aria-live="off">
        {props.finished ? t("replay.finished") : t("replay.lap", { lap })}
        <span className="font-normal text-muted"> / {totalLaps}</span>
      </p>
      <div className="order-last flex basis-full flex-col gap-1.5">
        <div aria-hidden="true" className="relative h-1.5 rounded-full bg-ink/10">
          {periods.map((period) => (
            <span
              key={`${period.status}-${String(period.lap_start)}`}
              className={`absolute inset-y-0 rounded-full ${TONE[period.status]}`}
              style={{
                left: share(period.lap_start ?? 1),
                width: share((period.lap_end ?? totalLaps) - (period.lap_start ?? 1) + 2),
              }}
            />
          ))}
          {props.pitLaps.map((inLap) => (
            <span
              key={inLap}
              className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-ink"
              style={{ left: share(inLap) }}
            />
          ))}
        </div>
        {(periods.length > 0 || props.pitLaps.length > 0) && (
          <p className="sr-only">
            {[
              ...periods.map((period) =>
                t("replay.period", {
                  flag: t(LABEL[period.status]),
                  from: period.lap_start ?? 1,
                  to: period.lap_end ?? totalLaps,
                }),
              ),
              ...(props.pitLaps.length > 0
                ? [t("replay.stops", { laps: props.pitLaps.join(", ") })]
                : []),
            ].join(". ")}
          </p>
        )}
        <Slider
          label={t("replay.slider")}
          hideLabel
          min={1}
          max={totalLaps}
          value={lap}
          onChange={props.onLap}
          valueText={(value) => t("replay.sliderValue", { lap: value, total: totalLaps })}
        />
      </div>
      <div
        role="group"
        aria-label={t("replay.speed")}
        className="ml-auto flex shrink-0 gap-1 rounded-xl border border-line bg-bg/60 p-1"
      >
        {REPLAY_SPEEDS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={value === props.speed}
            onClick={() => {
              props.onSpeed(value);
            }}
            className="timing rounded-lg px-2.5 py-1 text-xs font-bold text-muted aria-pressed:bg-ink aria-pressed:text-bg"
          >
            ×{value}
          </button>
        ))}
      </div>
    </div>
  );
}

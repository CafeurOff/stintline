import { Slider } from "@/components/ui/Slider";
import { REPLAY_SPEEDS, type ReplaySpeed } from "@/features/race/useReplayClock";
import { useI18n } from "@/lib/i18n/context";

import { clockLabel, type Timeline } from "../timeline";

const TONE = { SC: "bg-caution", VSC: "bg-caution/55", RED: "bg-loss" } as const;
const FLAG = {
  SC: "live.track.safety_car",
  VSC: "live.track.virtual_safety_car",
  RED: "live.track.red",
} as const;

interface SessionBarProps {
  time: number;
  timeline: Timeline;
  playing: boolean;
  speed: ReplaySpeed;
  segmentName: (n: number) => string;
  /** Laps of the followed driver, drawn as ticks under the strip. */
  laps: readonly { start_s: number }[];
  onToggle: () => void;
  onTime: (seconds: number) => void;
  onSpeed: (speed: ReplaySpeed) => void;
}

/**
 * Play, the session clock, a strip of the qualifying segments and flag periods, the time
 * slider (one step a second) and the speed.
 */
export function SessionBar(props: SessionBarProps) {
  const { t } = useI18n();
  const { timeline, playing } = props;
  const total = Math.max(timeline.duration_s, 1);
  const share = (seconds: number) => `${String((Math.max(seconds, 0) / total) * 100)}%`;
  const summary = [
    ...(timeline.segments.length > 0
      ? [
          t("sreplay.segments", {
            list: timeline.segments
              .map(
                (s) =>
                  `${props.segmentName(s.number)} ${clockLabel(s.start_s)}–${clockLabel(s.end_s)}`,
              )
              .join(", "),
          }),
        ]
      : []),
    ...timeline.flags.map((flag) =>
      t("sreplay.flagPeriod", {
        flag: t(FLAG[flag.status]),
        from: clockLabel(flag.start_s),
        to: clockLabel(flag.end_s ?? total),
      }),
    ),
  ];

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
        <span className="sr-only">{t("sreplay.clock")} </span>
        {clockLabel(props.time)}
        <span className="font-normal text-muted"> / {clockLabel(total)}</span>
      </p>
      <div className="order-last flex basis-full flex-col gap-1.5">
        <div aria-hidden="true" className="relative h-4">
          {timeline.segments.map((segment) => (
            <span
              key={segment.number}
              className="absolute inset-y-0 flex items-center rounded-md bg-ink/10 px-1.5 text-[10px] font-bold text-muted"
              style={{
                left: share(segment.start_s),
                width: share(segment.end_s - segment.start_s),
              }}
            >
              {props.segmentName(segment.number)}
            </span>
          ))}
          {timeline.flags.map((flag) => (
            <span
              key={`${flag.status}-${String(flag.start_s)}`}
              className={`absolute bottom-0 h-1.5 rounded-full ${TONE[flag.status]}`}
              style={{
                left: share(flag.start_s),
                width: share((flag.end_s ?? total) - flag.start_s),
              }}
            />
          ))}
          {props.laps.map((lap) => (
            <span
              key={lap.start_s}
              className="absolute -bottom-1 h-1.5 w-px bg-ink/60"
              style={{ left: share(lap.start_s) }}
            />
          ))}
        </div>
        {summary.length > 0 && <p className="sr-only">{summary.join(". ")}</p>}
        <Slider
          label={t("sreplay.slider")}
          hideLabel
          min={0}
          max={Math.ceil(total)}
          value={Math.round(props.time)}
          onChange={props.onTime}
          valueText={(value) =>
            t("sreplay.sliderValue", { clock: clockLabel(value), total: clockLabel(total) })
          }
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

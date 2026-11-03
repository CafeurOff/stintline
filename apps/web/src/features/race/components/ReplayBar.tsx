import { Slider } from "@/components/ui/Slider";
import { useI18n } from "@/lib/i18n/context";

import { REPLAY_SPEEDS, type ReplaySpeed } from "../useReplayClock";

interface ReplayBarProps {
  lap: number;
  totalLaps: number;
  finished: boolean;
  playing: boolean;
  speed: ReplaySpeed;
  onToggle: () => void;
  onLap: (lap: number) => void;
  onSpeed: (speed: ReplaySpeed) => void;
}

export function ReplayBar(props: ReplayBarProps) {
  const { t } = useI18n();
  const { lap, totalLaps, playing } = props;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={props.onToggle}
        aria-label={playing ? t("replay.pause") : t("replay.play")}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-panel"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="currentColor">
          {playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M5 3l8 5-8 5z" />}
        </svg>
      </button>
      <p className="tabular shrink-0 text-xl font-bold" aria-live="off">
        {props.finished ? t("replay.finished") : t("replay.lap", { lap })}
        <span className="font-normal text-muted"> / {totalLaps}</span>
      </p>
      <div className="order-last flex basis-full sm:order-none sm:grow sm:basis-0">
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
      <div role="group" aria-label={t("replay.speed")} className="ml-auto flex shrink-0 sm:ml-0">
        {REPLAY_SPEEDS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={value === props.speed}
            onClick={() => {
              props.onSpeed(value);
            }}
            className="tabular rounded-md px-2 py-1 text-muted aria-pressed:font-bold aria-pressed:text-ink"
          >
            ×{value}
          </button>
        ))}
      </div>
    </div>
  );
}

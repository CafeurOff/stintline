import { Pause, Play } from "lucide-react";

import { clipTime, type RadioPlayback } from "../useRadioPlayer";

/** Round play / pause button of one clip, with a thin progress line under its row while
 * it plays. `label` names the clip for screen readers (driver and time). */
export function RadioPlayButton({
  url,
  label,
  pauseLabel,
  playback,
  onToggle,
}: {
  url: string;
  label: string;
  pauseLabel: string;
  playback: RadioPlayback;
  onToggle: (url: string) => void;
}) {
  const active = playback.url === url;
  const playing = active && playback.playing;
  return (
    <button
      type="button"
      onClick={() => {
        onToggle(url);
      }}
      aria-label={playing ? pauseLabel : label}
      aria-pressed={playing}
      className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors [&>svg]:size-4 ${
        playing ? "bg-mark text-white" : "border border-line-strong hover:border-ink"
      }`}
    >
      {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" className="ml-0.5" />}
    </button>
  );
}

/** Elapsed time and a progress line in the team colour, for the clip being played. */
export function RadioProgress({ playback, colour }: { playback: RadioPlayback; colour: string }) {
  const share = playback.duration > 0 ? Math.min(playback.time / playback.duration, 1) : 0;
  return (
    <div className="flex items-center gap-2">
      <div aria-hidden="true" className="h-1 flex-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${String(share * 100)}%`, backgroundColor: colour }}
        />
      </div>
      <span className="num text-xs text-muted">
        {clipTime(playback.time)}
        {playback.duration > 0 && ` / ${clipTime(playback.duration)}`}
      </span>
    </div>
  );
}

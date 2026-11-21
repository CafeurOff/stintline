import { useCallback, useEffect, useRef, useState } from "react";

export interface RadioPlayback {
  /** The clip loaded in the player, or `null` before the first one. */
  url: string | null;
  playing: boolean;
  /** Seconds played and clip length (0 until the browser knows it). */
  time: number;
  duration: number;
}

const IDLE: RadioPlayback = { url: null, playing: false, time: 0, duration: 0 };

/**
 * One player for a list of team radio clips: starting a clip stops the previous one. The
 * audio stays on the official server (ADR 0029); nothing is fetched until play is pressed.
 */
export function useRadioPlayer() {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<RadioPlayback>(IDLE);

  useEffect(
    () => () => {
      ref.current?.pause();
    },
    [],
  );

  const element = useCallback((): HTMLAudioElement => {
    if (ref.current) return ref.current;
    const audio = new Audio();
    audio.preload = "none";
    const sync = () => {
      setState((s) => ({
        ...s,
        playing: !audio.paused && !audio.ended,
        time: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      }));
    };
    for (const event of ["play", "pause", "timeupdate", "durationchange", "ended", "error"]) {
      audio.addEventListener(event, sync);
    }
    ref.current = audio;
    return audio;
  }, []);

  const toggle = useCallback(
    (url: string) => {
      const audio = element();
      if (state.url === url && state.playing) {
        audio.pause();
        return;
      }
      if (state.url !== url) {
        audio.src = url;
        setState({ url, playing: false, time: 0, duration: 0 });
      }
      // Browsers reject play() when the clip cannot load: show it as stopped.
      Promise.resolve(audio.play()).catch(() => {
        setState((s) => ({ ...s, playing: false }));
      });
    },
    [element, state.url, state.playing],
  );

  return { ...state, toggle };
}

/** `0:07`, `1:12`. */
export function clipTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, "0")}`;
}

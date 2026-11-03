import { useCallback, useEffect, useRef, useState } from "react";

/** Replay speeds offered to the user (race seconds per real second). */
export const REPLAY_SPEEDS = [1, 10, 30] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

/** Motion starts only when the user has not asked for reduced motion (and the
 * environment can tell us: without `matchMedia`, e.g. in tests, the replay starts paused). */
function motionAllowed(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Race clock driven by requestAnimationFrame. Stops by itself at `end`. */
export function useReplayClock(start: number, end: number) {
  const [time, setTimeState] = useState(start);
  const [playing, setPlaying] = useState(motionAllowed);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const elapsed = (now - last) / 1000;
      last = now;
      setTimeState((t) => {
        const next = t + elapsed * speedRef.current;
        if (next >= end) {
          setPlaying(false);
          return end;
        }
        return next;
      });
      frame = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [playing, end]);

  const setTime = useCallback(
    (next: number) => {
      setTimeState(Math.min(Math.max(next, 0), end));
    },
    [end],
  );

  return {
    time,
    playing,
    speed,
    setTime,
    setSpeed,
    play: useCallback(() => {
      setPlaying(true);
    }, []),
    pause: useCallback(() => {
      setPlaying(false);
    }, []),
  };
}

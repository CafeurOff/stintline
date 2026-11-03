import { useEffect, useRef, useState } from "react";

/**
 * Tracks the content width of an element with ResizeObserver. Falls back to `fallback`
 * where the element cannot be measured (jsdom, first paint).
 */
export function useElementWidth<T extends HTMLElement>(fallback = 720) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const measured = Math.floor(entry?.contentRect.width ?? 0);
      if (measured > 0) setWidth(measured);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, width] as const;
}

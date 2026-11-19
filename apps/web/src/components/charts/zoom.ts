import { useState } from "react";

export type Range = readonly [number, number];

export interface Domain {
  x: Range;
  y: Range;
}

/** Narrowest view the buttons zoom to, as a share of the full range. */
const MIN_SHARE = 0.02;
/** One click on "+" or "−" scales the view by this factor. */
export const ZOOM_STEP = 1.6;

function clampRange([a, b]: Range, [lo, hi]: Range): Range {
  const width = Math.min(b - a, hi - lo);
  const start = Math.min(Math.max(a, lo), hi - width);
  return [start, start + width];
}

/** A view scaled by `factor` around its centre (below 1 zooms in), kept inside `full`. */
export function scaleView(view: Domain, full: Domain, factor: number): Domain {
  const scale = (range: Range, limit: Range): Range => {
    const centre = (range[0] + range[1]) / 2;
    const fullWidth = limit[1] - limit[0];
    const half = Math.max(((range[1] - range[0]) * factor) / 2, (fullWidth * MIN_SHARE) / 2);
    return clampRange([centre - half, centre + half], limit);
  };
  return { x: scale(view.x, full.x), y: scale(view.y, full.y) };
}

/** True when `view` shows the whole of `full` again (zoomed all the way out). */
export function isFull(view: Domain, full: Domain): boolean {
  return (
    view.x[0] <= full.x[0] &&
    view.x[1] >= full.x[1] &&
    view.y[0] <= full.y[0] &&
    view.y[1] >= full.y[1]
  );
}

/**
 * The visible part of a chart: the full domain until the reader zooms. A new `dataKey`
 * (other drivers, other race) shows everything again.
 */
export function useZoom(full: Domain, dataKey: string) {
  const [state, setState] = useState<{ key: string; view: Domain } | null>(null);
  const zoom = state?.key === dataKey ? state.view : null;
  const view = zoom ?? full;
  const set = (next: Domain | null) => {
    setState(next && !isFull(next, full) ? { key: dataKey, view: next } : null);
  };
  return {
    view,
    zoomed: zoom !== null,
    zoomTo: (next: Domain) => {
      set(next);
    },
    zoomIn: () => {
      set(scaleView(view, full, 1 / ZOOM_STEP));
    },
    zoomOut: () => {
      set(scaleView(view, full, ZOOM_STEP));
    },
    reset: () => {
      set(null);
    },
  };
}

export type Zoom = ReturnType<typeof useZoom>;

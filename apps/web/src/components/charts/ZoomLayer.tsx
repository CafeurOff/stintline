import { type PointerEvent, useState } from "react";

import type { Range } from "./zoom";

/** A drag shorter than this (pixels) on both axes is a click, not a zoom. */
const MIN_DRAG = 8;

interface Point {
  x: number;
  y: number;
}

interface LinearScale {
  invert: (value: number) => number;
}

/**
 * Transparent surface over the plot area of a chart: drag a box to zoom into it (a flat
 * horizontal drag zooms the x axis only, a tall one the y axis only), double-click to see
 * everything again, hover to read values, click to pick.
 */
export function ZoomLayer({
  width,
  height,
  x,
  y,
  onZoom,
  onReset,
  onHover,
  onLeave,
  onPick,
}: {
  width: number;
  height: number;
  x: LinearScale;
  y: LinearScale;
  onZoom: (next: { x: Range | null; y: Range | null }) => void;
  onReset: () => void;
  onHover?: (point: Point) => void;
  onLeave?: () => void;
  onPick?: (point: Point) => void;
}) {
  const [drag, setDrag] = useState<{ from: Point; to: Point } | null>(null);

  const local = (event: PointerEvent<SVGRectElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(Math.max(event.clientX - box.left, 0), width),
      y: Math.min(Math.max(event.clientY - box.top, 0), height),
    };
  };

  const finish = (to: Point) => {
    if (!drag) return;
    const dx = Math.abs(to.x - drag.from.x);
    const dy = Math.abs(to.y - drag.from.y);
    setDrag(null);
    if (dx < MIN_DRAG && dy < MIN_DRAG) {
      onPick?.(to);
      return;
    }
    const xs = [x.invert(drag.from.x), x.invert(to.x)].sort((a, b) => a - b) as [number, number];
    const ys = [y.invert(drag.from.y), y.invert(to.y)].sort((a, b) => a - b) as [number, number];
    onZoom({ x: dx >= MIN_DRAG ? xs : null, y: dy >= MIN_DRAG * 2 ? ys : null });
  };

  const box = drag && {
    x: Math.min(drag.from.x, drag.to.x),
    y: Math.min(drag.from.y, drag.to.y),
    w: Math.abs(drag.to.x - drag.from.x),
    h: Math.abs(drag.to.y - drag.from.y),
  };
  const flat = box && box.h < MIN_DRAG * 2;

  return (
    <g>
      {box && (
        <rect
          x={box.x}
          y={flat ? 0 : box.y}
          width={box.w}
          height={flat ? height : box.h}
          fill="var(--color-ink)"
          fillOpacity={0.08}
          stroke="var(--color-ink)"
          strokeOpacity={0.5}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      )}
      <rect
        data-testid="zoom-layer"
        width={width}
        height={height}
        fill="transparent"
        className="cursor-crosshair touch-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const at = local(event);
          setDrag({ from: at, to: at });
        }}
        onPointerMove={(event) => {
          const at = local(event);
          if (drag) setDrag({ ...drag, to: at });
          onHover?.(at);
        }}
        onPointerUp={(event) => {
          finish(local(event));
        }}
        onPointerCancel={() => {
          setDrag(null);
        }}
        onPointerLeave={() => {
          if (!drag) onLeave?.();
        }}
        onDoubleClick={onReset}
      />
    </g>
  );
}

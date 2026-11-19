import type { ReactNode } from "react";

export interface TipRow {
  key: string | number;
  colour: string;
  label: string;
  value: string;
  dashed?: boolean;
  strong?: boolean;
}

/** Width the tooltip reserves when deciding which side of the pointer it goes. */
const TIP_WIDTH = 220;

/**
 * Values under the pointer, in a frosted card next to it. `left`/`top` are in pixels from
 * the chart's wrapper (which must be `relative`); it flips to the left near the right edge.
 */
export function ChartTooltip({
  left,
  top,
  width,
  title,
  rows,
  footer,
}: {
  left: number;
  top: number;
  width: number;
  title: ReactNode;
  rows: readonly TipRow[];
  footer?: ReactNode;
}) {
  const flip = left + TIP_WIDTH + 16 > width;
  return (
    <div
      aria-hidden="true"
      className="glass pointer-events-none absolute z-20 w-max max-w-[220px] rounded-xl px-3 py-2 text-xs"
      style={{
        left: flip ? left - 12 : left + 12,
        top,
        transform: flip ? "translateX(-100%)" : undefined,
      }}
    >
      <p className="mb-1 font-bold">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <span
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{
                backgroundColor: row.colour,
                ...(row.dashed ? { opacity: 0.6 } : {}),
              }}
            />
            <span className={`flex-1 truncate ${row.strong ? "font-bold" : "text-muted"}`}>
              {row.label}
            </span>
            <span className="num font-semibold">{row.value}</span>
          </li>
        ))}
      </ul>
      {footer && <p className="mt-1 text-muted">{footer}</p>}
    </div>
  );
}

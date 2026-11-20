import { type CSSProperties, useState } from "react";

import { sharper } from "@/lib/portrait";
import { inkOn, teamColour } from "@/lib/teams";

/**
 * A driver from the head to the chest: the full-length portrait (ADR 0006/0009) cropped
 * from the top and faded out at the bottom, so it fills a card instead of standing tiny in
 * it. Falls back to the driver code on the team colour. Decorative: the name is written
 * next to it.
 */
export function Bust({
  url,
  label,
  colour,
  className,
  width = 640,
  fade = true,
  priority = false,
}: {
  url: string | null | undefined;
  label: string;
  colour: string | null | undefined;
  /** Size and position; the picture covers the box from its top. */
  className: string;
  /** Requested picture width in pixels. */
  width?: number;
  fade?: boolean;
  /** The page's main picture (LCP): fetched first instead of lazily. */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const mask: CSSProperties | undefined = fade
    ? {
        maskImage: "linear-gradient(to bottom, black 70%, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, black 70%, transparent)",
      }
    : undefined;
  if (url && !failed) {
    return (
      <img
        src={sharper(url, width)}
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        referrerPolicy="no-referrer"
        onError={() => {
          setFailed(true);
        }}
        className={`object-cover object-top ${className}`}
        style={mask}
      />
    );
  }
  const fill = teamColour(colour);
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center text-3xl font-bold ${className}`}
      style={{ backgroundColor: fill, color: inkOn(fill) }}
    >
      {label}
    </span>
  );
}

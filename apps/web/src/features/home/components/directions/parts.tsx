import { useState } from "react";

import { compoundInfo } from "@/lib/compounds";
import { useI18n } from "@/lib/i18n/context";
import { inkOn, teamColour } from "@/lib/teams";

import type { EntryStints, Headline } from "./data";

/**
 * A circuit drawn as a road: a wide band, its edge and a fine centre line, so it reads as
 * tarmac and not as a doodle. Decorative: the circuit name is always written nearby.
 */
export function TrackArt({
  path,
  className = "",
  road = "var(--color-track)",
  edge = "var(--color-track-edge)",
  line = "var(--color-ink)",
  width = 14,
}: {
  path: string;
  className?: string;
  road?: string;
  edge?: string;
  line?: string;
  width?: number;
}) {
  const common = {
    d: path,
    fill: "none",
    strokeLinejoin: "round",
    strokeLinecap: "round",
    vectorEffect: "non-scaling-stroke",
  } as const;
  return (
    <svg
      aria-hidden="true"
      viewBox="-6 -6 112 112"
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      <path {...common} stroke={edge} strokeWidth={width + 4} />
      <path {...common} stroke={road} strokeWidth={width} />
      <path {...common} stroke={line} strokeWidth={1.5} strokeDasharray="6 7" opacity={0.55} />
    </svg>
  );
}

/** The publisher's picture (ADR 0015), else an original tile with the source name. */
export function NewsImage({
  headline,
  className = "",
}: {
  headline: Headline;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (headline.image_url && !failed) {
    return (
      <img
        src={headline.image_url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          setFailed(true);
        }}
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    <span aria-hidden="true" className={`grid place-items-center bg-raised ${className}`}>
      <span className="condensed px-3 text-center text-2xl font-extrabold text-muted uppercase">
        {headline.source_name}
      </span>
    </span>
  );
}

/** Driver picture that keeps its space and falls back to the code on the team colour. */
export function Portrait({
  url,
  label,
  colour,
  className = "",
}: {
  url: string | null | undefined;
  label: string;
  colour: string | null | undefined;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const fill = teamColour(colour);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          setFailed(true);
        }}
        className={`object-cover object-top ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center font-extrabold ${className}`}
      style={{ color: fill, backgroundColor: `color-mix(in oklab, ${fill} 18%, transparent)` }}
    >
      <span className="condensed text-[2.5em] leading-none">{label}</span>
    </span>
  );
}

/** Stints along the race distance, compound colour and letter, stops as gaps. */
export function StrategyStrip({
  stint,
  totalLaps,
  className = "h-4",
}: {
  stint: EntryStints;
  totalLaps: number;
  className?: string;
}) {
  const { t } = useI18n();
  const parts = stint.stints.filter((s) => s.lap_start != null && s.lap_end != null);
  const label = parts
    .map(
      (s) =>
        `${t(`compound.${compoundInfo(s.compound).key}`)} ${String(s.lap_start)}–${String(s.lap_end)}`,
    )
    .join(", ");
  return (
    <span role="img" aria-label={label} className={`relative block w-full ${className}`}>
      {parts.map((s) => {
        const info = compoundInfo(s.compound);
        const start = ((s.lap_start ?? 1) - 1) / totalLaps;
        const share = ((s.lap_end ?? 0) - (s.lap_start ?? 1) + 1) / totalLaps;
        return (
          <span
            key={s.stint_number}
            className="absolute inset-y-0 grid place-items-center rounded-[2px] text-[0.65rem] font-bold text-tyre-ink"
            style={{
              left: `calc(${String(start * 100)}% + 1px)`,
              width: `calc(${String(share * 100)}% - 2px)`,
              backgroundColor: info.fill,
            }}
          >
            {share >= 0.08 ? info.letter : ""}
          </span>
        );
      })}
    </span>
  );
}

/** Position on the team colour, like a timing tower. */
export function PositionTag({
  position,
  colour,
  className = "h-7 w-8 text-sm",
}: {
  position: string;
  colour: string | null | undefined;
  className?: string;
}) {
  const fill = teamColour(colour);
  return (
    <span
      className={`num grid shrink-0 place-items-center font-semibold ${className}`}
      style={{ backgroundColor: fill, color: inkOn(fill) }}
    >
      {position}
    </span>
  );
}

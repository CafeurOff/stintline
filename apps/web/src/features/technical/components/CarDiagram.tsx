import { useState } from "react";

import { readable } from "@/lib/colour";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

const ZONES = [
  "front_wing",
  "nose",
  "front_corner",
  "front_suspension",
  "cockpit",
  "sidepod",
  "engine_cover",
  "floor",
  "diffuser",
  "rear_corner",
  "rear_suspension",
  "beam_wing",
  "rear_wing",
] as const;
type Zone = (typeof ZONES)[number];

/**
 * Where each area sits on the official side-view render (nose to the right), in percent of
 * the picture's width and height. Measured on the 2026 renders, which share one framing.
 */
const SPOTS: Record<Zone, readonly [x: number, y: number]> = {
  front_wing: [97, 82],
  nose: [91, 52],
  front_corner: [81, 66],
  front_suspension: [73, 48],
  cockpit: [59, 30],
  sidepod: [46, 58],
  engine_cover: [37, 24],
  floor: [62, 80],
  diffuser: [22, 84],
  rear_corner: [14, 66],
  rear_suspension: [25, 56],
  beam_wing: [8, 56],
  rear_wing: [6, 22],
};

/**
 * The team's own car (official render, ADR 0006) with a light on every area an upgrade
 * touches, numbered and named below. Without a render, the areas are listed on their own.
 */
export function CarDiagram({
  zones,
  colour,
  imageUrl,
  className = "",
}: {
  zones: ReadonlySet<string>;
  colour: string | null | undefined;
  imageUrl?: string | null | undefined;
  className?: string;
}) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const fill = teamColour(colour);
  const touched = ZONES.filter((zone) => zones.has(zone));
  const label = touched.length
    ? t("tech.diagram", { zones: touched.map((z) => t(`tech.zone.${z}`)).join(", ") })
    : t("tech.diagramNone");
  const showCar = Boolean(imageUrl) && !failed;

  return (
    <figure role="img" aria-label={label} className={`flex w-full flex-col gap-4 ${className}`}>
      {showCar && (
        <div className="relative w-full">
          <span
            aria-hidden="true"
            className="absolute inset-x-[6%] bottom-0 h-5 rounded-[50%] bg-black/50 blur-xl"
          />
          <img
            src={imageUrl ?? undefined}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => {
              setFailed(true);
            }}
            className="relative block w-full object-contain"
          />
          {ZONES.map((zone) => {
            const [x, y] = SPOTS[zone];
            const on = zones.has(zone);
            const index = touched.indexOf(zone);
            return (
              <span
                key={zone}
                aria-hidden="true"
                title={t(`tech.zone.${zone}`)}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${String(x)}%`, top: `${String(y)}%` }}
              >
                {on ? (
                  <span className="relative grid size-7 place-items-center">
                    <span
                      className="absolute inset-0 animate-ping rounded-full opacity-60"
                      style={{ backgroundColor: fill }}
                    />
                    <span
                      className="num relative grid size-7 place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow-[0_0_18px_4px]"
                      style={{
                        backgroundColor: fill,
                        color: "white",
                        boxShadow: `0 0 18px 4px ${fill}`,
                      }}
                    >
                      {index + 1}
                    </span>
                  </span>
                ) : (
                  <span className="block size-2 rounded-full bg-white/40 ring-2 ring-black/30" />
                )}
              </span>
            );
          })}
        </div>
      )}
      <ol aria-hidden="true" className="flex flex-wrap gap-2">
        {touched.map((zone, index) => (
          <li
            key={zone}
            className="glass flex items-center gap-2 rounded-lg py-1 pr-3 pl-1 text-sm font-semibold"
          >
            <span
              className="num grid size-6 place-items-center rounded-md text-xs font-bold text-white"
              style={{ backgroundColor: fill }}
            >
              {index + 1}
            </span>
            <span style={{ color: readable(fill, 55) }}>{t(`tech.zone.${zone}`)}</span>
          </li>
        ))}
        {touched.length === 0 && <li className="text-sm text-muted">{t("tech.diagramNone")}</li>}
      </ol>
    </figure>
  );
}

import { useId } from "react";

import { useI18n } from "@/lib/i18n/context";
import { teamColour, teamTint } from "@/lib/teams";

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
 * An original top-down drawing of a single-seater (front at the top), each area a shape that
 * lights up in the team colour when an upgrade touches it. The parts are listed next to it.
 */
const SHAPES: Record<Zone, readonly string[]> = {
  front_wing: ["M14 12 h92 v14 h-92 z"],
  nose: ["M52 26 h16 l-2 52 h-12 z"],
  front_corner: ["M6 44 h20 v34 h-20 z", "M94 44 h20 v34 h-20 z"],
  front_suspension: ["M26 56 L46 64 L46 68 L26 62 z", "M94 56 L74 64 L74 68 L94 62 z"],
  floor: ["M24 118 L96 118 L102 236 L18 236 z"],
  sidepod: ["M24 128 h20 v62 h-20 z", "M76 128 h20 v62 h-20 z"],
  cockpit: ["M48 92 h24 v36 h-24 z"],
  engine_cover: ["M46 132 h28 l-4 84 h-20 z"],
  diffuser: ["M34 236 h52 l-6 16 h-40 z"],
  rear_corner: ["M4 212 h22 v38 h-22 z", "M94 212 h22 v38 h-22 z"],
  rear_suspension: ["M26 226 L46 222 L46 226 L26 232 z", "M94 226 L74 222 L74 226 L94 232 z"],
  beam_wing: ["M36 256 h48 v6 h-48 z"],
  rear_wing: ["M22 268 h76 v16 h-76 z"],
};

/** The floor sits under everything else. */
const DRAW_ORDER: readonly Zone[] = ["floor", ...ZONES.filter((zone) => zone !== "floor")];

export function CarDiagram({
  zones,
  colour,
  className = "",
}: {
  zones: ReadonlySet<string>;
  colour: string | null | undefined;
  className?: string;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const fill = teamColour(colour);
  const touched = ZONES.filter((zone) => zones.has(zone));
  return (
    <svg
      viewBox="0 0 120 296"
      role="img"
      aria-labelledby={titleId}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <title id={titleId}>
        {touched.length
          ? t("tech.diagram", { zones: touched.map((z) => t(`tech.zone.${z}`)).join(", ") })
          : t("tech.diagramNone")}
      </title>
      {DRAW_ORDER.map((zone) =>
        SHAPES[zone].map((d, i) => (
          <path
            key={`${zone}-${String(i)}`}
            d={d}
            fill={zones.has(zone) ? fill : teamTint(colour, 8)}
            stroke={zones.has(zone) ? "var(--color-ink)" : "var(--color-line-strong)"}
            strokeWidth={zones.has(zone) ? 1.5 : 1}
            opacity={zone === "floor" && !zones.has(zone) ? 0.6 : 1}
          >
            <title>{t(`tech.zone.${zone}`)}</title>
          </path>
        )),
      )}
    </svg>
  );
}

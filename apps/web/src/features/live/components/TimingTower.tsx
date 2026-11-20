import type { Schema } from "@stintline/api-types";

import { Move } from "@/components/racing/Move";
import { CompoundBadge } from "@/components/racing/CompoundBadge";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

type Car = Schema<"LiveCar">;
type Sector = Schema<"LiveSector">;
type I18n = ReturnType<typeof useI18n>;

const SEGMENT_CLASS: Record<Sector["segments"][number], string> = {
  none: "bg-raised",
  yellow: "bg-t-yellow",
  green: "bg-t-green",
  purple: "bg-t-purple",
  pit: "bg-t-blue",
};

function gapText(car: Car, { t, f }: I18n): string {
  if (car.position === 1) return t("live.leader");
  if (car.laps_behind > 0)
    return t(car.laps_behind === 1 ? "event.lapDown" : "event.lapsDown", { n: car.laps_behind });
  return car.gap_s == null ? "" : `+${f.number(car.gap_s, 3)}`;
}

/** One sector: its mini-sectors as coloured ticks, then the last time through it. */
function SectorCell({ sector, index }: { sector: Sector; index: number }) {
  const { t, f } = useI18n();
  const tone = sector.overall_best
    ? "text-t-purple"
    : sector.personal_best
      ? "text-t-green"
      : "text-ink";
  const best = sector.overall_best
    ? t("live.sector.overall")
    : sector.personal_best
      ? t("live.sector.personal")
      : "";
  return (
    <span className="flex min-w-14 flex-col gap-1">
      <span aria-hidden="true" className="flex gap-px">
        {sector.segments.map((segment, i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-[1px] ${SEGMENT_CLASS[segment]}`} />
        ))}
      </span>
      <span className={`num text-xs font-semibold ${tone}`}>
        <span className="sr-only">{t("live.sector.label", { n: index + 1 })} </span>
        {sector.time_s == null ? "—" : f.number(sector.time_s, 3)}
        {best && <span className="sr-only"> ({best})</span>}
      </span>
    </span>
  );
}

/**
 * The timing tower: order, places won since the start, gaps, mini-sectors coloured as on
 * the timing screens (purple fastest overall, green personal best, yellow slower, blue in
 * the pit lane), tyres with their age, stops and the last lap.
 */
export function TimingTower({
  cars,
  selected,
  onSelect,
}: {
  cars: readonly Car[];
  selected: number | null;
  onSelect: (car: number) => void;
}) {
  const i18n = useI18n();
  const { t, f } = i18n;
  const sectors = Math.max(0, ...cars.map((c) => c.sectors.length));
  return (
    <div className="relative overflow-x-auto">
      <table className="data-table">
        <caption className="sr-only">{t("live.order")}</caption>
        <thead>
          <tr>
            <th className="num">{t("col.position")}</th>
            <th className="num hidden sm:table-cell">
              <span className="sr-only">{t("live.sinceStart")}</span>
            </th>
            <th>{t("col.driver")}</th>
            <th className="num">{t("live.gap")}</th>
            <th className="num hidden sm:table-cell">{t("live.interval")}</th>
            {Array.from({ length: sectors }, (_, i) => (
              <th key={i} className="hidden md:table-cell">
                {t("live.sector.short", { n: i + 1 })}
              </th>
            ))}
            <th>{t("live.tyres")}</th>
            <th className="num hidden md:table-cell">{t("live.stops")}</th>
            <th className="num hidden lg:table-cell">{t("live.lastLap")}</th>
          </tr>
        </thead>
        <tbody>
          {cars.map((car) => (
            <tr key={car.number} className={car.number === selected ? "bg-raised" : ""}>
              <td className="num font-bold">{car.position ?? "—"}</td>
              <td className="num hidden sm:table-cell">
                {car.grid != null && car.position != null && (
                  <Move value={car.grid - car.position} />
                )}
              </td>
              <td>
                <button
                  type="button"
                  aria-pressed={car.number === selected}
                  onClick={() => {
                    onSelect(car.number);
                  }}
                  className="flex items-center gap-2 font-semibold hover:underline"
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-1 rounded-full"
                    style={{ backgroundColor: teamColour(car.colour) }}
                  />
                  {car.code}
                  <span className="sr-only">
                    {" "}
                    {car.first_name} {car.last_name}
                  </span>
                  {(car.in_pit || car.retired) && (
                    <span className="rounded bg-raised px-1.5 text-xs text-muted">
                      {car.retired ? t("live.out") : t("live.inPit")}
                    </span>
                  )}
                </button>
              </td>
              <td className="num">{gapText(car, i18n)}</td>
              <td className="num hidden sm:table-cell">
                {car.interval_s == null ? "" : `+${f.number(car.interval_s, 3)}`}
              </td>
              {Array.from({ length: sectors }, (_, i) => {
                const sector = car.sectors[i];
                return (
                  <td key={i} className="hidden md:table-cell">
                    {sector && <SectorCell sector={sector} index={i} />}
                  </td>
                );
              })}
              <td>
                <span className="flex items-center gap-1.5">
                  {car.compound && <CompoundBadge compound={car.compound} />}
                  {car.tyre_age != null && (
                    <span className="text-sm text-muted tabular-nums">
                      <span className="sr-only">{t("live.tyreAge")} </span>
                      {car.tyre_age}
                    </span>
                  )}
                </span>
              </td>
              <td className="num hidden md:table-cell">{car.pit_stops}</td>
              <td className="num hidden lg:table-cell">{f.lapTime(car.last_lap_s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 hidden flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted md:flex">
        <Legend tone="bg-t-purple" label={t("live.sector.overall")} />
        <Legend tone="bg-t-green" label={t("live.sector.personal")} />
        <Legend tone="bg-t-yellow" label={t("live.sector.slower")} />
        <Legend tone="bg-t-blue" label={t("live.sector.pit")} />
      </p>
    </div>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`size-2 rounded-[1px] ${tone}`} />
      {label}
    </span>
  );
}

import type { Schema } from "@stintline/api-types";

import { byFinish, driverCode, driverName } from "@/features/race/entries";
import { compoundInfo } from "@/lib/compounds";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

/** Every car's stints as one bar per driver, in finishing order (compound letter + colour). */
export function StrategyStrips({
  rows,
  totalLaps,
}: {
  rows: readonly Schema<"EntryStints">[];
  totalLaps: number;
}) {
  const { t } = useI18n();
  return (
    <ol className="flex flex-col gap-1">
      {[...rows].sort(byFinish).map((row) => (
        <li key={row.car_number} className="grid grid-cols-[2rem_3rem_1fr] items-center gap-2">
          <span className="tabular text-muted">{row.finish_position ?? "–"}</span>
          <span className="font-bold" title={driverName(row)}>
            <span
              aria-hidden="true"
              className="mr-1.5 inline-block h-3 w-1 align-middle"
              style={{ backgroundColor: teamColour(row.team_colour) }}
            />
            {driverCode(row)}
            <span className="sr-only"> {driverName(row)}</span>
          </span>
          <span className="flex h-5 gap-0.5">
            {row.stints.map((stint) => {
              if (stint.lap_start == null || stint.lap_end == null || totalLaps === 0) return null;
              const info = compoundInfo(stint.compound);
              const used = (stint.tyre_age_at_start ?? 0) > 0;
              const label = `${t(`compound.${info.key}`)} ${stint.lap_start}–${stint.lap_end}`;
              return (
                <span
                  key={stint.stint_number}
                  role="img"
                  aria-label={label}
                  title={label}
                  className="flex items-center overflow-hidden rounded-sm pl-1 text-[0.7rem] font-bold text-tyre-ink"
                  style={{
                    backgroundColor: info.fill,
                    width: `${((stint.lap_end - stint.lap_start + 1) / totalLaps) * 100}%`,
                  }}
                >
                  <span aria-hidden="true">
                    {info.letter}
                    {used ? "*" : ""}
                  </span>
                </span>
              );
            })}
          </span>
        </li>
      ))}
    </ol>
  );
}

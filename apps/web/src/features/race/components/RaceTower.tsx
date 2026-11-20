import { useState } from "react";

import { CompoundBadge } from "@/components/racing/CompoundBadge";
import { Face } from "@/components/racing/Face";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import { driverCode, driverName, type Entry, entryPhoto } from "../entries";
import type { TowerLine } from "../tower";

type GapMode = "leader" | "interval";

/**
 * The running order at the replay instant, as on a timing screen: position, driver, gap to
 * the leader or to the car ahead, tyres and stops. A line is a button that picks the driver
 * the simulators work on.
 */
export function RaceTower({
  lines,
  byCar,
  selected,
  onSelect,
}: {
  lines: readonly TowerLine[];
  byCar: ReadonlyMap<number, Entry>;
  selected: number;
  onSelect: (carNumber: number) => void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<GapMode>("leader");

  const gap = (line: TowerLine): string => {
    if (line.position === 1) return t("tower.leader");
    if (line.lapsDown > 0) return t("tower.lapsDown", { n: line.lapsDown });
    const value = mode === "leader" ? line.toLeaderS : line.intervalS;
    return value === null ? "—" : `+${value.toFixed(1)}`;
  };

  return (
    <section
      aria-labelledby="race-tower-title"
      className="glass flex min-h-0 w-full flex-col overflow-hidden rounded-[20px]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 id="race-tower-title" className="text-sm font-bold">
          {t("tower.title")}
        </h2>
        <div role="group" aria-label={t("tower.gapMode")} className="flex gap-1 text-xs">
          {(["leader", "interval"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
              }}
              className="rounded-md px-2 py-1 font-semibold text-muted aria-pressed:bg-ink aria-pressed:text-bg"
            >
              {value === "leader" ? t("tower.leaderMode") : t("tower.intervalMode")}
            </button>
          ))}
        </div>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto py-1">
        {lines.map((line) => {
          const entry = byCar.get(line.carNumber);
          if (!entry) return null;
          const isSelected = line.carNumber === selected;
          return (
            <li key={line.carNumber}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={t("tower.row", { position: line.position, name: driverName(entry) })}
                onClick={() => {
                  onSelect(line.carNumber);
                }}
                className="timing grid w-full grid-cols-[1.75rem_0.25rem_1.75rem_1fr_auto_auto] items-center gap-x-2 px-3 py-1.5 text-left text-sm transition hover:bg-ink/5 aria-pressed:bg-ink/10"
              >
                <span className="text-right font-bold text-muted tabular-nums">
                  {line.position}
                </span>
                <span
                  aria-hidden="true"
                  className="h-5 w-1 rounded-full"
                  style={{ backgroundColor: teamColour(entry.team_colour) }}
                />
                <Face
                  url={entryPhoto(entry)}
                  label={driverCode(entry)}
                  colour={entry.team_colour}
                  className="size-7 rounded-full"
                />
                <span className={isSelected ? "font-bold" : "font-semibold"}>
                  {driverCode(entry)}
                </span>
                <span className="text-right text-muted tabular-nums">{gap(line)}</span>
                <span
                  title={t("tower.stops", { n: line.stops })}
                  className="flex items-center gap-1 text-xs text-muted"
                >
                  <CompoundBadge compound={line.compound} />
                  <span className="w-5 tabular-nums">{line.tyreAge ?? ""}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

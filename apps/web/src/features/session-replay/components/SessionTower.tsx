import { CompoundBadge } from "@/components/racing/CompoundBadge";
import { Face } from "@/components/racing/Face";
import { driverCode, driverName, type Entry, entryPhoto } from "@/features/race/entries";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import type { StandingLine } from "../timeline";

/**
 * The classification at the replay instant, as a timing screen shows it in practice and
 * qualifying: best lap and gap to the fastest, laps run, current tyre, in the pits or not.
 * Cars knocked out of an earlier segment sit at the bottom, greyed.
 */
export function SessionTower({
  lines,
  byCar,
  selected,
  segmentName,
  onSelect,
}: {
  lines: readonly StandingLine[];
  byCar: ReadonlyMap<number, Entry>;
  selected: number;
  segmentName: (n: number) => string;
  onSelect: (carNumber: number) => void;
}) {
  const { t, f } = useI18n();
  return (
    <section
      aria-labelledby="session-tower-title"
      className="glass flex min-h-0 w-full flex-col overflow-hidden rounded-[20px]"
    >
      <h2 id="session-tower-title" className="border-b border-line px-4 py-3 text-sm font-bold">
        {t("sreplay.tower")}
      </h2>
      <ol className="min-h-0 flex-1 overflow-y-auto py-1">
        {lines.map((line, index) => {
          const entry = byCar.get(line.carNumber);
          if (!entry) return null;
          const isSelected = line.carNumber === selected;
          const time = line.best?.time_s ?? null;
          const firstOut = line.outIn !== null && lines[index - 1]?.outIn !== line.outIn;
          const shown =
            line.outIn !== null
              ? f.lapTime(time)
              : line.gapS === null
                ? time === null
                  ? t("sreplay.noTime")
                  : f.lapTime(time)
                : `+${line.gapS.toFixed(3)}`;
          return (
            <li key={line.carNumber}>
              {firstOut && line.outIn !== null && (
                <p className="mt-1 border-t border-line px-3 pt-2 pb-1 text-[11px] font-bold tracking-wide text-muted uppercase">
                  {t("sreplay.knockedOut", { segment: segmentName(line.outIn) })}
                </p>
              )}
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={t("sreplay.row", {
                  position: line.position,
                  name: driverName(entry),
                  time: time === null ? t("sreplay.noTime") : f.lapTime(time),
                })}
                onClick={() => {
                  onSelect(line.carNumber);
                }}
                className={`timing grid w-full grid-cols-[1.75rem_0.25rem_1.75rem_1fr_auto_auto] items-center gap-x-2 px-3 py-1.5 text-left text-sm transition hover:bg-ink/5 aria-pressed:bg-ink/10 ${
                  line.outIn !== null ? "opacity-55" : ""
                }`}
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
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className={isSelected ? "font-bold" : "font-semibold"}>
                    {driverCode(entry)}
                  </span>
                  {line.state.kind === "pits" && line.laps > 0 && (
                    <span className="rounded bg-ink/10 px-1 text-[10px] font-bold text-muted uppercase">
                      {t("sreplay.pits")}
                    </span>
                  )}
                </span>
                <span className="text-right text-muted tabular-nums">{shown}</span>
                <span
                  title={t("sreplay.lapsDone", { n: line.laps })}
                  className="flex items-center gap-1 text-xs text-muted"
                >
                  <CompoundBadge compound={line.compound} />
                  <span className="w-5 tabular-nums">{line.laps}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

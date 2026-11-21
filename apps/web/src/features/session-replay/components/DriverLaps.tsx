import { CompoundBadge } from "@/components/racing/CompoundBadge";
import { DriverAvatar } from "@/components/racing/DriverAvatar";
import { driverName, type Entry, entryPhoto } from "@/features/race/entries";
import { useI18n } from "@/lib/i18n/context";

import { type CarState, clockLabel, type TimelineLap } from "../timeline";

/**
 * The followed driver at the replay instant: where they are, and every lap run so far with
 * its tyre (out laps, in laps and deleted times included, the best one marked). An out lap
 * shows no time: it runs from the previous crossing of the line, garage included.
 */
export function DriverLaps({
  entry,
  laps,
  state,
  best,
  time,
}: {
  entry: Entry;
  laps: readonly TimelineLap[];
  state: CarState;
  best: TimelineLap | null;
  time: number;
}) {
  const { t, f } = useI18n();
  const run = laps.filter((lap) => lap.start_s <= time);
  const status =
    state.kind === "track"
      ? t("sreplay.status.track", { lap: state.lap.lap })
      : t("sreplay.status.pits");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <DriverAvatar
          label={entry.car_number}
          name={driverName(entry)}
          colour={entry.team_colour}
          imageUrl={entryPhoto(entry)}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{driverName(entry)}</p>
          <p className="text-sm text-muted">{status}</p>
        </div>
        {best && (
          <p className="text-right">
            <span className="block text-xs text-muted">{t("sreplay.bestLap")}</span>
            <span className="timing font-bold">{f.lapTime(best.time_s)}</span>
          </p>
        )}
      </div>
      <h3 className="text-sm font-bold">{t("sreplay.driverLaps")}</h3>
      {run.length === 0 ? (
        <p className="text-sm text-muted">{t("sreplay.noLaps")}</p>
      ) : (
        <div className="relative max-h-[22rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-panel text-xs text-muted">
              <tr>
                <th scope="col" className="py-1 text-left font-semibold">
                  {t("sreplay.lap")}
                </th>
                <th scope="col" className="py-1 text-left font-semibold">
                  {t("sreplay.started")}
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  {t("sreplay.time")}
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  {t("sreplay.tyre")}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...run].reverse().map((lap) => {
                const isBest = best !== null && lap.lap === best.lap;
                const running = lap.end_s !== null && lap.end_s > time;
                const note = lap.deleted
                  ? t("sreplay.deleted")
                  : lap.pit_out
                    ? t("sreplay.outLap")
                    : lap.pit_in
                      ? t("sreplay.inLap")
                      : null;
                return (
                  <tr
                    key={lap.lap}
                    className={`border-t border-line ${isBest ? "bg-gain/10" : ""}`}
                  >
                    <td className="timing py-1">{lap.lap}</td>
                    <td className="timing py-1 text-muted">{clockLabel(lap.start_s)}</td>
                    <td className="py-1 text-right">
                      <span
                        className={`timing ${isBest ? "font-bold text-gain" : ""} ${
                          lap.deleted ? "line-through opacity-60" : ""
                        }`}
                      >
                        {running ? "…" : lap.pit_out ? "—" : f.lapTime(lap.time_s)}
                      </span>
                      {note && <span className="block text-[11px] text-muted">{note}</span>}
                    </td>
                    <td className="py-1">
                      <span className="flex items-center justify-end gap-1 text-xs text-muted">
                        <CompoundBadge compound={lap.compound} />
                        <span className="w-4 tabular-nums">{lap.tyre_age ?? ""}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

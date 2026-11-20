import type { Schema } from "@stintline/api-types";

import { DriverName } from "@/components/racing/DriverName";
import { GridSlot, ResultPosition } from "@/components/racing/ResultStatus";
import { TeamName } from "@/components/racing/TeamName";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useSessionDetail } from "@/features/race/api";
import { byFinish } from "@/features/race/entries";
import { useI18n } from "@/lib/i18n/context";
import { useOutText } from "@/lib/useOutText";

type Entry = Schema<"Entry">;
export type Kind = "R" | "SPRINT" | "Q";

export function SessionResults({ sessionId, kind }: { sessionId: number; kind: Kind }) {
  const { t } = useI18n();
  const session = useSessionDetail(sessionId);
  if (session.isError) {
    return <ErrorState error={session.error} onRetry={() => void session.refetch()} />;
  }
  if (!session.data) return <Skeleton className="h-96" />;
  const entries = [...session.data.entries].sort(byFinish);
  if (entries.length === 0) return <EmptyState title={t("event.noResults")} />;
  return kind === "Q" ? <QualifyingTable entries={entries} /> : <RaceTable entries={entries} />;
}

function RaceTable({ entries }: { entries: Entry[] }) {
  const { t, f } = useI18n();
  const outText = useOutText();
  const winner = entries[0];
  const gap = (entry: Entry): string => {
    if (!winner) return "";
    if (entry === winner) return f.lapTime(entry.race_time_s);
    const out = outText(entry.classification, entry.status);
    if (out !== null) return out;
    // Lapped cars also have a time (for fewer laps): the gap is in laps, not seconds.
    const down = (winner.laps_completed ?? 0) - (entry.laps_completed ?? 0);
    if (entry.finish_position != null && down > 0) {
      return t(down === 1 ? "event.lapDown" : "event.lapsDown", { n: down });
    }
    if (entry.race_time_s != null && winner.race_time_s != null) {
      return `+${f.seconds(entry.race_time_s - winner.race_time_s, 3)}`;
    }
    return entry.status ?? "";
  };
  return (
    <div className="overflow-x-auto">
      <table className="data-table text-sm">
        <thead>
          <tr>
            <th className="num">{t("col.position")}</th>
            <th>{t("col.driver")}</th>
            <th className="hidden sm:table-cell">{t("col.team")}</th>
            <th className="num hidden md:table-cell">{t("col.grid")}</th>
            <th className="num hidden md:table-cell">{t("col.laps")}</th>
            <th className="num">{t("col.time")}</th>
            <th className="num">{t("col.points")}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.car_number}>
              <td className="num font-bold">
                <ResultPosition
                  classification={entry.classification}
                  position={entry.finish_position}
                />
              </td>
              <td>
                <DriverName
                  driver={entry.driver}
                  colour={entry.team_colour}
                  imageUrl={entry.media?.driver_image_url}
                />
                {entry.fastest_lap_rank === 1 && (
                  <span
                    className="ml-2 rounded bg-raised px-1.5 py-0.5 text-xs font-semibold"
                    title={t("event.fastestLap")}
                  >
                    {t("event.fastestLapShort")}
                    <span className="sr-only"> {t("event.fastestLap")}</span>
                  </span>
                )}
              </td>
              <td className="hidden sm:table-cell">
                <TeamName team={entry.team} colour={entry.team_colour} />
              </td>
              <td className="num hidden text-muted md:table-cell">
                <GridSlot grid={entry.grid_position} />
              </td>
              <td className="num hidden text-muted md:table-cell">{entry.laps_completed}</td>
              <td className="num whitespace-nowrap">{gap(entry)}</td>
              <td className="num font-semibold">{entry.points ? f.number(entry.points, 0) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QualifyingTable({ entries }: { entries: Entry[] }) {
  const { t, f } = useI18n();
  return (
    <div className="overflow-x-auto">
      <table className="data-table text-sm">
        <thead>
          <tr>
            <th className="num">{t("col.position")}</th>
            <th>{t("col.driver")}</th>
            <th className="hidden sm:table-cell">{t("col.team")}</th>
            <th className="num">Q1</th>
            <th className="num">Q2</th>
            <th className="num">Q3</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.car_number}>
              <td className="num font-bold">{entry.finish_position ?? "—"}</td>
              <td>
                <DriverName driver={entry.driver} colour={entry.team_colour} />
              </td>
              <td className="hidden sm:table-cell">
                <TeamName team={entry.team} colour={entry.team_colour} />
              </td>
              <td className="num">{entry.q1_s == null ? "" : f.lapTime(entry.q1_s)}</td>
              <td className="num">{entry.q2_s == null ? "" : f.lapTime(entry.q2_s)}</td>
              <td className="num">{entry.q3_s == null ? "" : f.lapTime(entry.q3_s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

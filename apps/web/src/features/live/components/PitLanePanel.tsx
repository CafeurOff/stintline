import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import type { LiveSnapshot } from "../buffer";
import { mean, teamAverages } from "../pitLane";

const LATEST_SHOWN = 6;
const TEAMS_SHOWN = 6;

/**
 * Pit-lane times as the official feed times them (entry to exit, not stationary time):
 * the latest stops, the session average and the quickest crews on average.
 */
export function PitLanePanel({ snapshot }: { snapshot: LiveSnapshot }) {
  const { t, f } = useI18n();
  const stops = snapshot.pit_lane;
  const cars = new Map(snapshot.cars.map((c) => [c.number, c]));
  if (stops.length === 0) return null;
  const fastest = stops.reduce((a, b) => (b.pit_lane_duration_s < a.pit_lane_duration_s ? b : a));
  const teams = teamAverages(stops, (n) => cars.get(n));
  const code = (n: number) => cars.get(n)?.code ?? String(n);
  return (
    <section
      aria-labelledby="live-pitlane"
      className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-5"
    >
      <h2 id="live-pitlane" className="text-lg font-bold">
        {t("live.pitLane.title")}
      </h2>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">{t("live.pitLane.stops")}</dt>
          <dd className="num text-xl font-bold">{stops.length}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("live.pitLane.average")}</dt>
          <dd className="num text-xl font-bold">
            {f.seconds(mean(stops.map((s) => s.pit_lane_duration_s)), 1)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("live.pitLane.fastest")}</dt>
          <dd className="num text-xl font-bold">
            {f.seconds(fastest.pit_lane_duration_s, 1)}{" "}
            <span className="text-sm font-semibold text-muted">{code(fastest.number)}</span>
          </dd>
        </div>
      </dl>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="relative overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">{t("live.pitLane.latest")}</caption>
            <thead>
              <tr>
                <th>{t("col.driver")}</th>
                <th className="num">{t("analysis.lap")}</th>
                <th className="num">{t("live.pitLane.time")}</th>
              </tr>
            </thead>
            <tbody>
              {[...stops]
                .reverse()
                .slice(0, LATEST_SHOWN)
                .map((stop) => (
                  <tr key={`${String(stop.number)}-${String(stop.lap)}`}>
                    <td className="flex items-center gap-2 font-semibold">
                      <span
                        aria-hidden="true"
                        className="h-3 w-1 rounded-full"
                        style={{ backgroundColor: teamColour(cars.get(stop.number)?.colour) }}
                      />
                      {code(stop.number)}
                    </td>
                    <td className="num">{stop.lap ?? "—"}</td>
                    <td className="num">{f.seconds(stop.pit_lane_duration_s, 1)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {teams.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-bold text-muted uppercase">{t("live.pitLane.teams")}</h3>
            <ol className="flex flex-col gap-1 text-sm">
              {teams.slice(0, TEAMS_SHOWN).map((row) => (
                <li key={row.team} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-3 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: teamColour(row.colour) }}
                    />
                    <span className="truncate">{row.team}</span>
                  </span>
                  <span className="num whitespace-nowrap">
                    {f.seconds(row.average, 1)}{" "}
                    <span className="text-xs text-muted">
                      {t("live.pitLane.count", { n: row.stops })}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      <p className="text-xs text-muted">{t("live.pitLane.note")}</p>
    </section>
  );
}

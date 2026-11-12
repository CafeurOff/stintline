import type { Schema } from "@stintline/api-types";
import {
  ArrowLeftRight,
  Hourglass,
  ListOrdered,
  Timer,
  UsersRound,
  Wrench,
  Zap,
} from "lucide-react";
import { Link } from "react-router";

import { Panel, Tile } from "@/components/dash/Panel";
import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { TeamName } from "@/components/hub/TeamName";
import { Flag } from "@/components/racing/Flag";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { ApiError } from "@/lib/errors";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import { usePitStops } from "../api";
import { LossBars } from "../charts/LossBars";
import { FIRST_TIMED_SEASON, useSeasonParam } from "../season";
import { AnalysisTabs, DriverChip, EngineBadge } from "./common";

type Stops = Schema<"PitStops">;

export function PitStopsPage() {
  const { t } = useI18n();
  const [year, setYear] = useSeasonParam();
  return (
    <div className="flex flex-col">
      <PageHeader
        title={year ? t("stops.titleOf", { year }) : t("stops.title")}
        actions={<SeasonSelect value={year} onChange={setYear} />}
      >
        {t("stops.intro")}
      </PageHeader>
      <AnalysisTabs />
      {year === null ? <Skeleton className="h-[60vh]" /> : <PitStops year={year} />}
    </div>
  );
}

function PitStops({ year }: { year: number }) {
  const { t } = useI18n();
  const stops = usePitStops(year);
  if (
    year < FIRST_TIMED_SEASON ||
    (stops.error instanceof ApiError && stops.error.status === 404)
  ) {
    return <EmptyState title={t("stops.empty")} />;
  }
  if (stops.isError) return <ErrorState error={stops.error} onRetry={() => void stops.refetch()} />;
  if (!stops.data) return <Skeleton className="h-[60vh]" />;
  return <PitStopsView data={stops.data} />;
}

function PitStopsView({ data }: { data: Stops }) {
  const { t, f, locale } = useI18n();
  const fastest = data.fastest[0];
  const bestTeam = data.teams.find((team) => team.median_stationary_s != null);
  const withLoss = data.races.filter((r) => r.pit_loss_s != null && r.pit_loss_reliable);
  const dearest = [...withLoss].sort((a, b) => (b.pit_loss_s ?? 0) - (a.pit_loss_s ?? 0))[0];
  const rate = data.undercut_attempts ? data.undercut_successes / data.undercut_attempts : null;
  const maxStationary = Math.max(...data.teams.map((team) => team.median_stationary_s ?? 0), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {fastest ? (
          <Tile label={t("dash.fastestStop")} icon={<Zap />}>
            <p className="num text-4xl font-semibold text-t-purple">
              {f.seconds(fastest.stationary_s, 2)}
            </p>
            <DriverChip
              driver={fastest.driver}
              colour={fastest.colour}
              sub={`${fastest.team.name} · ${eventName(fastest.name, locale)}`}
            />
          </Tile>
        ) : (
          <Tile label={t("stops.tile.count")} icon={<Wrench />}>
            <p className="num text-4xl font-semibold">{data.stops}</p>
            <p className="text-sm text-muted">{t("stops.noStationary")}</p>
          </Tile>
        )}
        {bestTeam ? (
          <Tile label={t("stops.tile.crew")} icon={<UsersRound />}>
            <p className="num text-4xl font-semibold">
              {f.seconds(bestTeam.median_stationary_s, 2)}
            </p>
            <p className="flex items-center gap-2 text-sm">
              <span
                className="h-4 w-1.5 rounded-full"
                style={{ backgroundColor: teamColour(bestTeam.colour) }}
              />
              <span className="font-semibold">{bestTeam.team.name}</span>
              <span className="text-muted">{t("stops.medianOf", { n: bestTeam.stops })}</span>
            </p>
          </Tile>
        ) : null}
        {dearest?.pit_loss_s != null && (
          <Tile label={t("stops.tile.dearest")} icon={<Hourglass />}>
            <p className="flex items-center gap-2">
              <span className="num text-4xl font-semibold">{f.seconds(dearest.pit_loss_s, 1)}</span>
              <EngineBadge />
            </p>
            <p className="flex items-center gap-2 text-sm">
              <Flag country={dearest.country} />
              {eventName(dearest.name, locale)}
            </p>
          </Tile>
        )}
        <Tile label={t("stops.tile.undercut")} icon={<ArrowLeftRight />}>
          <p className="flex items-center gap-2">
            <span className="num text-4xl font-semibold">
              {rate === null ? "—" : f.percent(rate)}
            </span>
            <EngineBadge />
          </p>
          <p className="text-sm text-muted">
            {t("stops.undercutNote", { ok: data.undercut_successes, n: data.undercut_attempts })}
          </p>
        </Tile>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title={t("stops.fastest")} icon={<Timer />} className="self-start">
          {data.fastest.length === 0 ? (
            <p className="p-5 text-sm text-muted">{t("stops.noStationary")}</p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="data-table text-sm">
                <caption className="sr-only">{t("stops.fastest")}</caption>
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>{t("col.driver")}</th>
                    <th className="num">{t("stops.stationary")}</th>
                    <th>{t("col.grandPrix")}</th>
                    <th className="num">{t("pace.lap")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fastest.map((stop, i) => (
                    <tr key={`${stop.driver.ref}-${String(stop.session_id)}-${String(stop.lap)}`}>
                      <td className="num text-muted">{i + 1}</td>
                      <td
                        className="border-l-4"
                        style={{ borderLeftColor: teamColour(stop.colour) }}
                      >
                        <DriverChip driver={stop.driver} colour={stop.colour} size="size-7" />
                      </td>
                      <td className={`num font-semibold ${i === 0 ? "text-t-purple" : ""}`}>
                        {f.seconds(stop.stationary_s, 2)}
                      </td>
                      <td>
                        <Link
                          to={`/events/${String(stop.event_id)}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <Flag country={stop.country} />
                          <span className="truncate">{eventName(stop.name, locale)}</span>
                        </Link>
                      </td>
                      <td className="num text-muted">{stop.lap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title={t("stops.teams")} icon={<UsersRound />}>
            <div className="relative overflow-x-auto">
              <table className="data-table text-sm">
                <caption className="sr-only">{t("stops.teams")}</caption>
                <thead>
                  <tr>
                    <th>{t("col.team")}</th>
                    <th className="num">{t("stops.count")}</th>
                    <th className="min-w-32">{t("stops.medianStationary")}</th>
                    <th className="num">{t("stops.best")}</th>
                    <th className="num">{t("stops.medianLane")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teams.map((team) => (
                    <tr key={team.team.ref}>
                      <td
                        className="border-l-4"
                        style={{ borderLeftColor: teamColour(team.colour) }}
                      >
                        <TeamName team={team.team} />
                      </td>
                      <td className="num text-muted">{team.stops}</td>
                      <td>
                        {team.median_stationary_s == null ? (
                          "—"
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="num w-12 font-semibold">
                              {f.seconds(team.median_stationary_s, 2)}
                            </span>
                            <span
                              aria-hidden="true"
                              className="h-2 rounded-full"
                              style={{
                                width: `${String((team.median_stationary_s / maxStationary) * 100)}%`,
                                maxWidth: "6rem",
                                backgroundColor: teamColour(team.colour),
                              }}
                            />
                          </span>
                        )}
                      </td>
                      <td className="num text-muted">{f.seconds(team.best_stationary_s, 2)}</td>
                      <td className="num text-muted">{f.seconds(team.median_lane_s, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          {withLoss.length > 0 && (
            <Panel
              title={t("stops.loss")}
              icon={<Hourglass />}
              action={<EngineBadge />}
              bodyClassName="gap-2 p-4"
            >
              <p className="text-sm text-muted">{t("stops.lossNote")}</p>
              <p className="text-xs text-muted">{t("stops.unreliableNote")}</p>
              <LossBars
                label={t("stops.loss")}
                rows={withLoss.map((r) => ({
                  key: String(r.session_id),
                  label: eventName(r.name, locale),
                  value: r.pit_loss_s ?? 0,
                  sigma: r.pit_loss_sigma_s ?? null,
                }))}
                format={(v) => f.seconds(v, 1)}
                axisLabel={t("stops.lossAxis")}
              />
            </Panel>
          )}
        </div>
      </div>

      <Panel title={t("stops.byRace")} icon={<ListOrdered />}>
        <div className="relative overflow-x-auto">
          <table className="data-table text-sm">
            <caption className="sr-only">{t("stops.byRace")}</caption>
            <thead>
              <tr>
                <th className="num">{t("col.round")}</th>
                <th>{t("col.grandPrix")}</th>
                <th className="num">{t("stops.count")}</th>
                <th className="num">{t("stops.medianStationary")}</th>
                <th>{t("dash.fastestStop")}</th>
                <th className="num">{t("stops.lossCol")}</th>
                <th className="num">{t("stops.undercuts")}</th>
              </tr>
            </thead>
            <tbody>
              {data.races.map((race) => (
                <tr key={race.session_id}>
                  <td className="num text-muted">{race.round}</td>
                  <td>
                    <Link
                      to={`/events/${String(race.event_id)}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Flag country={race.country} />
                      <span className="truncate">{eventName(race.name, locale)}</span>
                    </Link>
                  </td>
                  <td className="num">{race.stops}</td>
                  <td className="num">{f.seconds(race.median_stationary_s, 2)}</td>
                  <td>
                    {race.fastest ? (
                      <span className="flex items-center gap-2">
                        <DriverChip
                          driver={race.fastest.driver}
                          colour={race.fastest.colour}
                          size="size-6"
                        />
                        <span className="num text-muted">
                          {f.seconds(race.fastest.stationary_s, 2)}
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className={`num ${race.pit_loss_reliable ? "" : "text-muted"}`}
                    title={race.pit_loss_reliable ? undefined : t("stops.unreliable")}
                  >
                    {race.pit_loss_s == null ? "—" : f.seconds(race.pit_loss_s, 1)}
                    {race.pit_loss_sigma_s ? (
                      <span className="text-muted"> ± {f.number(race.pit_loss_sigma_s, 1)}</span>
                    ) : null}
                    {race.pit_loss_s != null && !race.pit_loss_reliable && (
                      <span aria-label={t("stops.unreliable")}> *</span>
                    )}
                  </td>
                  <td className="num">
                    {race.undercut_attempts === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span>
                        <span className="font-semibold text-gain">{race.undercut_successes}</span>
                        <span className="text-muted"> / {race.undercut_attempts}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

import type { Schema } from "@stintline/api-types";
import {
  Flag as FlagIcon,
  ListOrdered,
  Medal,
  Play,
  Sigma,
  Swords,
  Target,
  Trophy,
} from "lucide-react";
import { Link } from "react-router";

import { Panel, Tile } from "@/components/dash/Panel";
import { type RoundBar, RoundBars } from "@/components/dash/RoundBars";
import { TeamName } from "@/components/hub/TeamName";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useDriverResults } from "@/features/hub/api";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

type Result = Schema<"DriverResult">;

/** Points of a Grand Prix win since 2010, used to scale the points bars. */
const WIN_POINTS = 25;

/** Jolpica gives retired cars an order too: only a numeric classification is a finish. */
function finish(result: Result): number | null {
  return /^\d+$/.test(result.classification ?? "") ? (result.finish_position ?? null) : null;
}

function byRound(a: Result, b: Result): number {
  return a.round - b.round || (a.kind === "SPRINT" ? -1 : 1) - (b.kind === "SPRINT" ? -1 : 1);
}

/**
 * One season of a driver as a dashboard: key figures with a bar per race, the results, where
 * the driver finished and how the season went.
 */
export function DriverSeason({
  driverRef,
  seasons,
  colour,
}: {
  driverRef: string;
  seasons: number[];
  colour: string | null | undefined;
}) {
  const { t } = useI18n();
  const [params, update] = useSearchParamsState();
  const latest = seasons[seasons.length - 1] ?? null;
  const fromUrl = intParam(params, "season");
  const season = fromUrl !== null && seasons.includes(fromUrl) ? fromUrl : latest;
  const results = useDriverResults(driverRef, season);
  const list = [...(results.data?.results ?? [])].sort(byRound);
  const ink = teamColour(colour);

  const picker = (
    <div className="flex flex-wrap items-center gap-2">
      {season !== null && (
        <Link
          to={`/analysis?mode=drivers&season=${String(season)}&a=${driverRef}`}
          className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-raised"
        >
          <Swords aria-hidden="true" className="size-4" />
          {t("driver.vsTeammate")}
        </Link>
      )}
      <Select
        label={t("season.label")}
        value={season ?? ""}
        onChange={(event) => {
          update({ season: event.target.value });
        }}
      >
        {[...seasons].reverse().map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </Select>
    </div>
  );

  if (results.isError) {
    return <ErrorState error={results.error} onRetry={() => void results.refetch()} />;
  }
  if (!results.data) return <Skeleton className="h-96" />;

  return (
    <div className="flex flex-col gap-4">
      {list.length > 0 && season !== null && (
        <SeasonTiles results={list} season={season} colour={ink} />
      )}
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          id="driver-results"
          title={t("driver.results")}
          icon={<ListOrdered />}
          action={picker}
          className="xl:col-span-2"
        >
          {list.length === 0 ? (
            <EmptyState title={t("driver.noResults")} />
          ) : (
            <ResultsTable results={[...list].reverse()} />
          )}
        </Panel>
        {list.length > 0 && (
          <div className="flex flex-col gap-4">
            <Distribution results={list} colour={ink} />
            <Performance results={list} colour={ink} />
          </div>
        )}
      </div>
    </div>
  );
}

function SeasonTiles({
  results,
  season,
  colour,
}: {
  results: readonly Result[];
  season: number;
  colour: string;
}) {
  const { t, f, locale } = useI18n();
  const races = results.filter((r) => r.kind !== "SPRINT");
  const sprints = results.filter((r) => r.kind === "SPRINT");
  const wins = races.filter((r) => finish(r) === 1).length;
  const podiums = races.filter((r) => (finish(r) ?? 99) <= 3).length;
  const sprintWins = sprints.filter((r) => finish(r) === 1).length;
  const sprintPodiums = sprints.filter((r) => (finish(r) ?? 99) <= 3).length;
  const points = results.reduce((sum, r) => sum + (r.points ?? 0), 0);
  const poles = races.filter((r) => r.grid_position === 1).length;

  const bars = (hit: (r: Result) => boolean, value?: (r: Result) => number): RoundBar[] =>
    results.map((r) => ({
      key: String(r.session_id),
      label: `${eventName(r.event_name, locale)} ${r.kind === "SPRINT" ? "sprint" : ""}`.trim(),
      kind:
        finish(r) === null && r.kind !== "SPRINT" && !value
          ? "dnf"
          : hit(r)
            ? r.kind === "SPRINT"
              ? "sprint"
              : "hit"
            : "miss",
      ...(value ? { value: value(r) } : {}),
    }));

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile label={t("driver.seasonWins", { season })} icon={<Trophy />}>
        <p className="num text-4xl font-semibold">{wins}</p>
        <p className="text-xs text-muted">{t("driver.sprintWins", { n: sprintWins })}</p>
        <RoundBars bars={bars((r) => finish(r) === 1)} colour={colour} />
      </Tile>
      <Tile label={t("driver.seasonPodiums", { season })} icon={<Medal />}>
        <p className="num text-4xl font-semibold">{podiums}</p>
        <p className="text-xs text-muted">{t("driver.sprintPodiums", { n: sprintPodiums })}</p>
        <RoundBars bars={bars((r) => (finish(r) ?? 99) <= 3)} colour={colour} />
      </Tile>
      <Tile label={t("driver.seasonPoints", { season })} icon={<Sigma />}>
        <p className="num text-4xl font-semibold">{f.number(points, points % 1 ? 1 : 0)}</p>
        <p className="text-xs text-muted">
          {t("driver.avgPoints", {
            avg: f.number(results.length ? points / results.length : 0, 1),
          })}
        </p>
        <RoundBars
          bars={bars(
            (r) => (r.points ?? 0) > 0,
            (r) => (r.points ?? 0) / WIN_POINTS,
          )}
          colour={colour}
        />
      </Tile>
      <Tile label={t("driver.seasonPoles", { season })} icon={<FlagIcon />}>
        <p className="num text-4xl font-semibold">{poles}</p>
        <p className="text-xs text-muted">{t("driver.polesFrom", { n: races.length })}</p>
        <RoundBars
          bars={races.map((r) => ({
            key: String(r.session_id),
            label: eventName(r.event_name, locale),
            kind: r.grid_position === 1 ? "hit" : "miss",
          }))}
          colour={colour}
        />
      </Tile>
    </div>
  );
}

function ResultsTable({ results }: { results: readonly Result[] }) {
  const { t, f, locale } = useI18n();
  return (
    <div className="overflow-x-auto">
      <table className="data-table text-sm">
        <thead>
          <tr>
            <th className="num">{t("col.round")}</th>
            <th>{t("col.grandPrix")}</th>
            <th className="hidden sm:table-cell">{t("col.team")}</th>
            <th className="num hidden sm:table-cell">{t("col.grid")}</th>
            <th className="num">{t("col.position")}</th>
            <th className="num">{t("col.points")}</th>
            <th>
              <span className="sr-only">{t("col.replay")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => {
            const finished = finish(result);
            return (
              <tr key={result.session_id}>
                <td className="num text-muted">{result.round}</td>
                <td>
                  <Link to={`/events/${result.event_id}`} className="font-semibold hover:underline">
                    {eventName(result.event_name, locale)}
                  </Link>
                  {result.kind === "SPRINT" && (
                    <span className="ml-2 rounded bg-t-yellow/15 px-1.5 py-0.5 text-[0.65rem] font-bold text-t-yellow">
                      {t("picker.sprint")}
                    </span>
                  )}
                  <span className="block text-xs text-muted">{f.date(result.race_date)}</span>
                </td>
                <td className="hidden sm:table-cell">
                  <TeamName team={result.team} />
                </td>
                <td className="num hidden text-muted sm:table-cell">
                  {result.grid_position === 0 ? "—" : (result.grid_position ?? "—")}
                </td>
                <td className="num">
                  {finished !== null ? (
                    <span
                      className={`inline-grid min-w-7 place-items-center rounded px-1 py-0.5 font-bold ${
                        finished === 1
                          ? "bg-t-yellow text-tyre-ink"
                          : finished <= 3
                            ? "bg-raised text-ink"
                            : ""
                      }`}
                    >
                      {finished}
                    </span>
                  ) : (
                    <span className="font-bold text-loss">{result.classification ?? "—"}</span>
                  )}
                  {finished == null && result.status && (
                    <span className="block text-xs font-normal text-muted">{result.status}</span>
                  )}
                </td>
                <td className="num font-semibold">
                  {result.points ? f.number(result.points, result.points % 1 ? 1 : 0) : ""}
                </td>
                <td className="text-right">
                  {result.has_data && (
                    <Link
                      to={`/sessions/${result.session_id}`}
                      aria-label={`${t("col.replay")} · ${eventName(result.event_name, locale)}`}
                      className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold whitespace-nowrap hover:bg-action hover:text-white"
                    >
                      <Play aria-hidden="true" className="size-3 fill-current" />
                      {t("col.replay")}
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** How often the driver finished in each place, Grands Prix only. */
function Distribution({ results, colour }: { results: readonly Result[]; colour: string }) {
  const { t, f } = useI18n();
  const places = results
    .filter((r) => r.kind !== "SPRINT")
    .map(finish)
    .filter((p): p is number => p !== null);
  if (places.length === 0) return null;
  const worst = Math.max(...places);
  const counts = Array.from({ length: worst }, (_, i) => places.filter((p) => p === i + 1).length);
  const max = Math.max(...counts);
  const average = places.reduce((a, b) => a + b, 0) / places.length;
  return (
    <Panel
      title={t("driver.distribution")}
      icon={<Target />}
      action={
        <dl className="flex gap-4 text-right">
          <div className="flex flex-col-reverse">
            <dt className="text-xs text-muted">{t("driver.best")}</dt>
            <dd className="num font-bold">P{Math.min(...places)}</dd>
          </div>
          <div className="flex flex-col-reverse">
            <dt className="text-xs text-muted">{t("driver.average")}</dt>
            <dd className="num font-bold">{f.number(average, 1)}</dd>
          </div>
        </dl>
      }
    >
      <ol className="flex flex-col gap-1 p-4">
        {counts.map((count, index) => (
          <li
            key={index}
            className="grid grid-cols-[2.25rem_minmax(0,1fr)_1.5rem] items-center gap-2"
          >
            <span className="num text-xs text-muted">P{index + 1}</span>
            <span className="h-3.5 rounded-[2px] bg-raised">
              {count > 0 && (
                <span
                  className="block h-full rounded-[2px]"
                  style={{ width: `${String((count / max) * 100)}%`, backgroundColor: colour }}
                />
              )}
            </span>
            <span className="num text-right text-xs font-semibold">{count || ""}</span>
          </li>
        ))}
      </ol>
      <p className="px-4 pb-4 text-xs text-muted">{t("driver.distributionNote")}</p>
    </Panel>
  );
}

/** Share of starts in the points, on the podium, won, and retirements. */
function Performance({ results, colour }: { results: readonly Result[]; colour: string }) {
  const { t } = useI18n();
  const races = results.filter((r) => r.kind !== "SPRINT");
  if (races.length === 0) return null;
  const rows = [
    [t("driver.inPoints"), races.filter((r) => (r.points ?? 0) > 0).length, colour],
    [t("driver.podiums"), races.filter((r) => (finish(r) ?? 99) <= 3).length, colour],
    [t("driver.wins"), races.filter((r) => finish(r) === 1).length, "var(--color-t-yellow)"],
    [t("driver.dnfs"), races.filter((r) => finish(r) === null).length, "var(--color-loss)"],
  ] as const;
  return (
    <Panel title={t("driver.performance")} icon={<Trophy />}>
      <dl className="flex flex-col gap-3 p-4">
        {rows.map(([label, count, fill]) => (
          <div key={label} className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <dt>{label}</dt>
              <dd className="num font-semibold">
                {count} / {races.length}
              </dd>
            </div>
            <span aria-hidden="true" className="h-2 rounded-full bg-raised">
              <span
                className="block h-full rounded-full"
                style={{ width: `${String((count / races.length) * 100)}%`, backgroundColor: fill }}
              />
            </span>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

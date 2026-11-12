import type { Schema } from "@stintline/api-types";
import { Crosshair, Grid3x3, ListOrdered, Shuffle, Sparkles, TrendingDown } from "lucide-react";
import { Link } from "react-router";

import { Panel, Tile } from "@/components/dash/Panel";
import { RoundBars } from "@/components/dash/RoundBars";
import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { Flag } from "@/components/racing/Flag";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { ApiError } from "@/lib/errors";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import { useConsistency } from "../api";
import { median, quantile } from "../duel";
import { FIRST_TIMED_SEASON, driverLabel, useSeasonParam } from "../season";
import { AnalysisTabs, DriverChip, EngineBadge } from "./common";

type Line = Schema<"Consistency">;
type Race = Line["races"][number];

/** Strongest tint of the heatmap: keeps the figure in the cell readable in both themes. */
const HEAT_MAX_PCT = 65;
/** Share of the figures below the top of the colour and bar scales. */
const SCALE_QUANTILE = 0.9;

export function ConsistencyPage() {
  const { t } = useI18n();
  const [year, setYear] = useSeasonParam();
  return (
    <div className="flex flex-col">
      <PageHeader
        title={year ? t("cons.titleOf", { year }) : t("cons.title")}
        actions={<SeasonSelect value={year} onChange={setYear} />}
      >
        {t("cons.intro")}
      </PageHeader>
      <AnalysisTabs />
      {year === null ? <Skeleton className="h-[60vh]" /> : <Consistency year={year} />}
    </div>
  );
}

function Consistency({ year }: { year: number }) {
  const { t } = useI18n();
  const lines = useConsistency(year);
  if (
    year < FIRST_TIMED_SEASON ||
    (lines.error instanceof ApiError && lines.error.status === 404)
  ) {
    return <EmptyState title={t("cons.empty")} />;
  }
  if (lines.isError) return <ErrorState error={lines.error} onRetry={() => void lines.refetch()} />;
  if (!lines.data) return <Skeleton className="h-[60vh]" />;
  return <ConsistencyView lines={lines.data} />;
}

function ConsistencyView({ lines }: { lines: readonly Line[] }) {
  const { t, f, locale } = useI18n();
  const rounds = new Map<number, Race>();
  for (const line of lines) for (const race of line.races) rounds.set(race.round, race);
  const columns = [...rounds.values()].sort((a, b) => a.round - b.round);
  const all = lines.flatMap((l) =>
    l.races.map((r) => r.spread_s).filter((v): v is number => v != null),
  );
  // A wet race or a red flag gives a few huge figures: the scale stops at the 90th percentile.
  const max = Math.max(quantile(all, SCALE_QUANTILE) ?? 0, 0.01);
  const fieldMedian = median(all);

  const raceMedians = columns
    .map((race) => ({
      race,
      value: median(
        lines.flatMap((l) =>
          l.races
            .filter((r) => r.round === race.round && r.spread_s != null)
            .map((r) => r.spread_s ?? 0),
        ),
      ),
    }))
    .filter((r): r is { race: Race; value: number } => r.value !== null);
  const calmest = [...raceMedians].sort((a, b) => a.value - b.value)[0];
  const wildest = [...raceMedians].sort((a, b) => b.value - a.value)[0];
  const best = lines[0];
  const singleBest = lines
    .flatMap((l) => l.races.map((r) => ({ line: l, race: r })))
    .filter((x) => x.race.spread_s != null && x.race.clean_laps >= 20)
    .sort((a, b) => (a.race.spread_s ?? 0) - (b.race.spread_s ?? 0))[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {best && (
          <Tile label={t("cons.tile.best")} icon={<Crosshair />}>
            <p className="flex items-center gap-2">
              <span className="num text-4xl font-semibold">
                {f.seconds(best.median_spread_s, 3)}
              </span>
              <EngineBadge />
            </p>
            <DriverChip driver={best.driver} colour={best.colour} sub={best.team.name} />
          </Tile>
        )}
        {singleBest && (
          <Tile label={t("cons.tile.single")} icon={<Sparkles />}>
            <p className="num text-4xl font-semibold text-t-purple">
              {f.seconds(singleBest.race.spread_s, 3)}
            </p>
            <DriverChip
              driver={singleBest.line.driver}
              colour={singleBest.line.colour}
              sub={t("cons.overLaps", {
                race: eventName(singleBest.race.name, locale),
                n: singleBest.race.clean_laps,
              })}
            />
          </Tile>
        )}
        {calmest && (
          <Tile label={t("cons.tile.calm")} icon={<TrendingDown />}>
            <p className="num text-4xl font-semibold">{f.seconds(calmest.value, 3)}</p>
            <p className="flex items-center gap-2 text-sm">
              <Flag country={calmest.race.country} />
              {eventName(calmest.race.name, locale)}
            </p>
          </Tile>
        )}
        {wildest && (
          <Tile label={t("cons.tile.wild")} icon={<Shuffle />}>
            <p className="num text-4xl font-semibold text-loss">{f.seconds(wildest.value, 3)}</p>
            <p className="flex items-center gap-2 text-sm">
              <Flag country={wildest.race.country} />
              {eventName(wildest.race.name, locale)}
            </p>
          </Tile>
        )}
      </div>

      <Panel title={t("cons.ranking")} icon={<ListOrdered />} action={<EngineBadge />}>
        <div className="relative overflow-x-auto">
          <table className="data-table text-sm">
            <caption className="sr-only">{t("cons.ranking")}</caption>
            <thead>
              <tr>
                <th className="num">{t("col.position")}</th>
                <th>{t("col.driver")}</th>
                <th className="num">{t("cons.median")}</th>
                <th className="min-w-40">{t("cons.byRace")}</th>
                <th>{t("cons.bestRace")}</th>
                <th>{t("cons.worstRace")}</th>
                <th className="num">{t("cons.races")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={line.driver.ref}>
                  <td className="num font-bold">{i + 1}</td>
                  <td className="border-l-4" style={{ borderLeftColor: teamColour(line.colour) }}>
                    <DriverChip driver={line.driver} colour={line.colour} size="size-7" />
                  </td>
                  <td className="num font-semibold">{f.seconds(line.median_spread_s, 3)}</td>
                  <td>
                    <RoundBars
                      colour={teamColour(line.colour)}
                      bars={columns.map((c) => {
                        const race = line.races.find((r) => r.round === c.round);
                        return race?.spread_s == null
                          ? {
                              key: String(c.round),
                              kind: "miss" as const,
                              label: eventName(c.name, locale),
                            }
                          : {
                              key: String(c.round),
                              kind: "hit" as const,
                              value: Math.min(1, race.spread_s / max),
                              label: `${eventName(c.name, locale)}: ${f.seconds(race.spread_s, 3)}`,
                            };
                      })}
                    />
                  </td>
                  <RaceCell race={line.best} />
                  <RaceCell race={line.worst} />
                  <td className="num text-muted">{line.races.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-xs text-muted">
          {t("cons.note", { median: f.seconds(fieldMedian, 3) })}
        </p>
      </Panel>

      <Panel title={t("cons.map")} icon={<Grid3x3 />} bodyClassName="gap-3 p-4">
        <p className="text-sm text-muted">{t("cons.mapNote")}</p>
        <div className="relative overflow-x-auto">
          <table className="w-full border-separate border-spacing-0.5 text-xs">
            <caption className="sr-only">{t("cons.map")}</caption>
            <thead>
              <tr>
                <th className="sticky left-0 bg-panel" />
                {columns.map((c) => (
                  <th
                    key={c.round}
                    scope="col"
                    className="px-0.5 font-normal"
                    title={eventName(c.name, locale)}
                  >
                    <Link
                      to={`/analysis/pace?session=${String(c.session_id)}`}
                      className="flex justify-center"
                    >
                      <Flag country={c.country} />
                      <span className="sr-only">{eventName(c.name, locale)}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.driver.ref}>
                  <th scope="row" className="sticky left-0 bg-panel pr-2 text-left font-bold">
                    {driverLabel(line.driver)}
                  </th>
                  {columns.map((c) => {
                    const race = line.races.find((r) => r.round === c.round);
                    const value = race?.spread_s;
                    return (
                      <td
                        key={c.round}
                        className="num h-7 min-w-9 rounded-[3px] text-center text-[0.65rem]"
                        style={
                          value == null
                            ? { backgroundColor: "var(--color-raised)" }
                            : {
                                backgroundColor: `color-mix(in oklab, var(--color-t-blue) ${String(
                                  Math.round(Math.min(1, value / max) * HEAT_MAX_PCT),
                                )}%, var(--color-panel))`,
                              }
                        }
                        title={
                          value == null
                            ? undefined
                            : `${eventName(c.name, locale)}: ${f.seconds(value, 3)}`
                        }
                      >
                        {value == null ? "" : f.number(value, 2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function RaceCell({ race }: { race: Schema<"SpreadRace"> }) {
  const { f, locale } = useI18n();
  return (
    <td>
      <Link
        to={`/analysis/pace?session=${String(race.session_id)}`}
        className="flex items-center gap-2 hover:underline"
      >
        <Flag country={race.country} />
        <span className="truncate">{eventName(race.name, locale)}</span>
        <span className="num text-muted">{f.seconds(race.spread_s, 2)}</span>
      </Link>
    </td>
  );
}

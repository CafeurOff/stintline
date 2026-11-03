import { useNavigate, useParams } from "react-router";

import { DriverName } from "@/components/hub/DriverName";
import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { TeamName } from "@/components/hub/TeamName";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useProgression, useStandings } from "@/features/hub/api";
import { useCurrentSeason } from "@/features/hub/useCurrentSeason";
import { ApiError } from "@/lib/errors";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

import { ProgressionChart } from "./ProgressionChart";

/** Lines drawn on the chart: the title fight, not the whole grid. */
const CHART_LINES = 10;

export function StandingsPage() {
  const params = useParams();
  const current = useCurrentSeason();
  const year = params.year && /^\d{4}$/.test(params.year) ? Number(params.year) : current.season;
  if (year === null) return <Skeleton className="h-[60vh]" />;
  return <Standings key={year} year={year} />;
}

function Standings({ year }: { year: number }) {
  const { t, f, locale } = useI18n();
  const navigate = useNavigate();
  const [params, update] = useSearchParamsState();
  const table = params.get("table") === "constructors" ? "constructors" : "drivers";
  const standings = useStandings(year, intParam(params, "round"));
  const progression = useProgression(year);

  const notFound = standings.error instanceof ApiError && standings.error.status === 404;
  const names = new Map((progression.data?.rounds ?? []).map((r) => [r.round, r.name]));
  const lines =
    progression.data === undefined
      ? []
      : table === "drivers"
        ? progression.data.drivers.slice(0, CHART_LINES).map((line) => ({
            key: line.driver.ref,
            label: line.driver.code ?? line.driver.family_name,
            colour: line.colour,
            points: line.points,
          }))
        : progression.data.constructors.slice(0, CHART_LINES).map((line) => ({
            key: line.team.ref,
            label: line.team.name,
            colour: line.colour,
            points: line.points,
          }));
  const rounds = (progression.data?.rounds ?? []).map((r) => r.round);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("standings.title", { year })}
        actions={
          <SeasonSelect
            value={year}
            onChange={(value) => {
              if (value !== null) void navigate(`/standings/${value}`);
            }}
          />
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SegmentedControl
          legend={t("standings.table")}
          hideLegend
          options={[
            { value: "drivers", label: t("standings.drivers") },
            { value: "constructors", label: t("standings.constructors") },
          ]}
          value={table}
          onChange={(value) => {
            update({ table: value === "drivers" ? null : value });
          }}
        />
        {standings.data && standings.data.rounds.length > 1 && (
          <Select
            label={t("standings.after")}
            value={standings.data.round ?? ""}
            onChange={(event) => {
              update({ round: event.target.value });
            }}
          >
            {[...standings.data.rounds].reverse().map((round) => (
              <option key={round} value={round}>
                {t("standings.afterRound", {
                  round,
                  name: eventName(names.get(round) ?? "", locale),
                })}
              </option>
            ))}
          </Select>
        )}
      </div>

      {notFound ? (
        <EmptyState title={t("standings.empty")} />
      ) : standings.isError ? (
        <ErrorState error={standings.error} onRetry={() => void standings.refetch()} />
      ) : !standings.data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">
                {table === "drivers" ? t("standings.drivers") : t("standings.constructors")}
              </caption>
              <thead>
                <tr>
                  <th className="num">{t("col.position")}</th>
                  <th>{table === "drivers" ? t("col.driver") : t("col.team")}</th>
                  <th className="num">{t("driver.wins")}</th>
                  <th className="num">{t("col.points")}</th>
                </tr>
              </thead>
              <tbody>
                {(table === "drivers" ? standings.data.drivers : standings.data.constructors).map(
                  (line) => (
                    <tr key={line.driver?.ref ?? line.team?.ref}>
                      <td className="num font-bold">
                        {line.position_text === ""
                          ? line.position
                          : (line.position_text ?? line.position)}
                      </td>
                      <td>
                        {line.driver ? (
                          <DriverName driver={line.driver} avatar="xs" />
                        ) : line.team ? (
                          <TeamName team={line.team} />
                        ) : null}
                      </td>
                      <td className="num">{line.wins === 0 ? "" : line.wins}</td>
                      <td className="num font-semibold">
                        {f.number(line.points ?? 0, (line.points ?? 0) % 1 ? 1 : 0)}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          {rounds.length > 1 && (
            <section aria-labelledby="standings-chart" className="flex min-w-0 flex-col gap-2">
              <h2 id="standings-chart" className="text-xl font-bold">
                {t("standings.chart")}
              </h2>
              <p className="text-sm text-muted">{t("standings.chartNote", { n: CHART_LINES })}</p>
              <ProgressionChart
                lines={lines}
                rounds={rounds}
                label={t("standings.chartLabel", { year })}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

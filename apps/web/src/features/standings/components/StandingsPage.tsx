import type { Schema } from "@stintline/api-types";
import { Link, useNavigate, useParams } from "react-router";

import { ChartLine, PieChart, Trophy } from "lucide-react";

import { NO_BACKDROP } from "@/components/dash/backdrop";
import { Face } from "@/components/dash/Face";
import { Move } from "@/components/dash/Move";
import { Panel } from "@/components/dash/Panel";
import { DriverName } from "@/components/hub/DriverName";
import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { TeamName } from "@/components/hub/TeamName";
import { initials } from "@/components/racing/initials";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useProgression, useStandings } from "@/features/hub/api";
import { useCurrentSeason } from "@/features/hub/useCurrentSeason";
import { ApiError } from "@/lib/errors";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { teamColour, teamTint } from "@/lib/teams";
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
  const shownRound = standings.data?.round ?? null;
  const moveAt = (positions: readonly (number | null)[]) => {
    const index = shownRound === null ? positions.length - 1 : rounds.indexOf(shownRound);
    const now = positions[index];
    const before = positions[index - 1];
    return now == null || before == null ? 0 : before - now;
  };
  const moves = new Map(
    table === "drivers"
      ? (progression.data?.drivers ?? []).map((d) => [d.driver.ref, moveAt(d.positions)] as const)
      : (progression.data?.constructors ?? []).map(
          (c) => [c.team.ref, moveAt(c.positions)] as const,
        ),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("standings.title", { year })}
        actions={
          <>
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
            <SeasonSelect
              value={year}
              onChange={(value) => {
                if (value !== null) void navigate(`/standings/${value}`);
              }}
            />
          </>
        }
      />

      {notFound ? (
        <EmptyState title={t("standings.empty")} />
      ) : standings.isError ? (
        <ErrorState error={standings.error} onRetry={() => void standings.refetch()} />
      ) : !standings.data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="flex flex-col gap-4">
          <Leaders
            lines={table === "drivers" ? standings.data.drivers : standings.data.constructors}
          />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Panel
              title={table === "drivers" ? t("standings.drivers") : t("standings.constructors")}
              icon={<Trophy />}
              className="self-start"
            >
              <div className="overflow-x-auto">
                <table className="data-table text-sm">
                  <caption className="sr-only">
                    {table === "drivers" ? t("standings.drivers") : t("standings.constructors")}
                  </caption>
                  <thead>
                    <tr>
                      <th className="num">{t("col.position")}</th>
                      <th>{table === "drivers" ? t("col.driver") : t("col.team")}</th>
                      <th className="num">{t("driver.wins")}</th>
                      <th className="num">{t("col.points")}</th>
                      <th className="num">{t("standings.gap")}</th>
                      <th className="num">{t("dash.evo")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(table === "drivers"
                      ? standings.data.drivers
                      : standings.data.constructors
                    ).map((line, index, all) => (
                      <tr key={line.driver?.ref ?? line.team?.ref}>
                        <td className="num font-bold">
                          {line.position_text === ""
                            ? line.position
                            : (line.position_text ?? line.position)}
                        </td>
                        <td
                          className="border-l-4"
                          style={{ borderLeftColor: teamColour(line.colour) }}
                        >
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
                        <td className="num text-muted">
                          {index === 0
                            ? ""
                            : `−${f.number((all[0]?.points ?? 0) - (line.points ?? 0), 0)}`}
                        </td>
                        <td className="num">
                          <Move value={moves.get(line.driver?.ref ?? line.team?.ref ?? "") ?? 0} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <div className="flex min-w-0 flex-col gap-4 self-start xl:sticky xl:top-20">
              {rounds.length > 1 && (
                <Panel
                  id="standings-chart"
                  title={t("standings.chart")}
                  icon={<ChartLine />}
                  bodyClassName="gap-2 p-5"
                >
                  <p className="text-sm text-muted">
                    {t("standings.chartNote", { n: CHART_LINES })}
                  </p>
                  <ProgressionChart
                    lines={lines}
                    rounds={rounds}
                    label={t("standings.chartLabel", { year })}
                  />
                </Panel>
              )}
              <PointsShare
                lines={table === "drivers" ? standings.data.drivers : standings.data.constructors}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The top three as broadcast cards: photo or team colour, points and gap to the leader. */
function Leaders({ lines }: { lines: readonly Schema<"StandingLine">[] }) {
  const { t, f } = useI18n();
  const top = lines.slice(0, 3);
  const leader = top[0]?.points ?? 0;
  if (top.length === 0) return null;
  return (
    <ol aria-label={t("standings.leaders")} className="grid gap-4 sm:grid-cols-3">
      {top.map((line, index) => {
        const colour = line.colour;
        const driver = line.driver;
        const href = driver ? `/drivers/${driver.ref}` : `/teams/${line.team?.ref ?? ""}`;
        return (
          <li key={driver?.ref ?? line.team?.ref ?? index}>
            <Link
              to={href}
              className="group relative flex h-36 overflow-hidden rounded-xl border border-line transition-colors hover:border-line-strong"
              style={{ backgroundColor: teamTint(colour, 26) }}
            >
              <span className="relative z-10 flex flex-1 flex-col justify-between p-4">
                <span>
                  <span className="num text-4xl leading-none font-semibold">{index + 1}</span>
                  <span className="mt-1 block text-xl leading-tight font-extrabold group-hover:underline">
                    {driver ? driver.family_name : line.team?.name}
                  </span>
                </span>
                <span className="text-sm">
                  <span className="num font-semibold">{f.number(line.points ?? 0, 0)}</span>{" "}
                  <span className="text-muted">
                    {t("standings.pts")}
                    {index > 0 && ` · −${f.number(leader - (line.points ?? 0), 0)}`}
                    {(line.wins ?? 0) > 0 && ` · ${t("standings.winsN", { n: line.wins ?? 0 })}`}
                  </span>
                </span>
              </span>
              {driver ? (
                <Face
                  url={driver.photo_url}
                  label={driver.code ?? initials(driver.given_name, driver.family_name)}
                  colour={colour}
                  className="h-full w-32 shrink-0"
                  style={NO_BACKDROP}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="absolute top-0 right-0 h-full w-2"
                  style={{ backgroundColor: teamColour(colour) }}
                />
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** Share of all points scored so far: one bar, one segment per driver or team. */
function PointsShare({ lines }: { lines: readonly Schema<"StandingLine">[] }) {
  const { t, f } = useI18n();
  const total = lines.reduce((sum, line) => sum + (line.points ?? 0), 0);
  if (total <= 0) return null;
  const top = lines.slice(0, 8);
  const rest = total - top.reduce((sum, line) => sum + (line.points ?? 0), 0);
  const name = (line: Schema<"StandingLine">) =>
    line.driver ? line.driver.family_name : (line.team?.name ?? "");
  return (
    <Panel
      title={t("standings.share")}
      icon={<PieChart />}
      action={
        <span className="num text-sm text-muted">
          {t("standings.total", { points: f.number(total, 0) })}
        </span>
      }
      bodyClassName="gap-4 p-5"
    >
      <div aria-hidden="true" className="flex h-4 overflow-hidden rounded-full bg-raised">
        {top.map((line) => (
          <span
            key={name(line)}
            className="h-full border-r-2 border-panel"
            style={{
              width: `${String(((line.points ?? 0) / total) * 100)}%`,
              backgroundColor: teamColour(line.colour),
            }}
          />
        ))}
      </div>
      <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {top.map((line) => (
          <li key={name(line)} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: teamColour(line.colour) }}
            />
            <span className="min-w-0 flex-1 truncate">{name(line)}</span>
            <span className="num text-muted">{f.percent((line.points ?? 0) / total)}</span>
          </li>
        ))}
        {rest > 0 && (
          <li className="flex items-center gap-2 text-muted">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm bg-raised" />
            <span className="flex-1">{t("standings.others")}</span>
            <span className="num">{f.percent(rest / total)}</span>
          </li>
        )}
      </ol>
    </Panel>
  );
}

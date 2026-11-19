import type { Schema } from "@stintline/api-types";
import {
  Battery,
  Cog,
  FileText,
  Gauge,
  Layers,
  ListOrdered,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { Link } from "react-router";

import { Panel, Tile } from "@/components/dash/Panel";
import { RoundBars } from "@/components/dash/RoundBars";
import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { Flag } from "@/components/racing/Flag";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { DriverChip } from "@/features/insights/components/common";
import { useSeasonParam } from "@/features/insights/season";
import { PenaltyTags } from "@/features/paddock/components/PenaltyTags";
import { ApiError } from "@/lib/errors";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/en";
import { teamColour, teamTint } from "@/lib/teams";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

import { useIncidents, usePowerUnits, useUpgrades } from "../api";
import { CarDiagram } from "./CarDiagram";

type Tab = "upgrades" | "power-units" | "incidents";
const TABS: readonly Tab[] = ["upgrades", "power-units", "incidents"];
type Upgrades = Schema<"Upgrades">;
type PowerUnits = Schema<"PowerUnits">;
type Incidents = Schema<"Incidents">;

/** Strongest team tint in the upgrades heatmap: the count stays readable on it. */
const HEAT_MAX_PCT = 70;

export function TechnicalPage() {
  const { t } = useI18n();
  const [year, setYear] = useSeasonParam();
  const [params, update] = useSearchParamsState();
  const tab = TABS.find((x) => x === params.get("tab")) ?? "upgrades";
  return (
    <div className="flex flex-col">
      <PageHeader
        title={t("tech.title")}
        actions={
          <>
            <SegmentedControl
              legend={t("tech.tab")}
              hideLegend
              options={TABS.map((value) => ({ value, label: t(`tech.tab.${value}`) }))}
              value={tab}
              onChange={(value) => {
                update({ tab: value === "upgrades" ? null : value, team: null, round: null });
              }}
            />
            <SeasonSelect
              value={year}
              onChange={(value) => {
                update({ team: null, round: null });
                setYear(value);
              }}
            />
          </>
        }
      >
        {t("tech.intro")}
      </PageHeader>
      {year === null ? (
        <Skeleton className="h-[60vh]" />
      ) : tab === "upgrades" ? (
        <UpgradesTab year={year} />
      ) : tab === "power-units" ? (
        <PowerUnitsTab year={year} />
      ) : (
        <IncidentsTab year={year} />
      )}
    </div>
  );
}

function Loading<T>({
  query,
  empty,
  children,
}: {
  query: { data: T | undefined; error: unknown; isError: boolean; refetch: () => unknown };
  empty: string;
  children: (data: T) => React.ReactNode;
}) {
  if (query.error instanceof ApiError && query.error.status === 404) {
    return <EmptyState title={empty} />;
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data === undefined) return <Skeleton className="h-[60vh]" />;
  return <>{children(query.data)}</>;
}

// ---------------------------------------------------------------------- upgrades

function UpgradesTab({ year }: { year: number }) {
  const { t } = useI18n();
  const query = useUpgrades(year);
  return (
    <Loading query={query} empty={t("tech.upgrades.empty")}>
      {(data) => <UpgradesView data={data} />}
    </Loading>
  );
}

function teamKey(team: Upgrades["teams"][number]): string {
  return team.team?.ref ?? team.team_name;
}

function UpgradesView({ data }: { data: Upgrades }) {
  const { t, f, locale } = useI18n();
  const [params, update] = useSearchParamsState();
  const maxCount = Math.max(1, ...data.teams.flatMap((team) => team.cells.map((c) => c.count)));
  const busiest = [
    ...data.teams.flatMap((team) => team.cells.map((cell) => ({ team, cell }))),
  ].sort((a, b) => b.cell.count - a.cell.count || b.cell.round - a.cell.round)[0];
  const chosenTeam = params.get("team") ?? (busiest ? teamKey(busiest.team) : null);
  const chosenRound = intParam(params, "round") ?? busiest?.cell.round ?? null;
  const team = data.teams.find((x) => teamKey(x) === chosenTeam) ?? busiest?.team;
  const cell = team?.cells.find((c) => c.round === chosenRound) ?? team?.cells.at(-1);
  const items =
    team && cell
      ? data.upgrades.filter(
          (u) => u.event_id === cell.event_id && (u.team_ref ?? u.team_name) === teamKey(team),
        )
      : [];
  const performance = data.upgrades.filter((u) => u.reason === "performance").length;
  const gains = data.teams
    .flatMap((x) =>
      x.cells.map((c) => ({
        team: x,
        cell: c,
        delta:
          c.pace_before_pct != null && c.pace_after_pct != null
            ? c.pace_after_pct - c.pace_before_pct
            : null,
      })),
    )
    .filter(
      (g): g is { team: typeof g.team; cell: typeof g.cell; delta: number } => g.delta !== null,
    )
    .sort((a, b) => a.delta - b.delta);
  const bestGain = gains[0];
  const roundName = (round: number) => {
    const ref = data.rounds.find((r) => r.round === round);
    return ref ? eventName(ref.name, locale) : String(round);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tile label={t("tech.tile.upgrades")} icon={<Layers />}>
          <p className="num display text-4xl">{data.upgrades.length}</p>
          <p className="text-sm text-muted">
            {t("tech.tile.upgradesNote", { n: data.rounds.length })}
          </p>
        </Tile>
        <Tile label={t("tech.tile.busiest")} icon={<Wrench />}>
          <p className="num display text-4xl">{data.teams[0]?.upgrades ?? 0}</p>
          <p className="flex items-center gap-2 text-sm">
            <span
              className="h-4 w-1.5 rounded-full"
              style={{ backgroundColor: teamColour(data.teams[0]?.colour) }}
            />
            <span className="font-semibold">
              {data.teams[0]?.team?.name ?? data.teams[0]?.team_name}
            </span>
          </p>
        </Tile>
        <Tile label={t("tech.tile.performance")} icon={<Sparkles />}>
          <p className="num display text-4xl">
            {data.upgrades.length ? f.percent(performance / data.upgrades.length) : "—"}
          </p>
          <p className="text-sm text-muted">{t("tech.tile.performanceNote")}</p>
        </Tile>
        <Tile label={t("tech.tile.gain")} icon={<Gauge />}>
          {bestGain ? (
            <>
              <p className="flex items-center gap-2">
                <span
                  className={`num display text-4xl ${bestGain.delta < 0 ? "text-gain" : "text-loss"}`}
                >
                  {f.number(bestGain.delta, 2)} %
                </span>
              </p>
              <p className="text-sm text-muted">
                {(bestGain.team.team?.name ?? bestGain.team.team_name) +
                  " · " +
                  roundName(bestGain.cell.round)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">{t("tech.tile.gainNone")}</p>
          )}
        </Tile>
      </div>

      <Panel title={t("tech.heatmap")} icon={<Layers />} bodyClassName="gap-2 p-4">
        <p className="text-sm text-muted">{t("tech.heatmapNote")}</p>
        <div className="relative overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-xs">
            <caption className="sr-only">{t("tech.heatmap")}</caption>
            <thead>
              <tr>
                <th className="sticky left-0 bg-panel" />
                {data.rounds.map((round) => (
                  <th
                    key={round.round}
                    scope="col"
                    className="font-normal"
                    title={eventName(round.name, locale)}
                  >
                    <span className="flex flex-col items-center gap-0.5">
                      <Flag country={round.country} />
                      <span className="num text-muted">{round.round}</span>
                      <span className="sr-only">{eventName(round.name, locale)}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.teams.map((row) => (
                <tr key={teamKey(row)}>
                  <th
                    scope="row"
                    className="sticky left-0 bg-panel pr-2 text-left font-semibold whitespace-nowrap"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-4 w-1.5 rounded-full"
                        style={{ backgroundColor: teamColour(row.colour) }}
                      />
                      {row.team?.name ?? row.team_name}
                    </span>
                  </th>
                  {data.rounds.map((round) => {
                    const c = row.cells.find((x) => x.round === round.round);
                    const active =
                      team && teamKey(team) === teamKey(row) && cell?.round === round.round;
                    return (
                      <td key={round.round} className="p-0">
                        {c ? (
                          <button
                            type="button"
                            aria-pressed={Boolean(active)}
                            aria-label={t("tech.cell", {
                              team: row.team?.name ?? row.team_name,
                              race: eventName(round.name, locale),
                              n: c.count,
                            })}
                            onClick={() => {
                              update({ team: teamKey(row), round: round.round });
                            }}
                            className={`num grid h-8 w-full min-w-9 place-items-center rounded-md font-semibold ${
                              active ? "outline-2 outline-offset-1 outline-ink" : ""
                            }`}
                            style={{
                              backgroundColor: teamTint(
                                row.colour,
                                Math.round((c.count / maxCount) * HEAT_MAX_PCT) + 15,
                              ),
                            }}
                          >
                            {c.count}
                          </button>
                        ) : (
                          <span className="block h-8 w-full min-w-9 rounded-md bg-raised/60" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {team && cell && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Panel
            title={`${team.team?.name ?? team.team_name} · ${roundName(cell.round)}`}
            icon={<Cog />}
            bodyClassName="items-center gap-4 p-5"
          >
            <CarDiagram
              zones={new Set(items.map((u) => u.zone))}
              colour={team.colour}
              className="h-80 w-auto"
            />
            <PaceShift cell={cell} />
          </Panel>
          <Panel
            title={t("tech.parts", { n: items.length })}
            icon={<ListOrdered />}
            action={
              items[0] && (
                <Link
                  to={`/documents?season=${String(data.season)}&event=${String(items[0].event_id)}&doc=${String(items[0].document_id)}`}
                  className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
                >
                  <FileText aria-hidden="true" className="size-4" /> {t("tech.document")}
                </Link>
              )
            }
          >
            <ul className="flex flex-col divide-y divide-line">
              {items.map((u) => (
                <li key={u.id} className="flex flex-col gap-1.5 px-5 py-4">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="num grid size-6 place-items-center rounded-md bg-raised text-xs font-bold">
                      {u.number}
                    </span>
                    <span className="font-semibold">{u.component}</span>
                    <ReasonTag reason={u.reason} detail={u.reason_detail} />
                    <span className="text-xs text-muted">
                      {t(`tech.zone.${u.zone}` as MessageKey)}
                    </span>
                  </p>
                  {u.difference && <p className="text-sm">{u.difference}</p>}
                  {u.description && <p className="text-sm text-muted">{u.description}</p>}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}

const REASON_TONE: Record<string, string> = {
  performance: "bg-gain/15 text-gain",
  circuit: "bg-t-blue/15 text-t-blue",
  reliability: "bg-t-yellow/15 text-t-yellow",
  other: "bg-raised text-muted",
};

function ReasonTag({ reason, detail }: { reason: string; detail: string }) {
  const { t } = useI18n();
  const key = (["performance", "circuit", "reliability"].includes(reason) ? reason : "other") as
    "performance" | "circuit" | "reliability" | "other";
  return (
    <span
      title={detail}
      className={`rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase ${REASON_TONE[key] ?? ""}`}
    >
      {t(`tech.reason.${key}`)}
    </span>
  );
}

function PaceShift({ cell }: { cell: Upgrades["teams"][number]["cells"][number] }) {
  const { t, f } = useI18n();
  const before = cell.pace_before_pct;
  const after = cell.pace_after_pct;
  if (before == null || after == null) {
    return <p className="text-center text-sm text-muted">{t("tech.paceUnknown")}</p>;
  }
  const delta = after - before;
  return (
    <section aria-label={t("tech.pace")} className="flex w-full flex-col gap-2">
      <p className="flex items-center justify-between text-sm font-semibold">{t("tech.pace")}</p>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-raised p-2">
          <dt className="text-xs text-muted">{t("tech.before", { n: cell.races_before })}</dt>
          <dd className="num font-semibold">{f.number(before, 2)} %</dd>
        </div>
        <div className="rounded-lg bg-raised p-2">
          <dt className="text-xs text-muted">{t("tech.after", { n: cell.races_after })}</dt>
          <dd className="num font-semibold">{f.number(after, 2)} %</dd>
        </div>
        <div className="rounded-lg bg-raised p-2">
          <dt className="text-xs text-muted">{t("tech.shift")}</dt>
          <dd className={`num font-semibold ${delta < 0 ? "text-gain" : "text-loss"}`}>
            {delta > 0 ? "+" : ""}
            {f.number(delta, 2)} %
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted">{t("tech.paceNote")}</p>
    </section>
  );
}

// ------------------------------------------------------------------ power units

function PowerUnitsTab({ year }: { year: number }) {
  const { t } = useI18n();
  const query = usePowerUnits(year);
  return (
    <Loading query={query} empty={t("tech.pu.empty")}>
      {(data) => <PowerUnitsView data={data} />}
    </Loading>
  );
}

function PowerUnitsView({ data }: { data: PowerUnits }) {
  const { t, locale } = useI18n();
  const beyond = data.cars.filter((c) => c.over.length > 0 || c.beyond > 0);
  const total = (c: PowerUnits["cars"][number]) => Object.values(c.used).reduce((a, b) => a + b, 0);
  const most = [...data.cars].sort((a, b) => total(b) - total(a))[0];
  const nonCompliant = data.cars.reduce((sum, c) => sum + c.beyond, 0);
  const changes = data.cars
    .flatMap((c) => c.changes.map((change) => ({ car: c, change })))
    .sort((a, b) => b.change.round - a.change.round);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tile label={t("tech.pu.asOf")} icon={<FileText />}>
          <p className="num display text-4xl">{t("tech.round", { n: data.as_of.round })}</p>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Flag country={data.as_of.country} />
            {eventName(data.as_of.name, locale)}
          </p>
        </Tile>
        <Tile label={t("tech.pu.beyond")} icon={<TriangleAlert />}>
          <p className="num display text-4xl text-loss">{beyond.length}</p>
          <p className="text-sm text-muted">{t("tech.pu.beyondNote")}</p>
        </Tile>
        <Tile label={t("tech.pu.most")} icon={<Battery />}>
          <p className="num display text-4xl">{most ? total(most) : "—"}</p>
          {most?.driver && <DriverChip driver={most.driver} colour={most.colour} size="size-7" />}
        </Tile>
        <Tile label={t("tech.pu.nonCompliant")} icon={<ShieldAlert />}>
          <p className="num display text-4xl">{nonCompliant}</p>
          <p className="text-sm text-muted">{t("tech.pu.nonCompliantNote")}</p>
        </Tile>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title={t("tech.pu.matrix")}
          icon={<Battery />}
          action={
            <Link
              to={`/documents?season=${String(data.season)}&event=${String(data.as_of.event_id)}&doc=${String(data.document_id)}`}
              className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
            >
              <FileText aria-hidden="true" className="size-4" /> {t("tech.document")}
            </Link>
          }
        >
          <div className="relative overflow-x-auto">
            <table className="data-table text-sm">
              <caption className="sr-only">{t("tech.pu.matrix")}</caption>
              <thead>
                <tr>
                  <th>{t("col.driver")}</th>
                  {data.elements.map((e) => (
                    <th key={e} className="num" title={t(`tech.element.${e}` as MessageKey)}>
                      {e}
                      {data.allowed[e] !== undefined && (
                        <span className="block text-[0.65rem] text-muted normal-case">
                          {t("tech.pu.allowed", { n: data.allowed[e] ?? 0 })}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.cars.map((car) => (
                  <tr key={car.car_number}>
                    <td className="border-l-4" style={{ borderLeftColor: teamColour(car.colour) }}>
                      {car.driver ? (
                        <DriverChip driver={car.driver} colour={car.colour} size="size-7" compact />
                      ) : (
                        car.team_and_driver
                      )}
                    </td>
                    {data.elements.map((e) => {
                      const used = car.used[e];
                      const allowed = data.allowed[e];
                      const state =
                        used === undefined || allowed === undefined
                          ? "plain"
                          : used > allowed
                            ? "over"
                            : used === allowed
                              ? "at"
                              : "plain";
                      return (
                        <td
                          key={e}
                          className={`num text-center font-semibold ${
                            state === "over"
                              ? "bg-loss/15 text-loss"
                              : state === "at"
                                ? "bg-t-yellow/15 text-t-yellow"
                                : ""
                          }`}
                        >
                          {used ?? "—"}
                          {state === "over" && (
                            <span className="sr-only"> {t("tech.pu.overSr")}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">{t("tech.pu.note")}</p>
        </Panel>
        <Panel title={t("tech.pu.changes")} icon={<Wrench />} className="self-start">
          <ul className="flex max-h-[70vh] flex-col divide-y divide-line overflow-y-auto">
            {changes.map(({ car, change }) => (
              <li
                key={`${String(car.car_number)}-${String(change.event_id)}-${change.element}-${String(change.number)}`}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span className="flex w-24 shrink-0 items-center gap-1.5 text-xs text-muted">
                  <Flag country={change.country} />
                  {t("tech.round", { n: change.round })}
                </span>
                <span className="min-w-0 flex-1">
                  {car.driver ? (
                    <DriverChip driver={car.driver} colour={car.colour} size="size-6" compact />
                  ) : (
                    car.team_and_driver
                  )}
                </span>
                <span className="num text-sm font-semibold">
                  {change.element} {change.number}
                  {change.allowed != null && <span className="text-muted">/{change.allowed}</span>}
                </span>
                {change.compliant === false && (
                  <span className="rounded-md border border-loss/40 bg-loss/15 px-1.5 py-0.5 text-[0.65rem] font-bold text-loss uppercase">
                    {t("tech.pu.overTag")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- incidents

/** Where the decisions were taken: race, sprint, qualifying, practice, other. */
function SessionsPanel({ decisions }: { decisions: Incidents["decisions"] }) {
  const { t } = useI18n();
  const groups = ["race", "sprint", "qualifying", "practice", "other"] as const;
  const group = (label: string): (typeof groups)[number] => {
    const lowered = label.toLowerCase();
    if (lowered.includes("sprint")) return "sprint";
    if (lowered.includes("qualifying")) return "qualifying";
    if (lowered.includes("practice")) return "practice";
    if (lowered === "race") return "race";
    return "other";
  };
  const counts = groups.map((g) => {
    const mine = decisions.filter((d) => group(d.session_label) === g);
    return { g, n: mine.length, p: mine.filter((d) => d.is_penalty).length };
  });
  const max = Math.max(1, ...counts.map((c) => c.n));
  return (
    <Panel title={t("tech.inc.sessions")} icon={<ListOrdered />} bodyClassName="gap-2 p-5">
      {counts.map(({ g, n, p }) => (
        <div key={g} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0">{t(`tech.session.${g}`)}</span>
          <span
            className="flex h-2 flex-1 overflow-hidden rounded-full bg-raised"
            aria-hidden="true"
          >
            <span className="bg-loss" style={{ width: `${String((p / max) * 100)}%` }} />
            <span className="bg-muted/50" style={{ width: `${String(((n - p) / max) * 100)}%` }} />
          </span>
          <span className="num w-24 shrink-0 text-right text-muted">
            {t("tech.inc.kindCount", { n, p })}
          </span>
        </div>
      ))}
    </Panel>
  );
}

function IncidentsTab({ year }: { year: number }) {
  const { t } = useI18n();
  const query = useIncidents(year);
  return (
    <Loading query={query} empty={t("tech.inc.empty")}>
      {(data) => <IncidentsView data={data} />}
    </Loading>
  );
}

function kindKey(kind: string): MessageKey {
  return `tech.kind.${kind}` as MessageKey;
}

function IncidentsView({ data }: { data: Incidents }) {
  const { t, locale } = useI18n();
  const penalties = data.decisions.filter((d) => d.is_penalty).length;
  const mostPenalised = [...data.drivers].sort((a, b) => b.penalties - a.penalties)[0];
  const topPoints = data.drivers[0];
  const maxKind = Math.max(1, ...data.kinds.map((k) => k.decisions));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tile label={t("tech.inc.decisions")} icon={<FileText />}>
          <p className="num display text-4xl">{data.decisions.length}</p>
          <p className="text-sm text-muted">
            {t("tech.inc.decisionsNote", { n: data.rounds.length })}
          </p>
        </Tile>
        <Tile label={t("tech.inc.penalties")} icon={<ShieldAlert />}>
          <p className="num display text-4xl text-loss">{penalties}</p>
          <p className="text-sm text-muted">{t("docs.tile.penaltiesNote")}</p>
        </Tile>
        <Tile label={t("tech.inc.most")} icon={<TriangleAlert />}>
          <p className="num display text-4xl">{mostPenalised?.penalties ?? 0}</p>
          {mostPenalised && (
            <DriverChip driver={mostPenalised.driver} colour={mostPenalised.colour} size="size-7" />
          )}
        </Tile>
        <Tile label={t("tech.inc.points")} icon={<Gauge />}>
          <p className="num display text-4xl">
            {topPoints?.points_12m ?? 0}
            <span className="text-xl text-muted">/{data.threshold}</span>
          </p>
          {topPoints && (
            <DriverChip driver={topPoints.driver} colour={topPoints.colour} size="size-7" />
          )}
        </Tile>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 flex-col gap-4 self-start">
          <Panel title={t("tech.inc.kinds")} icon={<Layers />} bodyClassName="gap-2 p-5">
            {data.kinds.map((k) => (
              <div key={k.kind} className="flex flex-col gap-1">
                <p className="flex justify-between text-sm">
                  <span>{t(kindKey(k.kind))}</span>
                  <span className="num text-muted">
                    {t("tech.inc.kindCount", { n: k.decisions, p: k.penalties })}
                  </span>
                </p>
                <span
                  className="flex h-2 overflow-hidden rounded-full bg-raised"
                  aria-hidden="true"
                >
                  <span
                    className="bg-loss"
                    style={{ width: `${String((k.penalties / maxKind) * 100)}%` }}
                  />
                  <span
                    className="bg-muted/50"
                    style={{ width: `${String(((k.decisions - k.penalties) / maxKind) * 100)}%` }}
                  />
                </span>
              </div>
            ))}
            <p className="text-xs text-muted">{t("tech.inc.kindsNote")}</p>
          </Panel>
          <SessionsPanel decisions={data.decisions} />
        </div>
        <Panel title={t("tech.inc.licence")} icon={<ShieldAlert />}>
          <div className="relative overflow-x-auto">
            <table className="data-table text-sm">
              <caption className="sr-only">{t("tech.inc.licence")}</caption>
              <thead>
                <tr>
                  <th>{t("col.driver")}</th>
                  <th className="min-w-36">{t("tech.inc.points12")}</th>
                  <th className="min-w-32">{t("tech.inc.byRound")}</th>
                  <th className="num">{t("tech.inc.season")}</th>
                  <th className="num">{t("tech.inc.penalties")}</th>
                </tr>
              </thead>
              <tbody>
                {data.drivers.map((d) => (
                  <tr key={d.driver.ref}>
                    <td className="border-l-4" style={{ borderLeftColor: teamColour(d.colour) }}>
                      <DriverChip driver={d.driver} colour={d.colour} size="size-7" compact />
                    </td>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className="num w-8 font-semibold">{d.points_12m}</span>
                        <span
                          className="h-2 flex-1 overflow-hidden rounded-full bg-raised"
                          aria-hidden="true"
                        >
                          <span
                            className={`block h-full rounded-full ${d.points_12m >= data.threshold - 2 ? "bg-loss" : "bg-t-yellow"}`}
                            style={{
                              width: `${String(Math.min(1, d.points_12m / data.threshold) * 100)}%`,
                            }}
                          />
                        </span>
                      </span>
                    </td>
                    <td>
                      <RoundBars
                        colour={teamColour(d.colour)}
                        bars={d.points_by_round.map((points, i) => ({
                          key: String(i),
                          kind: points > 0 ? ("hit" as const) : ("miss" as const),
                          value: points / data.threshold,
                          label: `${data.rounds[i] ? eventName(data.rounds[i].name, locale) : ""}: ${String(points)}`,
                        }))}
                      />
                    </td>
                    <td className="num">{d.points}</td>
                    <td className="num text-muted">{d.penalties}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            {t("tech.inc.licenceNote", { n: data.threshold })}
          </p>
        </Panel>
      </div>
      <Panel title={t("tech.inc.list")} icon={<ListOrdered />}>
        <div className="relative max-h-[70vh] overflow-auto">
          <table className="data-table text-sm">
            <caption className="sr-only">{t("tech.inc.list")}</caption>
            <thead>
              <tr>
                <th className="num">{t("col.round")}</th>
                <th>{t("col.driver")}</th>
                <th>{t("tech.inc.kind")}</th>
                <th>{t("docs.fact")}</th>
                <th>{t("docs.decision")}</th>
                <th>
                  <span className="sr-only">{t("docs.document")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...data.decisions].reverse().map((d) => (
                <tr key={d.document_id}>
                  <td className="num">
                    <span className="flex items-center gap-1.5">
                      <Flag country={d.country} />
                      {d.round}
                    </span>
                  </td>
                  <td className="border-l-4" style={{ borderLeftColor: teamColour(d.colour) }}>
                    {d.driver ? (
                      <DriverChip driver={d.driver} colour={d.colour} size="size-6" compact />
                    ) : (
                      d.driver_name
                    )}
                  </td>
                  <td className="text-xs whitespace-nowrap text-muted">{t(kindKey(d.kind))}</td>
                  <td className="max-w-96 text-muted">{d.fact}</td>
                  <td>
                    <PenaltyTags ruling={d} />
                  </td>
                  <td>
                    <Link
                      to={`/documents?season=${String(data.season)}&event=${String(d.event_id)}&doc=${String(d.document_id)}`}
                      className="text-sm font-semibold text-mark-text hover:underline"
                    >
                      {t("docs.open")}
                    </Link>
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

import type { Schema } from "@stintline/api-types";
import { Cog, FileText, Gauge, Layers, ListOrdered, Sparkles, Wrench } from "lucide-react";
import { Link } from "react-router";

import { Panel, Tile } from "@/components/layout/Panel";
import { Flag } from "@/components/racing/Flag";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/en";
import { useTeams } from "@/lib/queries";
import { teamColour, teamTint } from "@/lib/teams";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

import { useUpgrades } from "../api";
import { CarDiagram } from "./CarDiagram";
import { TabLoading } from "./TabLoading";

type Upgrades = Schema<"Upgrades">;

/** Strongest team tint in the upgrades heatmap: the count stays readable on it. */
const HEAT_MAX_PCT = 70;

export function UpgradesTab({ year }: { year: number }) {
  const { t } = useI18n();
  const query = useUpgrades(year);
  return (
    <TabLoading query={query} empty={t("tech.upgrades.empty")}>
      {(data) => <UpgradesView data={data} />}
    </TabLoading>
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
  const seasonTeams = useTeams("", data.season).data?.results ?? [];
  const carUrl = seasonTeams.find((x) => x.ref === team?.team?.ref)?.season?.car_image_url;
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
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Panel
            title={`${team.team?.name ?? team.team_name} · ${roundName(cell.round)}`}
            icon={<Cog />}
            bodyClassName="items-center gap-4 p-5"
          >
            <CarDiagram
              zones={new Set(items.map((u) => u.zone))}
              colour={team.colour}
              imageUrl={carUrl}
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

import type { Schema } from "@stintline/api-types";
import { ArrowRight, Flame, Gauge, Scale, Table2, Timer } from "lucide-react";
import { Link } from "react-router";

import { Panel, Tile } from "@/components/layout/Panel";
import { Face } from "@/components/racing/Face";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { ApiError } from "@/lib/errors";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import { useTeammates } from "../api";
import { GapStrip } from "../charts/GapStrip";
import { SplitBar } from "../charts/SplitBar";
import { duelColours, share } from "../duel";
import { FIRST_TIMED_SEASON, driverLabel } from "../season";
import { DriverChip } from "./AnalysisParts";

type Duel = Schema<"Teammates">;
export type Side = Schema<"SideTotals">;

/** Quali gaps beyond this (seconds) sit at the edge of the strip: a wet session or a crash. */
const STRIP_LIMIT_S = 1.5;

export function Teammates({ year }: { year: number }) {
  const { t } = useI18n();
  const duels = useTeammates(year);
  if (duels.error instanceof ApiError && duels.error.status === 404) {
    return <EmptyState title={t("h2h.empty")} />;
  }
  if (duels.isError) return <ErrorState error={duels.error} onRetry={() => void duels.refetch()} />;
  if (!duels.data) return <Skeleton className="h-[60vh]" />;
  return (
    <div className="flex flex-col gap-4">
      <DuelTiles duels={duels.data} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {duels.data.map((duel) => (
          <DuelCard key={duel.team.ref} duel={duel} year={year} />
        ))}
        <DuelTable duels={duels.data} wide={duels.data.length % 2 === 0} />
      </div>
    </div>
  );
}

function decided(tally: readonly number[]): number {
  return (tally[0] ?? 0) + (tally[1] ?? 0);
}

function DuelTiles({ duels }: { duels: readonly Duel[] }) {
  const { t, f } = useI18n();
  const pick = <T,>(items: readonly T[], score: (item: T) => number | null) => {
    let best: T | null = null;
    let top = -Infinity;
    for (const item of items) {
      const s = score(item);
      if (s !== null && s > top) {
        top = s;
        best = item;
      }
    }
    return best;
  };
  const sweep = pick(duels, (d) => (decided(d.quali) ? Math.abs(share(d.quali) - 0.5) : null));
  const tight = pick(duels, (d) =>
    decided(d.race) >= 4 ? -Math.abs((d.race[0] ?? 0) - (d.race[1] ?? 0)) : null,
  );
  const paceGap = pick(duels, (d) =>
    d.median_pace_gap_s == null ? null : Math.abs(d.median_pace_gap_s),
  );
  const closeQuali = pick(duels, (d) =>
    d.median_quali_gap_s == null ? null : -Math.abs(d.median_quali_gap_s),
  );
  const pointsGap = pick(duels, (d) => d.a.points - d.b.points);

  const leader = (duel: Duel, tally: readonly number[]) =>
    (tally[0] ?? 0) >= (tally[1] ?? 0) ? duel.a : duel.b;
  const faster = (duel: Duel, gap: number) => (gap <= 0 ? duel.a : duel.b);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {sweep && (
        <Tile label={t("h2h.tile.sweep")} icon={<Flame />}>
          <p className="num display text-4xl">
            {Math.max(...sweep.quali)}–{Math.min(...sweep.quali)}
          </p>
          <TileDriver side={leader(sweep, sweep.quali)} note={t("h2h.inQuali")} />
        </Tile>
      )}
      {tight && (
        <Tile label={t("h2h.tile.tight")} icon={<Scale />}>
          <p className="num display text-4xl">
            {tight.race[0]}–{tight.race[1]}
          </p>
          <p className="text-sm text-muted">
            {driverLabel(tight.a.driver)} · {driverLabel(tight.b.driver)} · {tight.team.name}
          </p>
        </Tile>
      )}
      {paceGap?.median_pace_gap_s != null ? (
        <Tile label={t("h2h.tile.paceGap")} icon={<Gauge />}>
          <p className="flex items-center gap-2">
            <span className="num display text-4xl">
              {f.seconds(Math.abs(paceGap.median_pace_gap_s), 3)}
            </span>
          </p>
          <TileDriver side={faster(paceGap, paceGap.median_pace_gap_s)} note={t("h2h.perLap")} />
        </Tile>
      ) : (
        pointsGap && (
          <Tile label={t("h2h.tile.pointsGap")} icon={<Gauge />}>
            <p className="num display text-4xl">
              {f.number(pointsGap.a.points - pointsGap.b.points, 0)}
            </p>
            <TileDriver side={pointsGap.a} note={t("h2h.pointsAhead")} />
          </Tile>
        )
      )}
      {closeQuali?.median_quali_gap_s != null && (
        <Tile label={t("h2h.tile.closeQuali")} icon={<Timer />}>
          <p className="num display text-4xl">
            {f.seconds(Math.abs(closeQuali.median_quali_gap_s), 3)}
          </p>
          <p className="text-sm text-muted">
            {driverLabel(closeQuali.a.driver)} · {driverLabel(closeQuali.b.driver)} ·{" "}
            {closeQuali.team.name}
          </p>
        </Tile>
      )}
    </div>
  );
}

function TileDriver({ side, note }: { side: Side; note: string }) {
  return (
    <DriverChip driver={side.driver} colour={side.colour} sub={`${side.team.name} · ${note}`} />
  );
}

/** Every duel in one table: the season at a glance, and the slot the odd card leaves. */
function DuelTable({ duels, wide }: { duels: readonly Duel[]; wide: boolean }) {
  const { t, f } = useI18n();
  const gap = (v: number | null | undefined) => (v == null ? "—" : f.delta(v, 3));
  return (
    <Panel title={t("h2h.allDuels")} icon={<Table2 />} className={wide ? "xl:col-span-2" : ""}>
      <div className="relative overflow-x-auto">
        <table className="data-table text-sm">
          <caption className="sr-only">{t("h2h.allDuels")}</caption>
          <thead>
            <tr>
              <th>{t("col.team")}</th>
              <th>{t("h2h.duel")}</th>
              <th className="num">{t("h2h.quali")}</th>
              <th className="num">{t("h2h.race")}</th>
              <th className="num">{t("h2h.pace")}</th>
              <th className="num">{t("h2h.col.qualiGap")}</th>
              <th className="num">{t("h2h.col.paceGap")}</th>
            </tr>
          </thead>
          <tbody>
            {duels.map((d) => (
              <tr key={d.team.ref}>
                <td className="border-l-4" style={{ borderLeftColor: teamColour(d.colour) }}>
                  {d.team.name}
                </td>
                <td className="font-semibold">
                  {driverLabel(d.a.driver)} · {driverLabel(d.b.driver)}
                </td>
                <td className="num">{d.quali.join("–")}</td>
                <td className="num">{d.race.join("–")}</td>
                <td className="num">{decided(d.pace) ? d.pace.join("–") : "—"}</td>
                <td className="num text-muted">{gap(d.median_quali_gap_s)}</td>
                <td className="num text-muted">{gap(d.median_pace_gap_s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-5 py-3 text-xs text-muted">{t("h2h.gapsNote")}</p>
    </Panel>
  );
}

function DuelCard({ duel, year }: { duel: Duel; year: number }) {
  const { t, f, locale } = useI18n();
  const colours = duelColours(duel.a.colour ?? duel.colour, duel.b.colour ?? duel.colour);
  const dots = duel.rounds
    .filter((r) => r.quali_gap_s != null)
    .map((r) => ({
      key: String(r.round),
      value: r.quali_gap_s ?? 0,
      label: eventName(r.name, locale),
    }));
  const timed = year >= FIRST_TIMED_SEASON;
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-5 w-1.5 rounded-full"
            style={{ backgroundColor: teamColour(duel.colour) }}
          />
          {duel.team.name}
        </span>
      }
      action={
        <Link
          to={`/analysis?mode=drivers&season=${String(year)}&a=${duel.a.driver.ref}&b=${duel.b.driver.ref}`}
          className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
        >
          {t("h2h.details")} <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      }
      bodyClassName="gap-4 p-5"
    >
      <div className="grid grid-cols-2 gap-4">
        <SideHead side={duel.a} />
        <SideHead side={duel.b} right />
      </div>
      <div className="flex flex-col gap-3">
        <SplitBar label={t("h2h.quali")} counts={duel.quali} colours={colours} />
        <SplitBar label={t("h2h.race")} counts={duel.race} colours={colours} />
        {timed && decided(duel.pace) > 0 && (
          <SplitBar label={t("h2h.pace")} counts={duel.pace} colours={colours} />
        )}
      </div>
      {dots.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="flex items-baseline justify-between text-xs text-muted">
            <span className="font-semibold tracking-wide uppercase">{t("h2h.qualiGaps")}</span>
            {duel.median_quali_gap_s != null && (
              <span className="num">
                {t("h2h.median")} {f.delta(duel.median_quali_gap_s, 3)}
              </span>
            )}
          </p>
          <GapStrip
            label={t("h2h.qualiGapsOf", {
              a: driverLabel(duel.a.driver),
              b: driverLabel(duel.b.driver),
            })}
            dots={dots}
            colours={colours}
            ends={[
              t("h2h.faster", { driver: driverLabel(duel.a.driver) }),
              t("h2h.faster", { driver: driverLabel(duel.b.driver) }),
            ]}
            median={duel.median_quali_gap_s ?? null}
            format={(v) => f.delta(v, 3)}
            limit={STRIP_LIMIT_S}
          />
        </div>
      )}
      {duel.median_pace_gap_s != null && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{t("h2h.medianPace")}</span>
          <span className="num font-semibold">{f.delta(duel.median_pace_gap_s, 3)}</span>
          <span className="text-muted">
            {t("h2h.forDriver", { driver: driverLabel(duel.a.driver) })}
          </span>
        </p>
      )}
    </Panel>
  );
}

function SideHead({ side, right = false }: { side: Side; right?: boolean }) {
  const { t, f } = useI18n();
  return (
    <Link
      to={`/drivers/${side.driver.ref}`}
      className={`flex items-center gap-3 hover:underline ${right ? "flex-row-reverse text-right" : ""}`}
    >
      <Face
        url={side.driver.photo_url ?? side.driver.portrait_url}
        label={driverLabel(side.driver)}
        colour={side.colour}
        className="size-14 shrink-0 rounded-xl text-sm"
      />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm text-muted">{side.driver.given_name}</span>
        <span className="block truncate font-bold">{side.driver.family_name}</span>
        <span className="num block text-sm text-muted">
          {t("h2h.points", { points: f.number(side.points, side.points % 1 ? 1 : 0) })}
        </span>
      </span>
    </Link>
  );
}

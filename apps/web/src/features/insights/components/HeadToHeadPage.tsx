import type { Schema } from "@stintline/api-types";
import { ArrowRight, Flame, Gauge, Scale, Swords, Table2, Timer } from "lucide-react";
import { Link } from "react-router";

import { Face } from "@/components/dash/Face";
import { Panel, Tile } from "@/components/dash/Panel";
import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { Flag } from "@/components/racing/Flag";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useDrivers } from "@/features/hub/api";
import { ApiError } from "@/lib/errors";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";
import { useSearchParamsState } from "@/lib/useSearchParam";

import { useHeadToHead, useTeammates } from "../api";
import { GapStrip } from "../charts/GapStrip";
import { RoundGapBars } from "../charts/RoundGapBars";
import { SplitBar } from "../charts/SplitBar";
import { duelColours, share } from "../duel";
import { FIRST_TIMED_SEASON, driverLabel, useSeasonParam } from "../season";
import { AnalysisTabs, DriverChip, EngineBadge } from "./common";

type Duel = Schema<"Teammates">;
type HeadToHead = Schema<"HeadToHead">;
type Side = Schema<"SideTotals">;

/** Quali gaps beyond this (seconds) sit at the edge of the strip: a wet session or a crash. */
const STRIP_LIMIT_S = 1.5;

export function HeadToHeadPage() {
  const { t } = useI18n();
  const [year, setYear] = useSeasonParam();
  const [params, update] = useSearchParamsState();
  const mode = params.get("mode") === "drivers" ? "drivers" : "teams";

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t("h2h.title")}
        actions={
          <>
            <SegmentedControl
              legend={t("h2h.mode")}
              hideLegend
              options={[
                { value: "teams", label: t("h2h.teammates") },
                { value: "drivers", label: t("h2h.drivers") },
              ]}
              value={mode}
              onChange={(value) => {
                update({ mode: value === "teams" ? null : value });
              }}
            />
            <SeasonSelect
              value={year}
              onChange={(value) => {
                update({ a: null, b: null });
                setYear(value);
              }}
            />
          </>
        }
      >
        {t("h2h.intro")}
      </PageHeader>
      <AnalysisTabs />
      {year === null ? (
        <Skeleton className="h-[60vh]" />
      ) : mode === "teams" ? (
        <Teammates year={year} />
      ) : (
        <Drivers year={year} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------- teammates

function Teammates({ year }: { year: number }) {
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
          <p className="num text-4xl font-semibold">
            {Math.max(...sweep.quali)}–{Math.min(...sweep.quali)}
          </p>
          <TileDriver side={leader(sweep, sweep.quali)} note={t("h2h.inQuali")} />
        </Tile>
      )}
      {tight && (
        <Tile label={t("h2h.tile.tight")} icon={<Scale />}>
          <p className="num text-4xl font-semibold">
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
            <span className="num text-4xl font-semibold">
              {f.seconds(Math.abs(paceGap.median_pace_gap_s), 3)}
            </span>
            <EngineBadge />
          </p>
          <TileDriver side={faster(paceGap, paceGap.median_pace_gap_s)} note={t("h2h.perLap")} />
        </Tile>
      ) : (
        pointsGap && (
          <Tile label={t("h2h.tile.pointsGap")} icon={<Gauge />}>
            <p className="num text-4xl font-semibold">
              {f.number(pointsGap.a.points - pointsGap.b.points, 0)}
            </p>
            <TileDriver side={pointsGap.a} note={t("h2h.pointsAhead")} />
          </Tile>
        )
      )}
      {closeQuali?.median_quali_gap_s != null && (
        <Tile label={t("h2h.tile.closeQuali")} icon={<Timer />}>
          <p className="num text-4xl font-semibold">
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
          <EngineBadge />
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

// --------------------------------------------------------------------------- drivers

function Drivers({ year }: { year: number }) {
  const { t } = useI18n();
  const [params, update] = useSearchParamsState();
  const roster = useDrivers("", year);
  const duels = useTeammates(year);
  const asked = params.get("a");
  // Only one driver given (from a profile): their teammate; nothing given: the top duel.
  const own = duels.data?.find((d) => d.a.driver.ref === asked || d.b.driver.ref === asked);
  const fallback = own ?? duels.data?.[0];
  const a = asked ?? fallback?.a.driver.ref ?? null;
  const mate = own ? (own.a.driver.ref === asked ? own.b : own.a).driver.ref : null;
  const b = params.get("b") ?? mate ?? (asked === null ? (fallback?.b.driver.ref ?? null) : null);
  const h2h = useHeadToHead(year, a, b);
  const drivers = (roster.data?.results ?? []).filter((d) => d.season !== null);

  const picker = (key: "a" | "b", value: string | null, label: string) => (
    <Select
      label={label}
      value={value ?? ""}
      onChange={(event) => {
        update({
          [key]: event.target.value,
          ...(key === "a" ? { b: b ?? null } : { a: a ?? null }),
        });
      }}
    >
      {drivers.map((d) => (
        <option key={d.ref} value={d.ref}>
          {d.given_name} {d.family_name}
        </option>
      ))}
    </Select>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {picker("a", a, t("h2h.driverA"))}
        <Swords aria-hidden="true" className="size-5 text-muted" />
        {picker("b", b, t("h2h.driverB"))}
      </div>
      {a !== null && a === b ? (
        <EmptyState title={t("h2h.same")} />
      ) : (a === null || b === null) && duels.data ? (
        <EmptyState title={t("h2h.pick")} />
      ) : h2h.error instanceof ApiError && h2h.error.status === 404 ? (
        <EmptyState title={t("h2h.notBoth")} />
      ) : h2h.isError ? (
        <ErrorState error={h2h.error} onRetry={() => void h2h.refetch()} />
      ) : !h2h.data ? (
        <Skeleton className="h-[60vh]" />
      ) : (
        <DuelView data={h2h.data} year={year} />
      )}
    </div>
  );
}

function DuelView({ data, year }: { data: HeadToHead; year: number }) {
  const { t, f, locale } = useI18n();
  const colours = duelColours(data.a.colour, data.b.colour);
  const names = [driverLabel(data.a.driver), driverLabel(data.b.driver)] as const;
  const short = (r: HeadToHead["rounds"][number]) => eventName(r.name, locale);
  const hasPace = data.rounds.some((r) => r.pace_gap_s != null);
  const hasQuali = data.rounds.some((r) => r.quali_gap_s != null);

  return (
    <>
      <Panel
        title={t("h2h.duelTitle", { a: names[0], b: names[1], year })}
        icon={<Swords />}
        bodyClassName="p-5"
      >
        <div className="grid items-center gap-6 md:grid-cols-[1fr_minmax(0,1.4fr)_1fr]">
          <BigSide side={data.a} />
          <div className="flex flex-col gap-3">
            <SplitBar label={t("h2h.quali")} counts={data.quali} colours={colours} />
            <SplitBar label={t("h2h.race")} counts={data.race} colours={colours} />
            {hasPace && <SplitBar label={t("h2h.pace")} counts={data.pace} colours={colours} />}
            <p className="text-center text-xs text-muted">
              {t("h2h.shared", { n: data.shared_rounds })}
            </p>
          </div>
          <BigSide side={data.b} right />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title={t("h2h.season")} icon={<Table2 />} className="self-start">
          <SeasonFigures a={data.a} b={data.b} />
        </Panel>
        <div className="flex min-w-0 flex-col gap-4">
          {hasQuali && (
            <Panel
              title={t("h2h.qualiGaps")}
              icon={<Timer />}
              action={
                data.median_quali_gap_s != null && (
                  <span className="num text-sm text-muted">
                    {t("h2h.median")} {f.delta(data.median_quali_gap_s, 3)}
                  </span>
                )
              }
              bodyClassName="p-4"
            >
              <RoundGapBars
                label={t("h2h.qualiGapsOf", { a: names[0], b: names[1] })}
                rounds={data.rounds.map((r) => ({
                  key: String(r.round),
                  short: String(r.round),
                  label: short(r),
                  value: r.quali_gap_s ?? null,
                }))}
                colours={colours}
                names={[
                  t("h2h.faster", { driver: names[0] }),
                  t("h2h.faster", { driver: names[1] }),
                ]}
                format={(v) => f.seconds(v, 2)}
              />
            </Panel>
          )}
          {hasPace && (
            <Panel
              title={t("h2h.paceGaps")}
              icon={<Gauge />}
              action={<EngineBadge />}
              bodyClassName="gap-2 p-4"
            >
              <RoundGapBars
                label={t("h2h.paceGapsOf", { a: names[0], b: names[1] })}
                rounds={data.rounds.map((r) => ({
                  key: String(r.round),
                  short: String(r.round),
                  label: short(r),
                  value: r.pace_gap_s ?? null,
                }))}
                colours={colours}
                names={[
                  t("h2h.faster", { driver: names[0] }),
                  t("h2h.faster", { driver: names[1] }),
                ]}
                format={(v) => f.seconds(v, 2)}
              />
              <p className="text-xs text-muted">{t("h2h.paceNote")}</p>
            </Panel>
          )}
          {!hasPace && year < FIRST_TIMED_SEASON && (
            <p className="rounded-xl border border-line bg-panel p-4 text-sm text-muted">
              {t("h2h.noTiming")}
            </p>
          )}
        </div>
      </div>

      <Panel title={t("h2h.byRound")} icon={<Table2 />}>
        <div className="relative overflow-x-auto">
          <table className="data-table text-sm">
            <caption className="sr-only">{t("h2h.byRound")}</caption>
            <thead>
              <tr>
                <th className="num">{t("col.round")}</th>
                <th>{t("col.grandPrix")}</th>
                <th className="num">{t("h2h.col.quali", { driver: names[0] })}</th>
                <th className="num">{t("h2h.col.quali", { driver: names[1] })}</th>
                <th className="num">{t("h2h.col.qualiGap")}</th>
                <th className="num">{t("h2h.col.finish", { driver: names[0] })}</th>
                <th className="num">{t("h2h.col.finish", { driver: names[1] })}</th>
                <th className="num">{t("h2h.col.points")}</th>
                {hasPace && <th className="num">{t("h2h.col.paceGap")}</th>}
              </tr>
            </thead>
            <tbody>
              {data.rounds.map((r) => (
                <tr key={r.round}>
                  <td className="num text-muted">{r.round}</td>
                  <td>
                    <Link
                      to={`/events/${String(r.event_id)}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Flag country={r.country} />
                      <span className="truncate">{eventName(r.name, locale)}</span>
                    </Link>
                  </td>
                  <Cell value={r.a.quali} other={r.b.quali} />
                  <Cell value={r.b.quali} other={r.a.quali} />
                  <td className="num">{r.quali_gap_s == null ? "—" : f.delta(r.quali_gap_s, 3)}</td>
                  <Cell value={r.a.finish} other={r.b.finish} text={r.a.classification} />
                  <Cell value={r.b.finish} other={r.a.finish} text={r.b.classification} />
                  <td className="num text-muted">
                    {f.number(r.a.points, r.a.points % 1 ? 1 : 0)}–
                    {f.number(r.b.points, r.b.points % 1 ? 1 : 0)}
                  </td>
                  {hasPace && (
                    <td className="num">
                      {r.pace_gap_s == null ? (
                        "—"
                      ) : r.session_id ? (
                        <Link
                          to={`/analysis/pace?session=${String(r.session_id)}`}
                          className="hover:underline"
                        >
                          {f.delta(r.pace_gap_s, 3)}
                        </Link>
                      ) : (
                        f.delta(r.pace_gap_s, 3)
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/** A position, bold when it beat the other driver's. Retirements show their code (R, D…). */
function Cell({
  value,
  other,
  text,
}: {
  value: number | null | undefined;
  other: number | null | undefined;
  text?: string;
}) {
  const shown = text !== undefined && text !== "" && !/^\d+$/.test(text) ? text : value;
  const won =
    value != null && other != null && value < other && (text === undefined || /^\d+$/.test(text));
  return <td className={`num ${won ? "font-bold text-ink" : "text-muted"}`}>{shown ?? "—"}</td>;
}

function BigSide({ side, right = false }: { side: Side; right?: boolean }) {
  const { f } = useI18n();
  return (
    <Link
      to={`/drivers/${side.driver.ref}`}
      className={`flex items-center gap-4 hover:underline ${right ? "md:flex-row-reverse md:text-right" : ""}`}
    >
      <Face
        url={side.driver.photo_url ?? side.driver.portrait_url}
        label={driverLabel(side.driver)}
        colour={side.colour}
        className="size-20 shrink-0 rounded-2xl text-lg"
      />
      <span className="min-w-0 leading-tight">
        <span className="block text-muted">{side.driver.given_name}</span>
        <span className="block truncate text-2xl font-bold">{side.driver.family_name}</span>
        <span className="block text-sm text-muted">{side.team.name}</span>
        <span className="num block text-lg font-semibold">
          {f.number(side.points, side.points % 1 ? 1 : 0)} pts
        </span>
      </span>
    </Link>
  );
}

function SeasonFigures({ a, b }: { a: Side; b: Side }) {
  const { t, f } = useI18n();
  const rows: [string, number | null | undefined, number | null | undefined, "high" | "low"][] = [
    [t("h2h.fig.points"), a.points, b.points, "high"],
    [t("h2h.fig.wins"), a.wins, b.wins, "high"],
    [t("h2h.fig.podiums"), a.podiums, b.podiums, "high"],
    [t("h2h.fig.poles"), a.poles, b.poles, "high"],
    [t("h2h.fig.lapsLed"), a.laps_led, b.laps_led, "high"],
    [t("h2h.fig.avgQuali"), a.average_quali, b.average_quali, "low"],
    [t("h2h.fig.avgFinish"), a.average_finish, b.average_finish, "low"],
    [t("h2h.fig.best"), a.best_finish, b.best_finish, "low"],
    [t("h2h.fig.finishes"), a.finishes, b.finishes, "high"],
    [t("h2h.fig.retirements"), a.retirements, b.retirements, "low"],
  ];
  const fmt = (v: number | null | undefined) =>
    v == null ? "—" : f.number(v, Number.isInteger(v) ? 0 : 1);
  return (
    <table className="data-table text-sm">
      <caption className="sr-only">{t("h2h.season")}</caption>
      <thead>
        <tr>
          <th>{t("h2h.fig.metric")}</th>
          <th className="num">{driverLabel(a.driver)}</th>
          <th className="num">{driverLabel(b.driver)}</th>
        </tr>
      </thead>
      <tbody>
        {rows
          .filter(([, x, y]) => x != null || y != null)
          .map(([label, x, y, better]) => {
            const aWins = x != null && y != null && (better === "high" ? x > y : x < y);
            const bWins = x != null && y != null && (better === "high" ? y > x : y < x);
            return (
              <tr key={label}>
                <td>{label}</td>
                <td className={`num ${aWins ? "font-bold text-ink" : "text-muted"}`}>{fmt(x)}</td>
                <td className={`num ${bWins ? "font-bold text-ink" : "text-muted"}`}>{fmt(y)}</td>
              </tr>
            );
          })}
      </tbody>
    </table>
  );
}

import type { Schema } from "@stintline/api-types";
import { Gauge, Swords, Table2, Timer } from "lucide-react";
import { Link } from "react-router";

import { Panel } from "@/components/layout/Panel";
import { Face } from "@/components/racing/Face";
import { Flag } from "@/components/racing/Flag";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { ApiError } from "@/lib/errors";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { useDrivers } from "@/lib/queries";
import { useSearchParamsState } from "@/lib/useSearchParam";

import { useHeadToHead, useTeammates } from "../api";
import { RoundGapBars } from "../charts/RoundGapBars";
import { SplitBar } from "../charts/SplitBar";
import { duelColours } from "../duel";
import { FIRST_TIMED_SEASON, driverLabel } from "../season";
import type { Side } from "./TeammateDuels";

type HeadToHead = Schema<"HeadToHead">;

export function Drivers({ year }: { year: number }) {
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
            <p className="glass rounded-[20px] p-4 text-sm text-muted">{t("h2h.noTiming")}</p>
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

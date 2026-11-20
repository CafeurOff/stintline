import {
  ArrowLeftRight,
  Gauge,
  Hourglass,
  ListOrdered,
  Octagon,
  Ruler,
  Siren,
  Trophy,
  TrendingDown,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/PageHeader";
import { Panel, Tile } from "@/components/layout/Panel";
import { CircuitMark } from "@/components/racing/CircuitMark";
import { CompoundBadge } from "@/components/racing/CompoundBadge";
import { Flag } from "@/components/racing/Flag";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { compoundInfo } from "@/lib/compounds";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";

import { useCircuits } from "../api";
import { AnalysisTabs, DriverChip } from "./AnalysisParts";
import type { Profile } from "./CircuitsPage";

interface Ranked {
  key: string;
  label: string;
  value: string;
  rank: number;
  of: number;
  /** Which end is rank 1 ("highest" or "lowest" in the field). */
  high: boolean;
}

function rankOf(
  profiles: readonly Profile[],
  ref: string,
  value: (p: Profile) => number | null | undefined,
): { rank: number; of: number } | null {
  const known = profiles
    .filter((p) => value(p) != null)
    .sort((a, b) => (value(b) ?? 0) - (value(a) ?? 0));
  const index = known.findIndex((p) => p.circuit.ref === ref);
  return index < 0 ? null : { rank: index + 1, of: known.length };
}

export function CircuitDetail({ circuitRef }: { circuitRef: string }) {
  const { t, f, locale } = useI18n();
  const circuits = useCircuits();
  const p = circuits.data?.find((c) => c.circuit.ref === circuitRef);

  if (circuits.isError)
    return <ErrorState error={circuits.error} onRetry={() => void circuits.refetch()} />;
  if (!circuits.data) return <Skeleton className="h-[60vh]" />;
  if (!p) return <EmptyState title={t("dna.notFound")} />;
  const all = circuits.data;

  const ranks: Ranked[] = (
    [
      [
        "topSpeed",
        t("dna.topSpeed"),
        (x: Profile) => x.top_speed_kph,
        (v: number) => `${f.number(v, 0)} km/h`,
      ],
      [
        "throttle",
        t("dna.throttle"),
        (x: Profile) => x.full_throttle_share,
        (v: number) => f.percent(v),
      ],
      ["zones", t("dna.zones"), (x: Profile) => x.braking_zones, (v: number) => f.number(v, 0)],
      ["pitLoss", t("dna.pitLoss"), (x: Profile) => x.pit_loss_s, (v: number) => f.seconds(v, 1)],
      ["deg", t("dna.deg"), (x: Profile) => x.degradation_s_per_lap, (v: number) => f.number(v, 3)],
      ["passes", t("dna.passes"), (x: Profile) => x.passes_per_race, (v: number) => f.number(v, 0)],
    ] as const
  ).flatMap(([key, label, value, format]) => {
    const own = value(p);
    const r = rankOf(all, p.circuit.ref, value);
    return own == null || r === null ? [] : [{ key, label, value: format(own), ...r, high: true }];
  });

  const strategies = p.history.filter((h) => h.winner_strategy.length > 0);
  const undercutRate = p.undercut_attempts ? p.undercut_successes / p.undercut_attempts : null;

  return (
    <div className="flex flex-col">
      <PageHeader
        terms={["pitLoss", "degradation", "fullThrottle", "safetyCar"]}
        eyebrow={
          <Link to="/circuits" className="hover:underline">
            {t("dna.title")}
          </Link>
        }
        title={p.circuit.name}
        actions={
          <Link
            to={`/events/${String(p.latest_event_id)}`}
            className="glass rounded-xl px-3 py-1.5 text-sm font-semibold hover:bg-raised"
          >
            {t("dna.latestRace")}
          </Link>
        }
      >
        <span className="flex items-center gap-2">
          <Flag country={p.circuit.country} />
          {p.circuit.locality} · {countryName(p.circuit.country, locale)} ·{" "}
          {p.races === 1 ? t("dna.race") : t("dna.races", { n: p.races })}
        </span>
      </PageHeader>
      <AnalysisTabs />

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Tile label={t("dna.length")} icon={<Ruler />}>
            <p className="num display text-4xl">
              {p.lap_length_m == null ? "—" : f.number(p.lap_length_m / 1000, 3)}
              <span className="ml-1 text-base text-muted">km</span>
            </p>
            {p.fastest_lap_s != null && (
              <p className="text-sm text-muted">
                {t("dna.record", {
                  time: f.lapTime(p.fastest_lap_s),
                  year: p.fastest_lap_year ?? "",
                })}
              </p>
            )}
          </Tile>
          <Tile label={t("dna.topSpeed")} icon={<Gauge />}>
            <p className="num display text-4xl">
              {p.top_speed_kph == null ? "—" : f.number(p.top_speed_kph, 0)}
              <span className="ml-1 text-base text-muted">km/h</span>
            </p>
            <p className="text-sm text-muted">{t("dna.fromFastest")}</p>
          </Tile>
          <Tile label={t("dna.throttle")} icon={<Zap />}>
            <p className="num display text-4xl">
              {p.full_throttle_share == null ? "—" : f.percent(p.full_throttle_share)}
            </p>
            <p className="text-sm text-muted">{t("dna.zonesN", { n: p.braking_zones ?? "—" })}</p>
          </Tile>
          <Tile label={t("dna.pitLoss")} icon={<Hourglass />}>
            <p className="flex items-center gap-2">
              <span className="num display text-4xl">{f.seconds(p.pit_loss_s, 1)}</span>
            </p>
            {p.pit_loss_sigma_s != null && (
              <p className="num text-sm text-muted">± {f.seconds(p.pit_loss_sigma_s, 1)}</p>
            )}
          </Tile>
          <Tile label={t("dna.deg")} icon={<TrendingDown />}>
            <div className="flex flex-col gap-1.5">
              {(["SOFT", "MEDIUM", "HARD"] as const).map((c) => {
                const v = p.degradation[c];
                const top = Math.max(...Object.values(p.degradation).map((x) => x ?? 0), 0.01);
                return (
                  <div key={c} className="flex items-center gap-2">
                    <CompoundBadge compound={c} />
                    <span
                      className="h-2 flex-1 overflow-hidden rounded-full bg-raised"
                      aria-hidden="true"
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${String(Math.max(0, (v ?? 0) / top) * 100)}%`,
                          backgroundColor: compoundInfo(c).fill,
                        }}
                      />
                    </span>
                    <span className="num w-20 text-right text-xs">
                      {v == null ? "—" : t("dna.perLap", { v: f.number(v, 3) })}
                    </span>
                  </div>
                );
              })}
            </div>
          </Tile>
          <Tile label={t("dna.neutral")} icon={<Siren />}>
            <p className="num display text-4xl">
              {p.safety_car_races}
              <span className="text-xl text-muted">/{p.races}</span>
            </p>
            <p className="text-sm text-muted">
              {t("dna.neutralNote", { vsc: p.vsc_races, wet: p.wet_races })}
            </p>
          </Tile>
          <Tile label={t("dna.passes")} icon={<Users />}>
            <p className="num display text-4xl">
              {p.passes_per_race == null ? "—" : f.number(p.passes_per_race, 0)}
            </p>
            <p className="text-sm text-muted">{t("dna.passesNote")}</p>
          </Tile>
          <Tile label={t("dna.undercut")} icon={<ArrowLeftRight />}>
            <p className="flex items-center gap-2">
              <span className="num display text-4xl">
                {undercutRate === null ? "—" : f.percent(undercutRate)}
              </span>
            </p>
            <p className="text-sm text-muted">
              {t("stops.undercutNote", { ok: p.undercut_successes, n: p.undercut_attempts })}
            </p>
          </Tile>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            {p.circuit.outline && (
              <Panel title={t("dna.layout")} icon={<Octagon />} bodyClassName="items-center p-6">
                <CircuitMark
                  path={p.circuit.outline}
                  stroke="var(--color-ink)"
                  width={2}
                  className="size-64 max-w-full"
                />
              </Panel>
            )}
            <Panel title={t("dna.ranks")} icon={<ListOrdered />} bodyClassName="gap-3 p-5">
              {ranks.map((r) => (
                <div key={r.key} className="flex flex-col gap-1">
                  <p className="flex items-baseline justify-between gap-2 text-sm">
                    <span>{r.label}</span>
                    <span>
                      <span className="num font-semibold">{r.value}</span>
                      <span className="ml-2 text-xs text-muted">
                        {t("dna.rank", { rank: f.ordinal(r.rank), of: r.of })}
                      </span>
                    </span>
                  </p>
                  <span className="relative h-1.5 rounded-full bg-raised" aria-hidden="true">
                    <span
                      className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel bg-mark"
                      style={{
                        left: `${String(r.of <= 1 ? 50 : ((r.of - r.rank) / (r.of - 1)) * 100)}%`,
                      }}
                    />
                  </span>
                </div>
              ))}
              <p className="text-xs text-muted">{t("dna.ranksNote", { n: all.length })}</p>
            </Panel>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <Panel title={t("dna.strategies")} icon={<Trophy />} bodyClassName="gap-3 p-5">
              <div className="flex flex-wrap gap-2">
                {p.winning_stops.map((w) => (
                  <span key={w.stops} className="rounded-lg bg-raised px-3 py-1.5 text-sm">
                    <span className="num font-bold">{w.races}</span>{" "}
                    <span className="text-muted">
                      {w.stops === 1 ? t("dna.wonWithOne") : t("dna.wonWith", { n: w.stops })}
                    </span>
                  </span>
                ))}
              </div>
              <ul className="flex flex-col divide-y divide-line">
                {strategies.map((h) => (
                  <li key={h.session_id} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="num w-12 font-bold">{h.year}</span>
                    {h.winner && (
                      <span className="min-w-40 flex-1">
                        <DriverChip
                          driver={h.winner}
                          colour={h.winner_colour}
                          size="size-7"
                          sub={h.winner_team?.name}
                        />
                      </span>
                    )}
                    <span
                      className="flex items-center gap-1"
                      aria-label={h.winner_strategy.join(" → ")}
                    >
                      {h.winner_strategy.map((c, i) => (
                        <CompoundBadge key={`${c}-${String(i)}`} compound={c} />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title={t("dna.history")} icon={<ListOrdered />}>
              <div className="relative overflow-x-auto">
                <table className="data-table text-sm">
                  <caption className="sr-only">{t("dna.history")}</caption>
                  <thead>
                    <tr>
                      <th className="num">{t("col.season")}</th>
                      <th>{t("col.winner")}</th>
                      <th className="num">{t("dna.passes")}</th>
                      <th className="num">SC · VSC</th>
                      <th className="num">{t("dna.pitLoss")}</th>
                      <th className="num">{t("dash.fastestLap")}</th>
                      <th className="num">{t("stops.undercuts")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.history.map((h) => (
                      <tr key={h.session_id}>
                        <td className="num font-bold">
                          <Link to={`/events/${String(h.event_id)}`} className="hover:underline">
                            {h.year}
                          </Link>
                          {h.wet && (
                            <span className="ml-1 text-xs text-t-blue">{t("dna.wet")}</span>
                          )}
                        </td>
                        <td>
                          {h.winner ? (
                            <DriverChip driver={h.winner} colour={h.winner_colour} size="size-6" />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="num">{h.passes ?? "—"}</td>
                        <td className="num">
                          {h.safety_cars} · {h.virtual_safety_cars}
                          {h.red_flags > 0 && (
                            <span className="ml-1 text-loss">
                              · {t("dna.red", { n: h.red_flags })}
                            </span>
                          )}
                        </td>
                        <td
                          className={`num ${h.pit_loss_reliable ? "" : "text-muted"}`}
                          title={h.pit_loss_reliable ? undefined : t("stops.unreliable")}
                        >
                          {f.seconds(h.pit_loss_s, 1)}
                          {h.pit_loss_s != null && !h.pit_loss_reliable && " *"}
                        </td>
                        <td className="num">{f.lapTime(h.fastest_lap_s)}</td>
                        <td className="num">
                          {h.undercut_attempts === 0
                            ? "—"
                            : `${String(h.undercut_successes)}/${String(h.undercut_attempts)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-line px-5 py-3 text-sm">
                <Link
                  to={`/analysis/pace?session=${String(p.latest_session_id)}`}
                  className="font-semibold hover:underline"
                >
                  {t("dna.paceLink")}
                </Link>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

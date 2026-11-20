import type { Schema } from "@stintline/api-types";
import { Trophy } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/layout/Panel";
import { CircuitMark } from "@/components/racing/CircuitMark";
import { Flag } from "@/components/racing/Flag";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { teamColour } from "@/lib/teams";
import { useSearchParamsState } from "@/lib/useSearchParam";

import { useCircuits } from "../api";
import { AnalysisTabs } from "./AnalysisParts";
import { CircuitDetail } from "./CircuitPage";

export type Profile = Schema<"CircuitProfile">;

const SORTS = ["calendar", "pitLoss", "degradation", "passes", "topSpeed", "throttle"] as const;
type Sort = (typeof SORTS)[number];

const SORT_VALUE: Record<Exclude<Sort, "calendar">, (p: Profile) => number | null | undefined> = {
  pitLoss: (p) => p.pit_loss_s,
  degradation: (p) => p.degradation_s_per_lap,
  passes: (p) => p.passes_per_race,
  topSpeed: (p) => p.top_speed_kph,
  throttle: (p) => p.full_throttle_share,
};

export function CircuitsPage() {
  const { ref } = useParams();
  return ref ? <CircuitDetail circuitRef={ref} /> : <CircuitList />;
}

function CircuitList() {
  const { t } = useI18n();
  const [params, update] = useSearchParamsState();
  const sort: Sort = SORTS.find((s) => s === params.get("sort")) ?? "calendar";
  const circuits = useCircuits();
  const list = circuits.data ?? [];
  const sorted =
    sort === "calendar"
      ? list
      : [...list].sort(
          (a, b) => (SORT_VALUE[sort](b) ?? -Infinity) - (SORT_VALUE[sort](a) ?? -Infinity),
        );
  const maxDeg = Math.max(...list.map((p) => p.degradation_s_per_lap ?? 0), 0.01);

  return (
    <div className="flex flex-col">
      <PageHeader
        terms={["pitLoss", "degradation", "fullThrottle", "safetyCar"]}
        title={t("dna.title")}
        actions={
          <Select
            label={t("dna.sort")}
            value={sort}
            onChange={(event) => {
              update({ sort: event.target.value === "calendar" ? null : event.target.value });
            }}
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`dna.sort.${s}`)}
              </option>
            ))}
          </Select>
        }
      >
        {t("dna.intro")}
      </PageHeader>
      <AnalysisTabs />
      {circuits.isError ? (
        <ErrorState error={circuits.error} onRetry={() => void circuits.refetch()} />
      ) : !circuits.data ? (
        <Skeleton className="h-[60vh]" />
      ) : list.length === 0 ? (
        <EmptyState title={t("dna.empty")} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {sorted.map((p) => (
            <li key={p.circuit.ref}>
              <CircuitCard profile={p} maxDeg={maxDeg} />
            </li>
          ))}
          <li className={fillSpan(list.length)}>
            <Records profiles={list} />
          </li>
        </ul>
      )}
    </div>
  );
}

/** Column span of the records panel: the slots the last row of cards leaves, else a full row.
 * Literal classes so Tailwind keeps them. */
const SM_SPAN = ["sm:col-span-2", "sm:col-span-1"] as const;

const XL_SPAN = ["xl:col-span-3", "xl:col-span-2", "xl:col-span-1"] as const;

const XXL_SPAN = ["2xl:col-span-4", "2xl:col-span-3", "2xl:col-span-2", "2xl:col-span-1"] as const;

function fillSpan(cards: number): string {
  return [SM_SPAN[cards % 2], XL_SPAN[cards % 3], XXL_SPAN[cards % 4]].join(" ");
}

/** The extreme circuit for each figure: tagged facts that fill the end of the grid. */
function Records({ profiles }: { profiles: readonly Profile[] }) {
  const { t, f, locale } = useI18n();
  const top = (value: (p: Profile) => number | null | undefined) =>
    [...profiles]
      .filter((p) => value(p) != null)
      .sort((a, b) => (value(b) ?? 0) - (value(a) ?? 0))[0];
  const facts = (
    [
      [
        "topSpeed",
        top((p) => p.top_speed_kph),
        (p: Profile) => `${f.number(p.top_speed_kph ?? 0, 0)} km/h`,
      ],
      [
        "throttle",
        top((p) => p.full_throttle_share),
        (p: Profile) => f.percent(p.full_throttle_share ?? 0),
      ],
      ["zones", top((p) => p.braking_zones), (p: Profile) => f.number(p.braking_zones ?? 0, 0)],
      ["pitLoss", top((p) => p.pit_loss_s), (p: Profile) => f.seconds(p.pit_loss_s, 1)],
      [
        "deg",
        top((p) => p.degradation_s_per_lap),
        (p: Profile) => t("dna.perLap", { v: f.number(p.degradation_s_per_lap ?? 0, 3) }),
      ],
      [
        "passes",
        top((p) => p.passes_per_race),
        (p: Profile) => f.number(p.passes_per_race ?? 0, 0),
      ],
      [
        "sc",
        top((p) => (p.races ? p.safety_car_races / p.races : null)),
        (p: Profile) => `${String(p.safety_car_races)}/${String(p.races)}`,
      ],
    ] as const
  ).filter((x): x is [(typeof x)[0], Profile, (typeof x)[2]] => x[1] !== undefined);
  return (
    <Panel title={t("dna.records")} icon={<Trophy />} className="h-full">
      <ul className="grid flex-1 grid-cols-1 divide-line sm:grid-cols-2">
        {facts.map(([key, p, value]) => (
          <li key={key} className="flex items-center gap-3 border-b border-line px-5 py-3">
            {p.circuit.outline && (
              <CircuitMark
                path={p.circuit.outline}
                stroke="var(--color-muted)"
                width={4}
                className="size-9 shrink-0"
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold tracking-wide text-muted uppercase">
                {t(`dna.record.${key}`)}
              </span>
              <Link
                to={`/circuits/${p.circuit.ref}`}
                className="flex items-center gap-2 font-semibold hover:underline"
              >
                <Flag country={p.circuit.country} />
                <span className="truncate">
                  {eventName(p.history[0]?.name ?? p.circuit.name, locale)}
                </span>
              </Link>
            </span>
            <span className="num shrink-0 font-semibold">{value(p)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function CircuitCard({ profile: p, maxDeg }: { profile: Profile; maxDeg: number }) {
  const { t, f, locale } = useI18n();
  const latest = p.history[0];
  return (
    <article className="glass relative flex h-full flex-col gap-4 rounded-[20px] p-4 hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-muted">
            <Flag country={p.circuit.country} />
            {countryName(p.circuit.country, locale)}
          </p>
          <h2 className="text-lg leading-tight font-bold">
            <Link
              to={`/circuits/${p.circuit.ref}`}
              className="after:absolute after:inset-0 hover:underline"
            >
              {p.circuit.name}
            </Link>
          </h2>
          <p className="text-sm text-muted">
            {latest ? eventName(latest.name, locale) : p.circuit.locality} ·{" "}
            {p.races === 1 ? t("dna.race") : t("dna.races", { n: p.races })}
          </p>
        </div>
        {p.circuit.outline && (
          <CircuitMark
            path={p.circuit.outline}
            stroke={latest?.winner_colour ? teamColour(latest.winner_colour) : "var(--color-muted)"}
            width={2.5}
            className="size-20 shrink-0"
          />
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Fig
          label={t("dna.length")}
          value={p.lap_length_m == null ? "—" : `${f.number(p.lap_length_m / 1000, 2)} km`}
        />
        <Fig
          label={t("dna.topSpeed")}
          value={p.top_speed_kph == null ? "—" : f.number(p.top_speed_kph, 0)}
          unit="km/h"
        />
        <Fig
          label={t("dna.throttle")}
          value={p.full_throttle_share == null ? "—" : f.percent(p.full_throttle_share)}
        />
        <Fig label={t("dna.pitLoss")} value={f.seconds(p.pit_loss_s, 1)} />
        <Fig label={t("dna.sc")} value={`${String(p.safety_car_races)}/${String(p.races)}`} />
        <Fig
          label={t("dna.passes")}
          value={p.passes_per_race == null ? "—" : f.number(p.passes_per_race, 0)}
        />
      </dl>
      <div className="mt-auto flex flex-col gap-1">
        <p className="flex justify-between text-xs text-muted">
          <span>{t("dna.deg")}</span>
          <span className="num">
            {p.degradation_s_per_lap == null
              ? "—"
              : t("dna.perLap", { v: f.number(p.degradation_s_per_lap, 3) })}
          </span>
        </p>
        <span className="h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden="true">
          <span
            className="block h-full rounded-full bg-tyre-soft"
            style={{ width: `${String(((p.degradation_s_per_lap ?? 0) / maxDeg) * 100)}%` }}
          />
        </span>
      </div>
    </article>
  );
}

function Fig({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg bg-raised px-1 py-1.5">
      <dt className="text-[0.65rem] font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="num text-sm font-semibold">
        {value}
        {unit && <span className="ml-0.5 text-[0.65rem] text-muted">{unit}</span>}
      </dd>
    </div>
  );
}

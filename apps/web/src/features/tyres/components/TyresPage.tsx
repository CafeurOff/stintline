import type { Schema } from "@stintline/api-types";

import { CompoundBadge } from "@/components/racing/CompoundBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useSessionDetail, useStints } from "@/features/race/api";
import { byFinish, driverCode, driverName, type Entry } from "@/features/race/entries";
import { useSessionId } from "@/features/race/useSessionId";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { compoundInfo, RACE_COMPOUNDS } from "@/lib/compounds";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";
import { intListParam, useSearchParamsState } from "@/lib/useSearchParam";

import { useDegradation } from "../api";
import { DegradationChart, type SeriesStyle } from "./DegradationChart";

/** Drivers drawn when `?cars=` is absent: the podium. */
const DEFAULT_DRIVERS = 3;

function compoundOrder(compound: string): number {
  const index = (RACE_COMPOUNDS as readonly string[]).indexOf(compound);
  return index === -1 ? RACE_COMPOUNDS.length : index;
}

export function TyresPage() {
  const sessionId = useSessionId();
  if (sessionId === null) return <NotFoundPage />;
  return <Tyres sessionId={sessionId} />;
}

function Tyres({ sessionId }: { sessionId: number }) {
  const { t, f } = useI18n();
  const session = useSessionDetail(sessionId);
  const stints = useStints(sessionId);
  const degradation = useDegradation(sessionId);
  const [params, update] = useSearchParamsState();

  if (session.isError)
    return <ErrorState error={session.error} onRetry={() => void session.refetch()} />;
  if (!session.data) return <Skeleton className="h-96" />;
  const totalLaps = session.data.total_laps ?? 0;
  const entries = [...session.data.entries].sort(byFinish);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <section aria-labelledby="wear-title">
        <h1 id="wear-title" className="sr-only">
          {t("tyres.title")}
        </h1>
        {degradation.isPending ? (
          <Skeleton className="h-16" />
        ) : degradation.isError ? (
          <ErrorState error={degradation.error} onRetry={() => void degradation.refetch()} />
        ) : (
          <ul className="flex flex-col gap-2 text-lg">
            {[...degradation.data.compounds]
              .sort((a, b) => compoundOrder(a.compound) - compoundOrder(b.compound))
              .map((item) => (
                <li key={item.compound} className="flex flex-wrap items-center gap-x-3">
                  <CompoundBadge compound={item.compound} />
                  <span className="font-bold">
                    {t(`compoundPlural.${compoundInfo(item.compound).key}`)}
                  </span>
                  <span>{t("tyres.wear", { ms: f.millis(item.slope_s_per_lap) })}</span>
                  <span className="text-muted">
                    {t("tyres.fresh", { time: f.lapTime(item.new_tyre_pace_s) })}
                    {item.low_confidence ? ` · ${t("tyres.rough")}` : ""}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="strategies-title">
        <h2 id="strategies-title" className="mb-3 text-xl font-bold">
          {t("tyres.strategies")}
        </h2>
        {stints.isPending ? (
          <Skeleton className="h-80" />
        ) : stints.isError ? (
          <ErrorState error={stints.error} onRetry={() => void stints.refetch()} />
        ) : (
          <ol className="flex flex-col gap-1">
            {[...stints.data].sort(byFinish).map((row) => (
              <li
                key={row.car_number}
                className="grid grid-cols-[2rem_3rem_1fr] items-center gap-2"
              >
                <span className="tabular text-muted">{row.finish_position ?? "–"}</span>
                <span className="font-bold" title={driverName(row)}>
                  <span
                    aria-hidden="true"
                    className="mr-1.5 inline-block h-3 w-1 align-middle"
                    style={{ backgroundColor: teamColour(row.team_colour) }}
                  />
                  {driverCode(row)}
                  <span className="sr-only"> {driverName(row)}</span>
                </span>
                <span className="flex h-5 gap-0.5">
                  {row.stints.map((stint) => {
                    if (stint.lap_start == null || stint.lap_end == null || totalLaps === 0)
                      return null;
                    const info = compoundInfo(stint.compound);
                    const used = (stint.tyre_age_at_start ?? 0) > 0;
                    const label = `${t(`compound.${info.key}`)} ${stint.lap_start}–${stint.lap_end}`;
                    return (
                      <span
                        key={stint.stint_number}
                        role="img"
                        aria-label={label}
                        title={label}
                        className="flex items-center overflow-hidden rounded-sm pl-1 text-[0.7rem] font-bold text-tyre-ink"
                        style={{
                          backgroundColor: info.fill,
                          width: `${((stint.lap_end - stint.lap_start + 1) / totalLaps) * 100}%`,
                        }}
                      >
                        <span aria-hidden="true">
                          {info.letter}
                          {used ? "*" : ""}
                        </span>
                      </span>
                    );
                  })}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-2 text-sm text-muted">{t("tyres.used")}</p>
      </section>

      <section aria-labelledby="chart-title">
        <h2 id="chart-title" className="text-xl font-bold">
          {t("tyres.chart")}
        </h2>
        <p className="mb-3 text-muted">{t("tyres.chartNote")}</p>
        {degradation.isPending ? (
          <Skeleton className="h-80" />
        ) : degradation.isError ? null : degradation.data.stints.length === 0 ? (
          <EmptyState title={t("tyres.noFit")} />
        ) : (
          <WearChart
            stints={degradation.data.stints}
            entries={entries}
            selectedParam={intListParam(params, "cars")}
            onChange={(cars) => {
              update({ cars: cars.join(",") });
            }}
          />
        )}
      </section>
    </div>
  );
}

function WearChart({
  stints,
  entries,
  selectedParam,
  onChange,
}: {
  stints: readonly Schema<"StintFit">[];
  entries: readonly Entry[];
  selectedParam: number[];
  onChange: (cars: number[]) => void;
}) {
  const { t, f } = useI18n();
  const fitted = new Set(stints.map((s) => s.car_number));
  const drivers = entries.filter((e) => fitted.has(e.car_number));
  const requested = selectedParam.filter((car) => fitted.has(car));
  const selected =
    requested.length > 0 ? requested : drivers.slice(0, DEFAULT_DRIVERS).map((e) => e.car_number);

  const styles = new Map<number, SeriesStyle>();
  const teamSeen = new Map<string, number>();
  for (const e of drivers) {
    const index = teamSeen.get(e.team.ref) ?? 0;
    teamSeen.set(e.team.ref, index + 1);
    styles.set(e.car_number, {
      colour: teamColour(e.team_colour),
      dashed: index > 0,
      label: driverCode(e),
    });
  }
  const styleFor = (car: number): SeriesStyle =>
    styles.get(car) ?? { colour: teamColour(null), dashed: false, label: `#${car}` };
  const visible = stints.filter((s) => selected.includes(s.car_number));

  return (
    <>
      <fieldset className="mb-3">
        <legend className="sr-only">{t("tyres.drivers")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {drivers.map((e) => {
            const checked = selected.includes(e.car_number);
            const style = styleFor(e.car_number);
            return (
              <label
                key={e.car_number}
                title={driverName(e)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-bold has-focus-visible:outline-2 has-focus-visible:outline-mark has-enabled:cursor-pointer ${
                  checked ? "border-line-strong text-ink" : "border-line text-muted"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  disabled={checked && selected.length === 1}
                  onChange={() => {
                    onChange(
                      checked
                        ? selected.filter((c) => c !== e.car_number)
                        : [...selected, e.car_number],
                    );
                  }}
                />
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: style.colour }}
                />
                {style.label}
                <span className="sr-only"> {driverName(e)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <DegradationChart
        label={t("tyres.chartLabel", {
          drivers: visible
            .map((s) => styleFor(s.car_number).label)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(", "),
        })}
        stints={visible}
        styleFor={styleFor}
      />
      <details className="mt-3">
        <summary className="cursor-pointer text-muted hover:text-ink">{t("tyres.table")}</summary>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-left">
            <thead className="text-sm text-muted">
              <tr>
                {(
                  [
                    "tyres.col.driver",
                    "tyres.col.stint",
                    "tyres.col.compound",
                    "tyres.col.wear",
                    "tyres.col.laps",
                  ] as const
                ).map((key) => (
                  <th key={key} scope="col" className="py-1 pr-4 font-normal">
                    {t(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular">
              {visible.map((s) => (
                <tr key={`${s.car_number}-${s.stint}`} className="border-t border-line">
                  <th scope="row" className="py-1 pr-4 font-bold">
                    {styleFor(s.car_number).label}
                  </th>
                  <td className="py-1 pr-4">{s.stint}</td>
                  <td className="py-1 pr-4">
                    <CompoundBadge compound={s.compound} />
                  </td>
                  <td className="py-1 pr-4">{f.millis(s.slope_s_per_lap)}</td>
                  <td className="py-1">{s.n_laps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

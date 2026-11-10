import type { Schema } from "@stintline/api-types";
import { useState } from "react";

import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";
import { intListParam, useSearchParamsState } from "@/lib/useSearchParam";

import { useTelemetryCompare, useTelemetryLaps } from "./api";
import { carStyles } from "./colours";
import { LapMap } from "./LapMap";
import { TelemetryChart } from "./TelemetryChart";

type Compare = Schema<"TelemetryCompare">;
const MAX_CARS = 3;
/** Two zones of different drivers are the same corner when they start this close. */
const SAME_CORNER_M = 80;

/** Telemetry with a driver picker (the choice is kept in `?tele=`). Two fastest by default. */
export function TelemetrySection({ sessionId }: { sessionId: number }) {
  const { t } = useI18n();
  const laps = useTelemetryLaps(sessionId);
  const [params, update] = useSearchParamsState();
  if (laps.isError) return <ErrorState error={laps.error} onRetry={() => void laps.refetch()} />;
  if (!laps.data) return <Skeleton className="h-[520px]" />;
  if (laps.data.length === 0) {
    return <EmptyState title={t("telemetry.title")}>{t("telemetry.none")}</EmptyState>;
  }
  const available = laps.data.map((lap) => lap.entry.car_number);
  const chosen = intListParam(params, "tele").filter((car) => available.includes(car));
  const cars = chosen.length > 0 ? chosen : available.slice(0, 2);
  const toggle = (car: number) => {
    const next = cars.includes(car) ? cars.filter((c) => c !== car) : [...cars, car];
    update({ tele: next.slice(-MAX_CARS).join(",") || null });
  };
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-muted">{t("telemetry.pick", { n: MAX_CARS })}</legend>
        <div className="flex flex-wrap gap-1.5">
          {laps.data.map((lap) => {
            const on = cars.includes(lap.entry.car_number);
            return (
              <button
                key={lap.entry.car_number}
                type="button"
                aria-pressed={on}
                aria-label={`${lap.entry.driver.given_name} ${lap.entry.driver.family_name}`}
                onClick={() => {
                  toggle(lap.entry.car_number);
                }}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-semibold transition ${
                  on ? "border-ink bg-raised text-ink" : "border-line text-muted hover:text-ink"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-3 w-1 rounded-full"
                  style={{ backgroundColor: teamColour(lap.entry.team_colour) }}
                />
                {lap.entry.driver.code}
              </button>
            );
          })}
        </div>
      </fieldset>
      <TelemetryView sessionId={sessionId} cars={cars} />
    </div>
  );
}

/** Fastest laps of `cars` compared: key numbers, the lap on the circuit, the traces. */
export function TelemetryView({ sessionId, cars }: { sessionId: number; cars: readonly number[] }) {
  const { t } = useI18n();
  const compare = useTelemetryCompare(sessionId, cars);
  const [cursor, setCursor] = useState<number | null>(null);
  if (compare.isError) {
    return <ErrorState error={compare.error} onRetry={() => void compare.refetch()} />;
  }
  if (!compare.data) return <Skeleton className="h-[520px]" />;
  const data = compare.data;
  const styles = carStyles(data.cars);
  return (
    <div className="flex flex-col gap-5">
      <Summary data={data} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <LapMap data={data} styles={styles} cursor={cursor} />
        <TelemetryChart data={data} styles={styles} cursor={cursor} onCursor={setCursor} />
      </div>
      <BrakingTable data={data} />
      <p className="text-sm text-muted">{t("telemetry.note")}</p>
    </div>
  );
}

function Summary({ data }: { data: Compare }) {
  const { t, f } = useI18n();
  const styles = carStyles(data.cars);
  return (
    <dl className="grid gap-3 sm:grid-cols-3" aria-label={t("telemetry.summary")}>
      {data.cars.map((car, index) => (
        <div
          key={car.car_number}
          className="flex flex-col gap-1 rounded-xl border-l-4 bg-panel px-4 py-3"
          style={{ borderLeftColor: styles[index]?.colour }}
        >
          <dt className="font-bold">
            {car.entry.driver.given_name} {car.entry.driver.family_name}
            <span className="ml-2 text-sm font-normal text-muted">
              {t("telemetry.lapN", { n: car.lap_number })}
            </span>
          </dt>
          <dd className="text-2xl font-bold tabular-nums">
            {f.lapTime(car.lap_time_s)}
            {index > 0 && data.cars[0] && (
              <span className="ml-2 text-base text-muted">
                {f.delta(car.lap_time_s - data.cars[0].lap_time_s, 3)}
              </span>
            )}
          </dd>
          <dd className="text-sm text-muted">
            {t("telemetry.facts", {
              speed: Math.round(car.max_speed_kph),
              full: f.percent(car.full_throttle_share),
              zones: car.braking_zones.length,
            })}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function BrakingTable({ data }: { data: Compare }) {
  const { t, f } = useI18n();
  const [reference, ...others] = data.cars;
  if (!reference) return null;
  const match = (car: Schema<"TelemetryCar">, start: number) =>
    car.braking_zones.find((z) => Math.abs(z.start_m - start) <= SAME_CORNER_M);
  return (
    <details className="rounded-xl bg-panel p-4">
      <summary className="cursor-pointer font-semibold">{t("telemetry.zones")}</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="data-table">
          <caption className="sr-only">{t("telemetry.zones")}</caption>
          <thead>
            <tr>
              <th className="num">#</th>
              <th className="num">{t("telemetry.zone.at")}</th>
              {data.cars.map((car) => (
                <th key={car.car_number} className="num">
                  {car.entry.driver.code} {t("telemetry.zone.speeds")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reference.braking_zones.map((zone, index) => (
              <tr key={zone.start_m}>
                <td className="num font-bold">{index + 1}</td>
                <td className="num">{f.number(zone.start_m / 1000, 2)} km</td>
                {[reference, ...others].map((car) => {
                  const same = match(car, zone.start_m);
                  return (
                    <td key={car.car_number} className="num">
                      {same ? `${String(same.entry_kph)} → ${String(same.min_kph)}` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

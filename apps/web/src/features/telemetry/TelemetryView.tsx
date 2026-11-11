import type { Schema } from "@stintline/api-types";
import { useState } from "react";

import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";
import { intListParam, useSearchParamsState } from "@/lib/useSearchParam";

import { useTelemetryCompare, useTelemetryLaps } from "./api";
import { type CarStyle, carStyles } from "./colours";
import { LapMap } from "./LapMap";
import {
  cornerSections,
  formatSection,
  indexRange,
  parseSection,
  type Section,
  sectionStats,
} from "./section";
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
  const [params, update] = useSearchParamsState();
  if (compare.isError) {
    return <ErrorState error={compare.error} onRetry={() => void compare.refetch()} />;
  }
  if (!compare.data) return <Skeleton className="h-[520px]" />;
  const data = compare.data;
  const styles = carStyles(data.cars);
  const section = parseSection(params.get("zoom"), data.length_m);
  const setSection = (next: Section | null) => {
    update({ zoom: next ? formatSection(next) : null });
  };
  return (
    <div className="flex flex-col gap-5">
      <Summary data={data} />
      <ZoomBar data={data} section={section} onSection={setSection} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <LapMap data={data} styles={styles} cursor={cursor} section={section} />
        <TelemetryChart
          data={data}
          styles={styles}
          cursor={cursor}
          onCursor={setCursor}
          section={section}
          onSection={setSection}
        />
      </div>
      {section && <SectionTable data={data} styles={styles} section={section} />}
      <BrakingTable data={data} />
      <p className="text-sm text-muted">{t("telemetry.note")}</p>
    </div>
  );
}

/** Zoom controls: a hint, one button per corner of the reference lap, and a reset. */
function ZoomBar({
  data,
  section,
  onSection,
}: {
  data: Compare;
  section: Section | null;
  onSection: (section: Section | null) => void;
}) {
  const { t, f } = useI18n();
  const corners = cornerSections(data.cars[0]?.braking_zones ?? [], data.length_m);
  const same = (a: Section) =>
    section !== null && Math.abs(a.start - section.start) < 1 && Math.abs(a.end - section.end) < 1;
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-panel p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {section
            ? t("telemetry.zoom.on", {
                from: f.number(section.start / 1000, 2),
                to: f.number(section.end / 1000, 2),
              })
            : t("telemetry.zoom.hint")}
        </p>
        {section && (
          <button
            type="button"
            onClick={() => {
              onSection(null);
            }}
            className="rounded-md bg-raised px-3 py-1 text-sm font-semibold hover:bg-line"
          >
            {t("telemetry.zoom.reset")}
          </button>
        )}
      </div>
      {corners.length > 0 && (
        <div
          role="group"
          aria-label={t("telemetry.zoom.corners")}
          className="flex flex-wrap gap-1.5"
        >
          {corners.map((corner, index) => (
            <button
              key={corner.start}
              type="button"
              aria-pressed={same(corner)}
              onClick={() => {
                onSection(corner);
              }}
              className="min-w-9 rounded-md border border-line px-2 py-1 text-sm font-bold tabular-nums hover:border-ink aria-pressed:border-mark aria-pressed:bg-mark aria-pressed:text-white"
            >
              {t("telemetry.zoom.corner", { n: index + 1 })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Each driver over the zoomed part: time, gain against the first driver, speeds, pedals. */
function SectionTable({
  data,
  styles,
  section,
}: {
  data: Compare;
  styles: readonly CarStyle[];
  section: Section;
}) {
  const { t, f } = useI18n();
  const [first, last] = indexRange(section, data.step_m, data.points);
  const rows = data.cars.map((car) => ({
    car,
    stats: sectionStats(car, data.step_m, first, last),
  }));
  const reference = rows[0]?.stats.time_s ?? 0;
  return (
    <div className="overflow-x-auto rounded-xl bg-panel p-4">
      <table className="data-table">
        <caption className="mb-2 text-left font-bold">{t("telemetry.section.title")}</caption>
        <thead>
          <tr>
            <th>{t("col.driver")}</th>
            <th className="num">{t("telemetry.section.time")}</th>
            <th className="num">{t("telemetry.section.gap")}</th>
            <th className="num">{t("telemetry.section.min")}</th>
            <th className="num">{t("telemetry.section.max")}</th>
            <th className="num">{t("telemetry.section.avg")}</th>
            <th className="num">{t("telemetry.section.full")}</th>
            <th className="num">{t("telemetry.section.brake")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ car, stats }, index) => (
            <tr key={car.car_number}>
              <td>
                <span className="flex items-center gap-2 font-semibold">
                  <span
                    aria-hidden="true"
                    className="h-3 w-1 rounded-full"
                    style={{ backgroundColor: styles[index]?.colour }}
                  />
                  {car.entry.driver.family_name}
                </span>
              </td>
              <td className="num font-bold">{f.number(stats.time_s, 3)} s</td>
              <td
                className={`num font-semibold ${
                  index === 0 ? "text-muted" : stats.time_s <= reference ? "text-gain" : "text-loss"
                }`}
              >
                {index === 0 ? "—" : f.delta(stats.time_s - reference, 3)}
              </td>
              <td className="num">{Math.round(stats.min_kph)} km/h</td>
              <td className="num">{Math.round(stats.max_kph)} km/h</td>
              <td className="num">{Math.round(stats.avg_kph)} km/h</td>
              <td className="num">{f.percent(stats.full_throttle_share)}</td>
              <td className="num">{f.percent(stats.braking_share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

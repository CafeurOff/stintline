import type { Schema } from "@stintline/api-types";

import { Link } from "react-router";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useReplay, useStints } from "@/features/race/api";
import { driverCode, driverName } from "@/features/race/entries";
import { buildClock } from "@/features/race/replay";
import { TelemetrySection } from "@/features/telemetry/TelemetryView";
import { StrategyStrips } from "@/features/tyres/components/StrategyStrips";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";
import { intListParam, useSearchParamsState } from "@/lib/useSearchParam";

import { useLaps, useSectors } from "../api";
import { gapsByLap, type PerLap, placesGained, positionsByLap } from "../laps";
import { LapChart, type LapMark, type LapSeries } from "./LapChart";

type Entry = Schema<"Entry">;
type Chart = "positions" | "gaps" | "pace" | "tyres" | "sectors" | "telemetry";
const CHARTS: readonly Chart[] = ["positions", "gaps", "pace", "tyres", "sectors", "telemetry"];
/** Drivers highlighted when none are chosen: the podium. */
const DEFAULT_HIGHLIGHT = 3;
/** Lap-time lines drawn at once: more is unreadable. */
const MAX_PACE_DRIVERS = 6;
/** Gaps beyond this are lapped cars: the chart is cut there to stay readable. */
const MAX_GAP_S = 120;

interface RaceAnalysisProps {
  sessionId: number;
  entries: readonly Entry[];
  neutralisations: readonly Schema<"Neutralisation">[];
  totalLaps: number;
  /** Stewards' decisions to draw on the running-order charts. */
  marks?: readonly LapMark[];
}

/** Key facts of a race, then lap-by-lap charts for those who want the details. */
export function RaceAnalysis({
  sessionId,
  entries,
  neutralisations,
  totalLaps,
  marks = [],
}: RaceAnalysisProps) {
  const { t } = useI18n();
  const [params, update] = useSearchParamsState();
  const chart: Chart = CHARTS.find((c) => c === params.get("chart")) ?? "positions";
  const chosen = intListParam(params, "drivers").filter((car) =>
    entries.some((e) => e.car_number === car),
  );
  const highlighted = new Set(
    chosen.length > 0 ? chosen : entries.slice(0, DEFAULT_HIGHLIGHT).map((e) => e.car_number),
  );
  const toggle = (car: number) => {
    const next = new Set(highlighted);
    if (next.has(car)) next.delete(car);
    else next.add(car);
    update({ drivers: [...next].join(",") || null });
  };

  return (
    <section aria-labelledby="analysis-title" className="flex flex-col gap-6">
      <div>
        <h2 id="analysis-title" className="text-2xl font-bold">
          {t("analysis.title")}
        </h2>
        <p className="text-muted">{t("analysis.intro")}</p>
      </div>
      <RaceFacts sessionId={sessionId} entries={entries} neutralisations={neutralisations} />
      <SegmentedControl
        legend={t("analysis.chart")}
        hideLegend
        options={CHARTS.map((value) => ({ value, label: t(`analysis.tab.${value}`) }))}
        value={chart}
        onChange={(value) => {
          update({ chart: value === "positions" ? null : value });
        }}
      />
      {(chart === "positions" || chart === "gaps" || chart === "pace") && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm text-muted">{t("analysis.pick")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {entries.map((entry) => {
              const on = highlighted.has(entry.car_number);
              return (
                <button
                  key={entry.car_number}
                  type="button"
                  aria-pressed={on}
                  aria-label={driverName(entry)}
                  onClick={() => {
                    toggle(entry.car_number);
                  }}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-semibold transition ${
                    on ? "border-ink bg-raised text-ink" : "border-line text-muted hover:text-ink"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-1 rounded-full"
                    style={{ backgroundColor: teamColour(entry.team_colour) }}
                  />
                  {driverCode(entry)}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      {chart === "positions" || chart === "gaps" ? (
        <RunningChart
          sessionId={sessionId}
          entries={entries}
          totalLaps={totalLaps}
          highlighted={highlighted}
          kind={chart}
          marks={marks}
        />
      ) : chart === "pace" ? (
        <>
          <PaceChart
            sessionId={sessionId}
            entries={entries}
            totalLaps={totalLaps}
            cars={[...highlighted].slice(0, MAX_PACE_DRIVERS)}
          />
          <Link
            to={`/analysis/pace?session=${String(sessionId)}`}
            className="self-start text-sm font-semibold text-mark-text hover:underline"
          >
            {t("analysis.paceLink")}
          </Link>
        </>
      ) : chart === "tyres" ? (
        <Tyres sessionId={sessionId} totalLaps={totalLaps} />
      ) : chart === "telemetry" ? (
        <TelemetrySection sessionId={sessionId} />
      ) : (
        <Sectors sessionId={sessionId} entries={entries} />
      )}
    </section>
  );
}

function teamSeries(entries: readonly Entry[], values: Map<number, PerLap>): LapSeries[] {
  const seen = new Set<string>();
  return entries.flatMap((entry) => {
    const row = values.get(entry.car_number);
    if (!row) return [];
    const colour = teamColour(entry.team_colour);
    const dashed = seen.has(colour);
    seen.add(colour);
    return [
      {
        key: entry.car_number,
        label: driverCode(entry),
        colour: entry.team_colour,
        dashed,
        values: row,
      },
    ];
  });
}

function RaceFacts({
  sessionId,
  entries,
  neutralisations,
}: {
  sessionId: number;
  entries: readonly Entry[];
  neutralisations: readonly Schema<"Neutralisation">[];
}) {
  const { t, f } = useI18n();
  const stints = useStints(sessionId);
  const [winner, second] = entries;
  const facts: string[] = [];
  if (winner && second && winner.race_time_s != null && second.race_time_s != null) {
    facts.push(
      t("analysis.fact.win", {
        winner: driverName(winner),
        gap: f.seconds(second.race_time_s - winner.race_time_s, 3),
        second: driverName(second),
      }),
    );
  }
  const gainer = entries
    .map((e) => ({ e, gained: placesGained(e.grid_position, e.finish_position) }))
    .filter((x): x is { e: Entry; gained: number } => x.gained !== null && x.gained > 0)
    .sort((a, b) => b.gained - a.gained)[0];
  if (gainer) {
    facts.push(
      t("analysis.fact.gainer", {
        name: driverName(gainer.e),
        n: gainer.gained,
        grid: f.ordinal(gainer.e.grid_position ?? 0),
        finish: f.ordinal(gainer.e.finish_position ?? 0),
      }),
    );
  }
  const fastest = entries.find((e) => e.fastest_lap_rank === 1 && e.fastest_lap_s != null);
  if (fastest) {
    facts.push(
      t("analysis.fact.fastest", {
        name: driverName(fastest),
        time: f.lapTime(fastest.fastest_lap_s),
      }),
    );
  }
  const counts = { SC: 0, VSC: 0, RED: 0 };
  for (const n of neutralisations) {
    counts[n.status] += 1;
  }
  facts.push(
    counts.SC + counts.VSC + counts.RED === 0
      ? t("analysis.fact.clean")
      : t("analysis.fact.neutralised", { sc: counts.SC, vsc: counts.VSC, red: counts.RED }),
  );
  if (stints.data) {
    const stops = stints.data.reduce((sum, row) => sum + Math.max(row.stints.length - 1, 0), 0);
    facts.push(t("analysis.fact.stops", { n: stops }));
  }

  return (
    <ul aria-label={t("analysis.facts")} className="grid gap-x-8 gap-y-2 md:grid-cols-2">
      {facts.map((fact) => (
        <li key={fact} className="flex gap-2">
          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-mark" />
          <span>{fact}</span>
        </li>
      ))}
    </ul>
  );
}

function RunningChart({
  sessionId,
  entries,
  totalLaps,
  highlighted,
  kind,
  marks,
}: {
  sessionId: number;
  entries: readonly Entry[];
  totalLaps: number;
  highlighted: ReadonlySet<number>;
  kind: "positions" | "gaps";
  marks: readonly LapMark[];
}) {
  const { t, f } = useI18n();
  const replay = useReplay(sessionId);
  if (replay.isError)
    return <ErrorState error={replay.error} onRetry={() => void replay.refetch()} />;
  if (!replay.data) return <Skeleton className="h-[420px]" />;
  const finishers = new Set(
    entries.filter((e) => e.finish_position != null).map((e) => e.car_number),
  );
  const clocks = replay.data.cars.map((car) => buildClock(car, finishers.has(car.car_number)));
  const laps = replay.data.total_laps || totalLaps;

  if (kind === "positions") {
    return (
      <>
        <p className="text-sm text-muted">{t("analysis.positionsNote")}</p>
        <LapChart
          label={t("analysis.positionsLabel")}
          series={teamSeries(entries, positionsByLap(clocks, laps))}
          highlighted={highlighted}
          totalLaps={laps}
          invert
          yDomain={[1, entries.length]}
          xLabel={t("analysis.lap")}
          marks={marks}
        />
      </>
    );
  }
  const gaps = gapsByLap(clocks, laps);
  for (const row of gaps.values()) {
    row.forEach((value, i) => {
      if (value !== null && value > MAX_GAP_S) row[i] = null;
    });
  }
  return (
    <>
      <p className="text-sm text-muted">{t("analysis.gapsNote")}</p>
      <LapChart
        label={t("analysis.gapsLabel")}
        series={teamSeries(entries, gaps)}
        highlighted={highlighted}
        totalLaps={laps}
        invert
        yFormat={(value) => f.seconds(value, 0)}
        xLabel={t("analysis.lap")}
        marks={marks}
      />
    </>
  );
}

function PaceChart({
  sessionId,
  entries,
  totalLaps,
  cars,
}: {
  sessionId: number;
  entries: readonly Entry[];
  totalLaps: number;
  cars: readonly number[];
}) {
  const { t, f } = useI18n();
  const laps = useLaps(sessionId, cars, cars.length > 0);
  if (cars.length === 0) return <EmptyState title={t("analysis.pickFirst")} />;
  if (laps.isError) return <ErrorState error={laps.error} onRetry={() => void laps.refetch()} />;
  if (!laps.data) return <Skeleton className="h-[420px]" />;
  const values = new Map<number, PerLap>(
    cars.map((car) => [car, Array<number | null>(totalLaps).fill(null)]),
  );
  for (const lap of laps.data) {
    const row = values.get(lap.car_number);
    if (row && lap.excluded === null && lap.time_s != null && lap.lap <= totalLaps) {
      row[lap.lap - 1] = lap.time_s;
    }
  }
  const shown = entries.filter((e) => cars.includes(e.car_number));
  const times = [...values.values()].flat().filter((v): v is number => v !== null);
  if (times.length === 0) return <EmptyState title={t("analysis.noPace")} />;
  const pad = 0.4;
  return (
    <>
      <p className="text-sm text-muted">{t("analysis.paceNote", { n: MAX_PACE_DRIVERS })}</p>
      <LapChart
        label={t("analysis.paceLabel")}
        series={teamSeries(shown, values)}
        highlighted={new Set(cars)}
        totalLaps={totalLaps}
        yDomain={[Math.min(...times) - pad, Math.max(...times) + pad]}
        yFormat={(value) => f.lapTime(value)}
        xLabel={t("analysis.lap")}
      />
    </>
  );
}

function Tyres({ sessionId, totalLaps }: { sessionId: number; totalLaps: number }) {
  const { t } = useI18n();
  const stints = useStints(sessionId);
  if (stints.isError)
    return <ErrorState error={stints.error} onRetry={() => void stints.refetch()} />;
  if (!stints.data) return <Skeleton className="h-80" />;
  return (
    <>
      <StrategyStrips rows={stints.data} totalLaps={totalLaps} />
      <p className="text-sm text-muted">{t("tyres.used")}</p>
    </>
  );
}

function Sectors({ sessionId, entries }: { sessionId: number; entries: readonly Entry[] }) {
  const { t, f } = useI18n();
  const sectors = useSectors(sessionId, true);
  if (sectors.isError)
    return <ErrorState error={sectors.error} onRetry={() => void sectors.refetch()} />;
  if (!sectors.data) return <Skeleton className="h-80" />;
  const byCar = new Map(entries.map((e) => [e.car_number, e]));
  const rows = sectors.data.filter((row) => byCar.has(row.car_number));
  const best = (pick: (row: (typeof rows)[number]) => number | null | undefined, max = false) => {
    const values = rows.map(pick).filter((v): v is number => v != null);
    return values.length === 0 ? null : max ? Math.max(...values) : Math.min(...values);
  };
  const bestLap = best((r) => r.best_lap_s);
  const bestSectors = [0, 1, 2].map((i) => best((r) => r.best_sectors_s[i]));
  const bestIdeal = best((r) => r.ideal_lap_s);
  const topSpeed = best((r) => r.top_speed_kph, true);
  const cell = (value: number | null | undefined, top: number | null, text: string) => (
    <td className={`num ${value != null && value === top ? "font-bold text-mark-text" : ""}`}>
      {value == null ? "—" : text}
    </td>
  );

  return (
    <>
      <p className="text-sm text-muted">{t("analysis.sectorsNote")}</p>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("col.driver")}</th>
              <th className="num">{t("analysis.bestLap")}</th>
              <th className="num">S1</th>
              <th className="num">S2</th>
              <th className="num">S3</th>
              <th className="num">{t("analysis.ideal")}</th>
              <th className="num">{t("analysis.topSpeed")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const entry = byCar.get(row.car_number);
              return (
                <tr key={row.car_number}>
                  <td className="font-semibold">
                    <span
                      aria-hidden="true"
                      className="mr-2 inline-block h-3 w-1 rounded-full align-middle"
                      style={{ backgroundColor: teamColour(entry?.team_colour) }}
                    />
                    {entry ? driverName(entry) : `#${String(row.car_number)}`}
                  </td>
                  {cell(row.best_lap_s, bestLap, f.lapTime(row.best_lap_s))}
                  {row.best_sectors_s.map((value, i) => (
                    <td
                      key={i}
                      className={`num ${value != null && value === bestSectors[i] ? "font-bold text-mark-text" : ""}`}
                    >
                      {value == null ? "—" : f.number(value, 3)}
                    </td>
                  ))}
                  {cell(row.ideal_lap_s, bestIdeal, f.lapTime(row.ideal_lap_s))}
                  {cell(row.top_speed_kph, topSpeed, `${String(row.top_speed_kph)} km/h`)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

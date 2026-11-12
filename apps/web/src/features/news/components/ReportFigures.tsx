import type { Schema } from "@stintline/api-types";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/Skeleton";
import { LapChart, type LapSeries } from "@/features/analysis/components/LapChart";
import { gapsByLap, type PerLap, positionsByLap } from "@/features/analysis/laps";
import { useReplay, useStints } from "@/features/race/api";
import { driverCode } from "@/features/race/entries";
import { buildClock } from "@/features/race/replay";
import { useTelemetryLaps } from "@/features/telemetry/api";
import { TelemetryView } from "@/features/telemetry/TelemetryView";
import { StrategyStrips } from "@/features/tyres/components/StrategyStrips";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

type Entry = Schema<"Entry">;
const TOP_POSITIONS = 10;
const TOP_GAPS = 5;
const TOP_TYRES = 10;
/** Gaps beyond this are lapped cars: the chart stops there to stay readable. */
const MAX_GAP_S = 90;

/** A chart in the article: a title, the chart, and one line saying how to read it. */
export function Figure({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-3 rounded-xl bg-panel p-4 sm:p-5">
      <h3 className="text-lg font-bold">{title}</h3>
      {children}
      {note && <figcaption className="text-sm text-muted">{note}</figcaption>}
    </figure>
  );
}

function series(entries: readonly Entry[], values: Map<number, PerLap>): LapSeries[] {
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

/** Positions and gaps lap by lap, from line-crossing times. */
export function RaceFigures({
  sessionId,
  entries,
  totalLaps,
}: {
  sessionId: number;
  entries: readonly Entry[];
  totalLaps: number;
}) {
  const { t, f } = useI18n();
  const replay = useReplay(sessionId);
  if (!replay.data) return replay.isError ? null : <Skeleton className="h-[420px]" />;
  const finishers = new Set(
    entries.filter((e) => e.finish_position != null).map((e) => e.car_number),
  );
  const clocks = replay.data.cars.map((car) => buildClock(car, finishers.has(car.car_number)));
  const laps = replay.data.total_laps || totalLaps;
  const top = new Set(entries.slice(0, TOP_POSITIONS).map((e) => e.car_number));
  const leaders = entries.slice(0, TOP_GAPS);
  const gaps = gapsByLap(clocks, laps);
  for (const [car, row] of gaps) {
    gaps.set(
      car,
      row.map((v) => (v !== null && v <= MAX_GAP_S ? v : null)),
    );
  }
  return (
    <>
      <Figure title={t("report.chart.positions")} note={t("report.chart.positionsNote")}>
        <LapChart
          label={t("report.chart.positions")}
          series={series(entries, positionsByLap(clocks, laps))}
          highlighted={top}
          totalLaps={laps}
          invert
          yDomain={[1, entries.length]}
          xLabel={t("analysis.lap")}
          height={380}
        />
      </Figure>
      <Figure title={t("report.chart.gaps")} note={t("report.chart.gapsNote")}>
        <LapChart
          label={t("report.chart.gaps")}
          series={series(leaders, gaps)}
          highlighted={new Set(leaders.map((e) => e.car_number))}
          totalLaps={laps}
          invert
          yFormat={(v) => `+${f.number(v, 0)} s`}
          xLabel={t("analysis.lap")}
          height={300}
        />
      </Figure>
    </>
  );
}

export function TyresFigure({ sessionId, totalLaps }: { sessionId: number; totalLaps: number }) {
  const { t } = useI18n();
  const stints = useStints(sessionId);
  if (!stints.data) return stints.isError ? null : <Skeleton className="h-64" />;
  const rows = stints.data
    .filter((row) => row.finish_position != null && row.finish_position <= TOP_TYRES)
    .slice(0, TOP_TYRES);
  if (rows.length === 0) return null;
  return (
    <Figure title={t("report.chart.tyres")}>
      <StrategyStrips rows={rows} totalLaps={totalLaps} />
    </Figure>
  );
}

/** The winner's fastest lap against the runner-up's, when both were imported. */
export function TelemetryFigure({
  sessionId,
  winner,
  second,
}: {
  sessionId: number;
  winner: Schema<"ReportEntry">;
  second: Schema<"ReportEntry"> | undefined;
}) {
  const { t } = useI18n();
  const laps = useTelemetryLaps(sessionId);
  const stored = new Set((laps.data ?? []).map((lap) => lap.entry.car_number));
  if (!second || !stored.has(winner.car_number) || !stored.has(second.car_number)) return null;
  return (
    <Figure
      title={t("report.chart.telemetry", {
        winner: winner.driver.family_name,
        second: second.driver.family_name,
      })}
      note={t("report.chart.telemetryNote")}
    >
      <TelemetryView sessionId={sessionId} cars={[winner.car_number, second.car_number]} />
    </Figure>
  );
}

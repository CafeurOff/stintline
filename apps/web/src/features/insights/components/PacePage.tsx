import type { Schema } from "@stintline/api-types";
import {
  ChartLine,
  ChartScatter,
  Flag as FlagIcon,
  Fuel,
  Gauge,
  ListOrdered,
  Target,
  Timer,
} from "lucide-react";
import { Link } from "react-router";

import { Panel, Tile } from "@/components/dash/Panel";
import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { CompoundBadge } from "@/components/racing/CompoundBadge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { LapChart } from "@/features/analysis/components/LapChart";
import { positionsByLap } from "@/features/analysis/laps";
import { useSeasonEvents } from "@/features/hub/api";
import { useReplay, useSessionDetail } from "@/features/race/api";
import { buildClock } from "@/features/race/replay";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";
import { intListParam, intParam, useSearchParamsState } from "@/lib/useSearchParam";

import { type PaceOptions, useSessionPace } from "../api";
import { LapScatter } from "../charts/LapScatter";
import { PaceBoxes } from "../charts/PaceBoxes";
import { rollingMedian } from "../duel";
import { FIRST_TIMED_SEASON, driverLabel, useSeasonParam } from "../season";
import { AnalysisTabs, DriverChip, EngineBadge } from "./common";

type Pace = Schema<"SessionPace">;
type PaceCar = Pace["cars"][number];

const CUTOFFS = [0, 102, 105, 107, 110, 115] as const;
/** Drivers drawn on the evolution and scatter charts when none are picked. */
const DEFAULT_PICKED = 3;
/** Lines or marker shapes that stay readable at once. */
const MAX_PICKED = 3;
/** Laps in the rolling median of the evolution chart: smooths traffic, keeps the trend. */
const EVOLUTION_WINDOW = 5;
/** Kept laps a driver needs to be ranked: fewer (an early retirement) is not a race pace. */
const MIN_RANKED_LAPS = 5;
/** Space above and below the evolution lines, in seconds. */
const EVOLUTION_PAD_S = 0.3;

interface RaceOption {
  id: number;
  label: string;
}

export function PacePage() {
  const { t, locale } = useI18n();
  const [year, setYear] = useSeasonParam();
  const [params, update] = useSearchParamsState();
  const events = useSeasonEvents(year);
  const races: RaceOption[] = (events.data?.results ?? []).flatMap((event) =>
    event.sessions
      .filter((s) => s.has_data && (s.kind === "R" || s.kind === "SPRINT"))
      .map((s) => ({
        id: s.id,
        label:
          s.kind === "SPRINT"
            ? `${eventName(event.name, locale)} · ${t("pace.sprint")}`
            : eventName(event.name, locale),
      })),
  );
  const asked = intParam(params, "session");
  const latest = [...races].reverse().find((r) => !r.label.includes("·")) ?? races.at(-1);
  const sessionId = asked ?? latest?.id ?? null;
  const options: PaceOptions = {
    fuel: params.get("fuel") !== "raw",
    pit: params.get("pit") === "1",
    sc: params.get("sc") === "1",
    cutoff: intParam(params, "cutoff") ?? 107,
  };
  const pace = useSessionPace(sessionId, options);
  const race = races.find((r) => r.id === sessionId);

  return (
    <div className="flex flex-col">
      <PageHeader
        title={race ? t("pace.titleOf", { race: race.label }) : t("pace.title")}
        actions={
          <>
            <SeasonSelect
              value={year}
              onChange={(value) => {
                update({ session: null });
                setYear(value);
              }}
            />
            {races.length > 0 && (
              <Select
                label={t("pace.race")}
                value={sessionId ?? ""}
                onChange={(event) => {
                  update({ session: event.target.value, drivers: null });
                }}
              >
                {races.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            )}
          </>
        }
      >
        {t("pace.intro")}
      </PageHeader>
      <AnalysisTabs />
      <Filters options={options} onChange={update} />
      {year !== null && year < FIRST_TIMED_SEASON ? (
        <EmptyState title={t("pace.noTiming")} />
      ) : events.data && races.length === 0 ? (
        <EmptyState title={t("pace.noRaces")} />
      ) : pace.isError ? (
        <ErrorState error={pace.error} onRetry={() => void pace.refetch()} />
      ) : !pace.data || sessionId === null ? (
        <Skeleton className="h-[60vh]" />
      ) : (
        <PaceView data={pace.data} sessionId={sessionId} />
      )}
    </div>
  );
}

function Filters({
  options,
  onChange,
}: {
  options: PaceOptions;
  onChange: (changes: Record<string, string | number | null>) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <SegmentedControl
        legend={t("pace.times")}
        options={[
          { value: "fuel", label: t("pace.fuel") },
          { value: "raw", label: t("pace.raw") },
        ]}
        value={options.fuel ? "fuel" : "raw"}
        onChange={(value) => {
          onChange({ fuel: value === "raw" ? "raw" : null });
        }}
      />
      <SegmentedControl
        legend={t("pace.pitLaps")}
        options={[
          { value: "0", label: t("pace.hide") },
          { value: "1", label: t("pace.show") },
        ]}
        value={options.pit ? "1" : "0"}
        onChange={(value) => {
          onChange({ pit: value === "1" ? 1 : null });
        }}
      />
      <SegmentedControl
        legend={t("pace.scLaps")}
        options={[
          { value: "0", label: t("pace.hide") },
          { value: "1", label: t("pace.show") },
        ]}
        value={options.sc ? "1" : "0"}
        onChange={(value) => {
          onChange({ sc: value === "1" ? 1 : null });
        }}
      />
      <Select
        label={t("pace.cutoff")}
        value={options.cutoff}
        onChange={(event) => {
          const value = Number(event.target.value);
          onChange({ cutoff: value === 107 ? null : value });
        }}
      >
        {CUTOFFS.map((c) => (
          <option key={c} value={c}>
            {c === 0 ? t("pace.noCutoff") : `${String(c)} %`}
          </option>
        ))}
      </Select>
    </div>
  );
}

function PaceView({ data, sessionId }: { data: Pace; sessionId: number }) {
  const { t, f } = useI18n();
  const [params, update] = useSearchParamsState();
  const ranked = data.cars.filter((c) => (c.summary?.n ?? 0) >= MIN_RANKED_LAPS);
  if (ranked.length === 0) return <EmptyState title={t("pace.noLaps")} />;
  const chosen = intListParam(params, "drivers").filter((n) =>
    ranked.some((c) => c.car_number === n),
  );
  const picked = new Set(
    (chosen.length > 0 ? chosen : ranked.slice(0, DEFAULT_PICKED).map((c) => c.car_number)).slice(
      0,
      MAX_PICKED,
    ),
  );
  const toggle = (car: number) => {
    const next = new Set(picked);
    if (next.has(car)) next.delete(car);
    else if (next.size < MAX_PICKED) next.add(car);
    update({ drivers: [...next].join(",") || null });
  };
  const fmt = (v: number) => f.lapTime(v);
  const axis = data.fuel_corrected ? t("pace.axisFuel") : t("pace.axisRaw");
  const pickedCars = ranked.filter((c) => picked.has(c.car_number));
  const evolution = pickedCars.map((c) => ({
    key: c.car_number,
    label: driverLabel(c.entry.driver),
    colour: c.entry.team_colour,
    dashed: false,
    values: rollingMedian(perLap(c, data.total_laps), EVOLUTION_WINDOW),
  }));
  const smoothed = evolution.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const evolutionDomain: { yDomain?: [number, number] } =
    smoothed.length === 0
      ? {}
      : {
          yDomain: [
            Math.min(...smoothed) - EVOLUTION_PAD_S,
            Math.max(...smoothed) + EVOLUTION_PAD_S,
          ],
        };

  return (
    <div className="flex flex-col gap-4">
      <PaceTiles data={data} ranked={ranked} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title={t("pace.boxes")}
          icon={<Gauge />}
          action={data.fuel_corrected ? <EngineBadge /> : undefined}
          bodyClassName="gap-2 p-4"
        >
          <p className="text-sm text-muted">{t("pace.boxesNote")}</p>
          <PaceBoxes
            label={t("pace.boxesLabel")}
            boxes={ranked.map((c) => ({
              key: c.car_number,
              label: driverLabel(c.entry.driver),
              colour: c.entry.team_colour,
              median: c.summary?.median_s ?? 0,
              q1: c.summary?.q1_s ?? 0,
              q3: c.summary?.q3_s ?? 0,
              low: c.summary?.low_s ?? 0,
              high: c.summary?.high_s ?? 0,
              outliers: c.summary?.outliers_s ?? [],
            }))}
            format={fmt}
            axisLabel={axis}
          />
        </Panel>
        <Panel title={t("pace.ranking")} icon={<ListOrdered />} className="self-start">
          <div className="relative overflow-x-auto">
            <table className="data-table text-sm">
              <caption className="sr-only">{t("pace.ranking")}</caption>
              <thead>
                <tr>
                  <th className="num">{t("col.position")}</th>
                  <th>{t("col.driver")}</th>
                  <th className="num">{t("pace.median")}</th>
                  <th className="num">{t("pace.gap")}</th>
                  <th className="num">{t("pace.spread")}</th>
                  <th className="num">{t("col.laps")}</th>
                  <th>
                    <span className="sr-only">{t("pace.pick")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((c, i) => (
                  <tr key={c.car_number}>
                    <td className="num font-bold">{i + 1}</td>
                    <td
                      className="border-l-4"
                      style={{ borderLeftColor: teamColour(c.entry.team_colour) }}
                    >
                      <DriverChip
                        driver={c.entry.driver}
                        colour={c.entry.team_colour}
                        size="size-7"
                        compact
                      />
                    </td>
                    <td className="num font-semibold">{fmt(c.summary?.median_s ?? 0)}</td>
                    <td className="num text-muted">
                      {i === 0
                        ? ""
                        : f.delta(
                            (c.summary?.median_s ?? 0) - (ranked[0]?.summary?.median_s ?? 0),
                            3,
                          )}
                    </td>
                    <td className="num text-muted">{f.seconds(c.summary?.std_s, 2)}</td>
                    <td className="num text-muted">{c.summary?.n}</td>
                    <td>
                      <label className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={picked.has(c.car_number)}
                          disabled={!picked.has(c.car_number) && picked.size >= MAX_PICKED}
                          onChange={() => {
                            toggle(c.car_number);
                          }}
                          aria-label={t("pace.pickDriver", { driver: driverLabel(c.entry.driver) })}
                          className="size-4 accent-[var(--color-mark)]"
                        />
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title={t("pace.evolution")} icon={<ChartLine />} bodyClassName="gap-2 p-4">
          <p className="text-sm text-muted">{t("pace.evolutionNote", { n: EVOLUTION_WINDOW })}</p>
          <LapChart
            label={t("pace.evolution")}
            series={evolution}
            highlighted={picked}
            totalLaps={data.total_laps}
            {...evolutionDomain}
            yFormat={fmt}
            xLabel={t("analysis.lap")}
            height={340}
          />
        </Panel>
        <Panel title={t("pace.scatter")} icon={<ChartScatter />} bodyClassName="gap-2 p-4">
          <p className="text-sm text-muted">{t("pace.scatterNote")}</p>
          <LapScatter
            label={t("pace.scatter")}
            series={pickedCars.map((c) => ({
              key: c.car_number,
              label: driverLabel(c.entry.driver),
              points: c.laps
                .filter((l) => l.kept)
                .map((l) => ({
                  lap: l.lap,
                  value: l.value_s,
                  compound: l.compound,
                  tip: `${driverLabel(c.entry.driver)} · ${t("pace.lapN", { n: l.lap })} · ${fmt(l.value_s)} · ${l.compound}`,
                })),
            }))}
            totalLaps={data.total_laps}
            format={fmt}
            xLabel={t("analysis.lap")}
            height={340}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Positions sessionId={sessionId} picked={picked} />
        <Panel title={t("pace.fastestLaps")} icon={<Timer />} className="self-start">
          <table className="data-table text-sm">
            <caption className="sr-only">{t("pace.fastestLaps")}</caption>
            <thead>
              <tr>
                <th className="num">#</th>
                <th>{t("col.driver")}</th>
                <th className="num">{t("col.time")}</th>
                <th className="num">{t("pace.lap")}</th>
                <th>{t("pace.tyre")}</th>
              </tr>
            </thead>
            <tbody>
              {data.fastest_laps.map((lap, i) => {
                const car = data.cars.find((c) => c.car_number === lap.car_number);
                return (
                  <tr key={`${String(lap.car_number)}-${String(lap.lap)}`}>
                    <td className="num text-muted">{i + 1}</td>
                    <td>
                      {car ? (
                        <DriverChip
                          driver={car.entry.driver}
                          colour={car.entry.team_colour}
                          size="size-7"
                        />
                      ) : (
                        lap.car_number
                      )}
                    </td>
                    <td className={`num font-semibold ${i === 0 ? "text-t-purple" : ""}`}>
                      {f.lapTime(lap.time_s)}
                    </td>
                    <td className="num text-muted">{lap.lap}</td>
                    <td>
                      <span className="flex items-center gap-1.5">
                        <CompoundBadge compound={lap.compound} />
                        <span className="num text-xs text-muted">{lap.tyre_age ?? ""}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

function perLap(car: PaceCar, totalLaps: number): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: totalLaps }, () => null);
  for (const lap of car.laps) if (lap.kept && lap.lap <= totalLaps) out[lap.lap - 1] = lap.value_s;
  return out;
}

function PaceTiles({ data, ranked }: { data: Pace; ranked: readonly PaceCar[] }) {
  const { t, f } = useI18n();
  const best = ranked[0];
  const steady = [...ranked]
    .filter((c) => (c.summary?.n ?? 0) >= 10)
    .sort((a, b) => (a.summary?.std_s ?? 0) - (b.summary?.std_s ?? 0))[0];
  const fastest = data.fastest_laps[0];
  const fastestCar = data.cars.find((c) => c.car_number === fastest?.car_number);
  const fuelTotal = data.fuel_gain_per_lap_s * data.total_laps;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {best?.summary && (
        <Tile label={t("pace.tile.best")} icon={<Gauge />}>
          <p className="flex items-center gap-2">
            <span className="num text-4xl font-semibold">{f.lapTime(best.summary.median_s)}</span>
          </p>
          <DriverChip
            driver={best.entry.driver}
            colour={best.entry.team_colour}
            sub={t("pace.tile.bestNote", {
              gap: f.delta(
                (ranked[1]?.summary?.median_s ?? best.summary.median_s) - best.summary.median_s,
                3,
              ),
            })}
          />
        </Tile>
      )}
      {steady?.summary && (
        <Tile label={t("pace.tile.steady")} icon={<Target />}>
          <p className="num text-4xl font-semibold">{f.seconds(steady.summary.std_s, 2)}</p>
          <DriverChip
            driver={steady.entry.driver}
            colour={steady.entry.team_colour}
            sub={t("pace.tile.steadyNote", { n: steady.summary.n })}
          />
        </Tile>
      )}
      {fastest && fastestCar && (
        <Tile label={t("dash.fastestLap")} icon={<Timer />}>
          <p className="num text-4xl font-semibold text-t-purple">{f.lapTime(fastest.time_s)}</p>
          <DriverChip
            driver={fastestCar.entry.driver}
            colour={fastestCar.entry.team_colour}
            sub={t("pace.tile.fastestNote", { lap: fastest.lap })}
          />
        </Tile>
      )}
      <Tile label={t("pace.tile.fuel")} icon={<Fuel />}>
        <p className="flex items-center gap-2">
          <span className="num text-4xl font-semibold">{f.seconds(fuelTotal, 1)}</span>
          <EngineBadge />
        </p>
        <p className="text-sm text-muted">
          {t("pace.tile.fuelNote", {
            gain: f.seconds(data.fuel_gain_per_lap_s, 3),
            laps: data.total_laps,
          })}
        </p>
      </Tile>
    </div>
  );
}

function Positions({ sessionId, picked }: { sessionId: number; picked: ReadonlySet<number> }) {
  const { t } = useI18n();
  const replay = useReplay(sessionId);
  const detail = useSessionDetail(sessionId);
  return (
    <Panel
      title={t("pace.positions")}
      icon={<FlagIcon />}
      action={
        detail.data && (
          <Link
            to={`/events/${String(detail.data.event.id)}?chart=gaps`}
            className="text-sm font-semibold text-muted hover:text-ink"
          >
            {t("pace.moreCharts")}
          </Link>
        )
      }
      bodyClassName="p-4"
    >
      {replay.isError || detail.isError ? (
        <ErrorState error={replay.error ?? detail.error} />
      ) : !replay.data || !detail.data ? (
        <Skeleton className="h-80" />
      ) : (
        <LapChart
          label={t("analysis.positionsLabel")}
          series={(() => {
            const entries = detail.data.entries;
            const finishers = new Set(
              entries.filter((e) => e.finish_position != null).map((e) => e.car_number),
            );
            const clocks = replay.data.cars.map((car) =>
              buildClock(car, finishers.has(car.car_number)),
            );
            const rows = positionsByLap(clocks, replay.data.total_laps);
            return entries.map((e) => ({
              key: e.car_number,
              label: driverLabel(e.driver),
              colour: e.team_colour,
              dashed: false,
              values: rows.get(e.car_number) ?? [],
            }));
          })()}
          highlighted={picked}
          totalLaps={replay.data.total_laps}
          invert
          yDomain={[1, detail.data.entries.length]}
          xLabel={t("analysis.lap")}
          height={340}
        />
      )}
    </Panel>
  );
}

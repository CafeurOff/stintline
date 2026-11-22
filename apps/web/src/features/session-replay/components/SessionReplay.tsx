import type { Schema } from "@stintline/api-types";
import { Activity } from "lucide-react";
import { type CSSProperties, useMemo } from "react";

import { PillSwitch } from "@/components/layout/Glass";
import { Panel } from "@/components/layout/Panel";
import { Flag } from "@/components/racing/Flag";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { RadioPanel } from "@/features/radio/components/RadioPanel";
import { useTrack } from "@/features/race/api";
import { Race3DView } from "@/features/race/components/Race3DView";
import { type CarMarker, TrackMap } from "@/features/race/components/TrackMap";
import { byFinish, driverCode, driverName, entriesByCar } from "@/features/race/entries";
import type { RaceCar3D } from "@/features/race/race3d";
import { pointAt } from "@/features/race/replay";
import { useReplayClock } from "@/features/race/useReplayClock";
import { TelemetrySection } from "@/features/telemetry/TelemetryView";
import { circuitAccent } from "@/lib/accent";
import { ApiError } from "@/lib/errors";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { sessionLabel } from "@/lib/sessions";
import { teamColour } from "@/lib/teams";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

import { useTimeline } from "../api";
import {
  carStateAt,
  flagAt,
  initialTime,
  segmentAt,
  standingsAt,
  type Timeline,
} from "../timeline";
import { DriverLaps } from "./DriverLaps";
import { SessionBar } from "./SessionBar";
import { SessionConditions } from "./SessionConditions";
import { SessionSwitcher } from "./SessionSwitcher";
import { SessionTower } from "./SessionTower";

type SessionDetail = Schema<"SessionDetail">;

/**
 * Replay of a practice or qualifying session (ADR 0028): the cars on the circuit on the
 * session clock, the timing as it stood, the followed driver's laps, flags, weather and race
 * control. No race positions or strategy: they mean nothing outside a race.
 */
export function SessionReplay({ session }: { session: SessionDetail }) {
  const { t, locale } = useI18n();
  const timeline = useTimeline(session.id);
  const track = useTrack(session.id);
  const name = eventName(session.event.name, locale);
  const kind = sessionLabel(session.kind, t);
  useDocumentTitle(`${name} ${String(session.event.season)} · ${kind}`);

  const header = (
    <header className="mb-4 flex flex-col gap-3">
      <div className="min-w-0">
        <p className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-muted">
          <Flag country={session.event.circuit.country} className="h-3.5 w-5 rounded-[2px]" />
          {t("race.eyebrow", { round: session.event.round, circuit: session.event.circuit.name })}
        </p>
        <h1 className="display text-2xl leading-tight sm:text-3xl">
          {t("sreplay.pageTitle", { event: name, year: session.event.season, session: kind })}
        </h1>
        <p className="mt-1 max-w-[80ch] text-sm text-muted">
          {session.kind === "Q" || session.kind === "SQ"
            ? t("sreplay.intro.qualifying")
            : t("sreplay.intro.practice")}
        </p>
      </div>
      <SessionSwitcher eventId={session.event.id} current={session.id} />
    </header>
  );

  if (timeline.error instanceof ApiError && timeline.error.status === 404) {
    return (
      <div className="flex flex-col">
        {header}
        <EmptyState title={kind}>{t("sreplay.noTiming")}</EmptyState>
      </div>
    );
  }
  if (timeline.isError || track.isError) {
    return (
      <ErrorState
        error={timeline.error ?? track.error}
        onRetry={() => {
          void timeline.refetch();
          void track.refetch();
        }}
      />
    );
  }
  return (
    <div className="flex flex-col">
      {header}
      {!timeline.data || track.data === undefined ? (
        <Skeleton className="h-[70vh]" />
      ) : (
        <Replay key={session.id} session={session} timeline={timeline.data} track={track.data} />
      )}
    </div>
  );
}

function Replay({
  session,
  timeline,
  track,
}: {
  session: SessionDetail;
  timeline: Timeline;
  track: Schema<"Track"> | null;
}) {
  const { t, locale } = useI18n();
  const [params, update] = useSearchParamsState();
  const entries = useMemo(() => [...session.entries].sort(byFinish), [session.entries]);
  const byCar = useMemo(() => entriesByCar(entries), [entries]);
  const cars = useMemo(
    () => timeline.cars.filter((car) => byCar.has(car.car_number)),
    [timeline.cars, byCar],
  );
  const data: Timeline = useMemo(
    () => ({
      starts_at: timeline.starts_at,
      duration_s: timeline.duration_s,
      cars,
      segments: timeline.segments,
      flags: timeline.flags,
      race_control: timeline.race_control,
      weather: timeline.weather,
    }),
    [timeline, cars],
  );

  const startAt = intParam(params, "t") ?? Math.floor(initialTime(data));
  const clock = useReplayClock(startAt, data.duration_s);
  const time = clock.time;
  const lines = standingsAt(data, time);
  const prefix = session.kind === "SQ" ? "SQ" : "Q";
  const segmentName = (n: number) => `${prefix}${String(n)}`;
  const segment = segmentAt(data.segments, time);
  const flag = flagAt(data, time);

  const firstCar = lines[0]?.carNumber ?? entries[0]?.car_number ?? 0;
  const selectedParam = intParam(params, "car");
  const selected = selectedParam !== null && byCar.has(selectedParam) ? selectedParam : firstCar;
  const selectCar = (car: number) => {
    update({ car });
  };
  const entry = byCar.get(selected);
  const selectedCar = cars.find((car) => car.car_number === selected);
  const selectedLine = lines.find((line) => line.carNumber === selected);

  const markers: CarMarker[] = [];
  const cars3d: RaceCar3D[] = [];
  for (const line of [...lines].reverse()) {
    const e = byCar.get(line.carNumber);
    if (!e || line.state.kind !== "track") continue;
    const colour = teamColour(e.team_colour);
    const isSelected = line.carNumber === selected;
    cars3d.push({
      carNumber: line.carNumber,
      code: driverCode(e),
      colour,
      fraction: line.state.fraction,
      selected: isSelected,
    });
    if (!track) continue;
    const [x, y] = pointAt(track.points, line.state.fraction);
    markers.push({
      carNumber: line.carNumber,
      code: driverCode(e),
      name: driverName(e),
      colour,
      x,
      y,
      showLabel: isSelected || line.position <= 3,
      selected: isSelected,
      dimmed: false,
    });
  }

  const view = params.get("view") === "3d" ? "3d" : "map";
  const accent = circuitAccent(session.event.circuit.ref);
  const name = eventName(session.event.name, locale);
  const status =
    flag?.status === "RED"
      ? t("live.track.red")
      : flag?.status === "SC"
        ? t("live.track.safety_car")
        : flag?.status === "VSC"
          ? t("live.track.virtual_safety_car")
          : t("live.track.clear");
  const setTime = (value: number) => {
    clock.setTime(value);
    update({ t: Math.round(value) });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[17rem_minmax(0,1fr)_22rem]">
        <section
          aria-label={name}
          className="glass glow relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-[24px] p-4 sm:p-5 md:col-span-2 xl:order-2 xl:col-span-1"
          style={{ "--glow": accent, "--glow-x": "50%", "--glow-y": "0%" } as CSSProperties}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
                  flag?.status === "RED"
                    ? "bg-loss text-tyre-ink"
                    : flag
                      ? "bg-caution text-tyre-ink"
                      : "border border-line text-muted"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${flag ? "bg-tyre-ink" : "bg-gain"}`}
                />
                {status}
              </p>
              {segment && (
                <p className="timing rounded-full bg-ink px-3 py-1 text-xs font-bold text-bg">
                  {segmentName(segment.number)}
                </p>
              )}
            </div>
            <PillSwitch
              label={t("stage.view")}
              value={view}
              options={[
                ["map", t("stage.map")],
                ["3d", t("stage.3d")],
              ]}
              onChange={(next) => {
                update({ view: next === "3d" ? "3d" : null });
              }}
            />
          </div>
          {view === "3d" ? (
            <Race3DView
              sessionId={session.id}
              cars={cars3d}
              ghost={null}
              circuit={session.event.circuit.name}
              onSelect={selectCar}
            />
          ) : track ? (
            <TrackMap
              track={track}
              cars={markers}
              ghost={null}
              title={session.event.circuit.name}
              accent={accent}
              onSelect={selectCar}
            />
          ) : (
            <EmptyState title={name}>{t("map.noTrack")}</EmptyState>
          )}
          <SessionBar
            time={time}
            timeline={data}
            playing={clock.playing}
            speed={clock.speed}
            segmentName={segmentName}
            laps={selectedCar?.laps ?? []}
            onToggle={clock.playing ? clock.pause : clock.play}
            onTime={setTime}
            onSpeed={clock.setSpeed}
          />
        </section>

        <div className="flex max-h-[34rem] min-h-0 xl:order-1 xl:max-h-[calc(100vh-6rem)]">
          <SessionTower
            lines={lines}
            byCar={byCar}
            selected={selected}
            segmentName={segmentName}
            onSelect={selectCar}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5 self-start xl:order-3">
          <aside aria-live="polite" className="glass flex flex-col gap-6 rounded-[20px] p-5">
            {entry && selectedCar && selectedLine && (
              <DriverLaps
                entry={entry}
                laps={selectedCar.laps}
                state={carStateAt(selectedCar, time)}
                best={selectedLine.best}
                time={time}
              />
            )}
            <SessionConditions timeline={data} time={time} />
          </aside>
          <RadioPanel
            sessionId={session.id}
            byCar={byCar}
            selected={selected}
            time={time}
            moment={(message) => secondsSince(data.starts_at, message.recorded_at, data.duration_s)}
            onSeek={(message) => {
              const at = secondsSince(data.starts_at, message.recorded_at, data.duration_s);
              clock.pause();
              clock.setTime(at);
              // One address change: two in a row would each start from the same address.
              update({ car: message.car_number, t: Math.round(at) });
            }}
          />
        </div>
      </div>
      <Panel id="session-telemetry" title={t("sreplay.telemetry")} icon={<Activity />}>
        <TelemetrySection sessionId={session.id} />
      </Panel>
    </div>
  );
}

/** A moment of the session as seconds on its replay clock, kept inside the session. */
function secondsSince(startsAt: string, at: string, duration: number): number {
  const seconds = (Date.parse(at) - Date.parse(startsAt)) / 1000;
  return Math.min(Math.max(seconds, 0), duration);
}

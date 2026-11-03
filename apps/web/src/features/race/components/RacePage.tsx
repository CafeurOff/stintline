import type { Schema } from "@stintline/api-types";
import { useMemo, useState } from "react";

import { DriverAvatar } from "@/components/racing/DriverAvatar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { ApiError } from "@/lib/errors";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { compoundInfo } from "@/lib/compounds";
import { teamColour } from "@/lib/teams";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

import { useReplay, useSessionDetail, useTrack } from "../api";
import { byFinish, driverCode, driverName, entriesByCar, type Entry } from "../entries";
import {
  buildClock,
  type CarClock,
  leaderLap,
  leaderTimeAtLap,
  pointAt,
  progressAt,
  raceEndTime,
  runningOrder,
} from "../replay";
import { type PitExitRequest, type UndercutRequest, usePitExit, useUndercut } from "../simulations";
import { useSessionId } from "../useSessionId";
import { useReplayClock } from "../useReplayClock";
import { ReplayBar } from "./ReplayBar";
import { StopPanel } from "./StopPanel";
import { type Ghost, TrackMap, type CarMarker } from "./TrackMap";
import { UndercutPanel } from "./UndercutPanel";
import type { UndercutChoice } from "../undercut";

/** Where the replay opens when no lap is in the URL: a typical first-stop window. */
const DEFAULT_LAP_SHARE = 0.4;
/** Points used to draw the uncertainty zone along the track. */
const ZONE_STEPS = 16;

type Mode = "stop" | "undercut";

export function RacePage() {
  const sessionId = useSessionId();
  if (sessionId === null) return <NotFoundPage />;
  return <RaceLoader sessionId={sessionId} />;
}

function RaceLoader({ sessionId }: { sessionId: number }) {
  const session = useSessionDetail(sessionId);
  const replay = useReplay(sessionId);
  const track = useTrack(sessionId);

  const error = session.error ?? replay.error ?? track.error;
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  if (session.isError || replay.isError || track.isError) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          void session.refetch();
          void replay.refetch();
          void track.refetch();
        }}
      />
    );
  }
  if (!session.data || !replay.data || track.data === undefined) {
    return <Skeleton className="h-[70vh]" />;
  }
  return (
    <Race
      key={sessionId}
      sessionId={sessionId}
      session={session.data}
      replay={replay.data}
      track={track.data}
    />
  );
}

interface RaceProps {
  sessionId: number;
  session: Schema<"SessionDetail">;
  replay: Schema<"Replay">;
  track: Schema<"Track"> | null;
}

function Race({ sessionId, session, replay, track }: RaceProps) {
  const { t, f, locale } = useI18n();
  const [params, update] = useSearchParamsState();
  const totalLaps = replay.total_laps;
  const entries = useMemo(() => [...session.entries].sort(byFinish), [session.entries]);
  const byCar = useMemo(() => entriesByCar(entries), [entries]);
  const clocks = useMemo(
    () =>
      replay.cars.map((car) => buildClock(car, byCar.get(car.car_number)?.finish_position != null)),
    [replay.cars, byCar],
  );
  const clockByCar = useMemo(() => new Map(clocks.map((c) => [c.carNumber, c])), [clocks]);
  const replayByCar = useMemo(
    () => new Map(replay.cars.map((c) => [c.car_number, c])),
    [replay.cars],
  );

  const startLap = intParam(params, "lap") ?? Math.round(totalLaps * DEFAULT_LAP_SHARE);
  const clock = useReplayClock(leaderTimeAtLap(clocks, startLap), raceEndTime(clocks));
  const time = clock.time;
  const lap = leaderLap(clocks, time, totalLaps);
  const finished = time >= raceEndTime(clocks);

  const order = runningOrder(clocks, time);
  const positionOf = (car: number) => order.findIndex((r) => r.carNumber === car) + 1;

  const firstCar = entries[0]?.car_number ?? 0;
  const selectedParam = intParam(params, "car");
  const selected = selectedParam !== null && byCar.has(selectedParam) ? selectedParam : firstCar;
  const mode: Mode = params.get("mode") === "undercut" ? "undercut" : "stop";
  const entry = byCar.get(selected);

  // A simulation is pinned to the instant it was asked for; moving on clears it.
  const [stop, setStop] = useState<{ request: PitExitRequest; time: number } | null>(null);
  const [undercut, setUndercut] = useState<{ request: UndercutRequest; time: number } | null>(null);
  const [choice, setChoice] = useState<UndercutChoice | null>(null);
  const stopActive = stop?.time === time && stop.request.car === selected ? stop : null;
  const undercutActive =
    undercut?.time === time && undercut.request.attacker === selected ? undercut : null;
  const stopResult = usePitExit(sessionId, stopActive?.request ?? null);
  const undercutResult = useUndercut(sessionId, undercutActive?.request ?? null);

  const selectedProgress = progressAt(clockByCar.get(selected) ?? emptyClock(selected), time);
  const lapInProgress = selectedProgress === null ? null : Math.floor(selectedProgress) + 1;
  const canStop = lapInProgress !== null && lapInProgress >= 2 && lapInProgress <= totalLaps - 1;

  const myIndex = order.findIndex((r) => r.carNumber === selected);
  const targets = order
    .slice(0, Math.max(myIndex, 0))
    .reverse()
    .map((r) => byCar.get(r.carNumber))
    .filter((e): e is Entry => Boolean(e));
  const effectiveChoice: UndercutChoice | null =
    targets.length === 0
      ? null
      : choice && targets.some((e) => e.car_number === choice.defender)
        ? choice
        : { defender: targets[0]?.car_number ?? 0, compound: "HARD", reaction: "1" };

  const selectCar = (car: number) => {
    update({ car });
    setChoice(null);
  };
  const setLap = (value: number) => {
    clock.setTime(leaderTimeAtLap(clocks, value));
    update({ lap: value });
  };

  // ---- ghost: where the selected car would be after the simulated stop(s)
  let ghost: Ghost | null = null;
  const labelled = new Set<number>([selected]);
  if (track && entry) {
    let reference: CarClock | undefined;
    let lag = 0;
    let sigma = 0;
    if (stopActive && stopResult.data) {
      reference = clockByCar.get(selected);
      lag = stopResult.data.pit_loss_s;
      sigma = stopResult.data.sigma_s;
    } else if (undercutActive && undercutResult.data) {
      reference = clockByCar.get(undercutActive.request.defender);
      lag = undercutResult.data.gap_after_s;
      sigma = undercutResult.data.sigma_s;
      labelled.add(undercutActive.request.defender);
    }
    if (reference) {
      const progress = progressAt(reference, time - lag);
      if (progress !== null) {
        const [x, y] = pointAt(track.points, progress);
        const zone: [number, number][] = [];
        for (let i = 0; i <= ZONE_STEPS; i += 1) {
          const p = progressAt(reference, time - lag - sigma + (2 * sigma * i) / ZONE_STEPS);
          if (p !== null) zone.push(pointAt(track.points, p));
        }
        ghost = { code: driverCode(entry), x, y, zone };
      }
    }
  }
  if (stopActive && stopResult.data) {
    for (const rival of stopResult.data.rivals) {
      if (Math.abs(rival.margin_s) < Math.max(stopResult.data.sigma_s * 2, 3))
        labelled.add(rival.car);
    }
  } else if (myIndex >= 0) {
    for (const r of [order[myIndex - 1], order[myIndex + 1]]) if (r) labelled.add(r.carNumber);
  }

  const markers: CarMarker[] = [];
  if (track) {
    for (const running of [...order].reverse()) {
      const e = byCar.get(running.carNumber);
      if (!e) continue;
      const [x, y] = pointAt(track.points, running.progress);
      markers.push({
        carNumber: running.carNumber,
        code: driverCode(e),
        name: driverName(e),
        colour: teamColour(e.team_colour),
        x,
        y,
        showLabel: labelled.has(running.carNumber) && !(ghost && running.carNumber === selected),
        selected: running.carNumber === selected,
        dimmed: ghost !== null && running.carNumber === selected,
      });
    }
  }

  const carReplay = replayByCar.get(selected);
  const lapIndex = (lapInProgress ?? 1) - 1;
  const compound = compoundInfo(carReplay?.compounds[lapIndex]);
  const age = carReplay?.tyre_ages[lapIndex];
  const title = t("map.title", { circuit: session.event.circuit.name, lap });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section
        aria-label={eventName(session.event.name, locale)}
        className="flex min-w-0 flex-col gap-3"
      >
        {track ? (
          <TrackMap track={track} cars={markers} ghost={ghost} title={title} onSelect={selectCar} />
        ) : (
          <EmptyState title={eventName(session.event.name, locale)}>{t("map.noTrack")}</EmptyState>
        )}
        <ReplayBar
          lap={lap}
          totalLaps={totalLaps}
          finished={finished}
          playing={clock.playing}
          speed={clock.speed}
          onToggle={clock.playing ? clock.pause : clock.play}
          onLap={setLap}
          onSpeed={clock.setSpeed}
        />
      </section>

      {entry && (
        <aside
          aria-live="polite"
          className="flex flex-col gap-5 self-start rounded-2xl border border-line bg-panel p-5"
        >
          <SegmentedControl
            legend={t("panel.mode")}
            hideLegend
            options={[
              { value: "stop", label: t("panel.mode.stop") },
              { value: "undercut", label: t("panel.mode.undercut") },
            ]}
            value={mode}
            onChange={(value) => {
              update({ mode: value === "stop" ? null : value });
            }}
          />
          <div className="flex items-center gap-3">
            <DriverAvatar
              carNumber={entry.car_number}
              name={driverName(entry)}
              colour={entry.team_colour}
              imageUrl={entry.media?.driver_image_url}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold">{driverName(entry)}</p>
              <p className="text-sm text-muted">
                {selectedProgress === null
                  ? (entry.status ?? "")
                  : t("stop.running", {
                      position: f.ordinal(positionOf(selected)),
                      compound: t(`compoundLower.${compound.key}`),
                      age: age ?? "?",
                    })}
              </p>
            </div>
          </div>
          <Select
            label={t("panel.driver")}
            hideLabel
            value={selected}
            onChange={(event) => {
              selectCar(Number(event.target.value));
            }}
          >
            {order.map((r, index) => {
              const e = byCar.get(r.carNumber);
              return e ? (
                <option key={r.carNumber} value={r.carNumber}>
                  {index + 1}. {driverName(e)}
                </option>
              ) : null;
            })}
          </Select>

          {mode === "stop" ? (
            <>
              <h2 className="text-xl leading-tight font-bold">
                {t("stop.question", { name: entry.driver.family_name })}
              </h2>
              <StopPanel
                entry={entry}
                canStop={canStop}
                maxLap={totalLaps - 1}
                submitted={stopActive !== null}
                result={stopResult.data}
                isError={stopResult.isError}
                error={stopResult.error}
                byCar={byCar}
                onSimulate={() => {
                  if (lapInProgress === null) return;
                  clock.pause();
                  setStop({ request: { car: selected, pit_lap: lapInProgress }, time });
                }}
                onClear={() => {
                  setStop(null);
                }}
                onRetry={() => void stopResult.refetch()}
              />
            </>
          ) : (
            <UndercutPanel
              attacker={entry}
              targets={targets}
              choice={effectiveChoice}
              canStop={canStop}
              maxLap={totalLaps - 1}
              submitted={undercutActive !== null}
              result={undercutResult.data}
              isError={undercutResult.isError}
              error={undercutResult.error}
              onChange={(next) => {
                setChoice(next);
                setUndercut(null);
              }}
              onSimulate={() => {
                if (lapInProgress === null || !effectiveChoice) return;
                clock.pause();
                setUndercut({
                  request: {
                    attacker: selected,
                    defender: effectiveChoice.defender,
                    stop_lap: lapInProgress,
                    attacker_compound: effectiveChoice.compound,
                    defender_compound: effectiveChoice.compound,
                    defender_reaction_laps: Number(effectiveChoice.reaction),
                  },
                  time,
                });
              }}
              onClear={() => {
                setUndercut(null);
              }}
              onRetry={() => void undercutResult.refetch()}
            />
          )}
        </aside>
      )}
    </div>
  );
}

function emptyClock(carNumber: number): CarClock {
  return { carNumber, lineTimes: [], finished: false };
}

import type { Schema } from "@stintline/api-types";
import { type CSSProperties, useMemo, useState } from "react";
import { Link } from "react-router";

import { DriverAvatar } from "@/components/racing/DriverAvatar";
import { Flag } from "@/components/racing/Flag";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { TermList } from "@/components/ui/Term";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { useDegradation } from "@/features/tyres/api";
import { circuitAccent } from "@/lib/accent";
import { compoundInfo, RACE_COMPOUNDS } from "@/lib/compounds";
import { ApiError } from "@/lib/errors";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

import { useReplay, useSessionDetail, useTrack } from "../api";
import { byFinish, driverCode, driverName, entriesByCar, type Entry, entryPhoto } from "../entries";
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
import {
  type PitExitRequest,
  type StrategyRequest,
  type UndercutRequest,
  usePitExit,
  useStrategy,
  useUndercut,
} from "../simulations";
import { decodePlan, encodePlan, type RaceCompound, realPlan, samePlan } from "../strategy";
import type { UndercutChoice } from "../undercut";
import { useReplayClock } from "../useReplayClock";
import { towerLines } from "../tower";
import { useSessionId } from "../useSessionId";
import { RaceTower } from "./RaceTower";
import { ReplayBar } from "./ReplayBar";
import { StopPanel } from "./StopPanel";
import { StrategyPanel } from "./StrategyPanel";
import { type Ghost, TrackMap, type CarMarker } from "./TrackMap";
import { UndercutPanel } from "./UndercutPanel";

/** Where the replay opens when no lap is in the URL: a typical first-stop window. */
const DEFAULT_LAP_SHARE = 0.4;
/** Points used to draw the uncertainty zone along the track. */
const ZONE_STEPS = 16;

type Mode = "stop" | "undercut" | "strategy";
const MODES: readonly Mode[] = ["stop", "undercut", "strategy"];
/** Dry compounds offered when the race has no tyre model yet (the server checks). */
const DRY: readonly RaceCompound[] = ["SOFT", "MEDIUM", "HARD"];
/** Speed used to watch a replayed strategy from the start. */
const WATCH_SPEED = 30;

export function RacePage() {
  const sessionId = useSessionId();
  if (sessionId === null) return <NotFoundPage />;
  return <RaceLoader sessionId={sessionId} />;
}

function RaceLoader({ sessionId }: { sessionId: number }) {
  const { locale } = useI18n();
  const session = useSessionDetail(sessionId);
  const replay = useReplay(sessionId);
  const track = useTrack(sessionId);
  const event = session.data?.event;
  useDocumentTitle(event ? `${eventName(event.name, locale)} ${String(event.season)}` : null);

  const error = session.error ?? replay.error ?? track.error;
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  // The replay needs lap timing: practice, qualifying and races before 2023 have none.
  if (session.data && replay.error instanceof ApiError && replay.error.status === 400) {
    return <NoTiming eventId={session.data.event.id} name={session.data.event.name} />;
  }
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
  const mode: Mode = MODES.find((m) => m === params.get("mode")) ?? "stop";
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

  // ---- what-if strategy: the plan lives in the address, the real one is the default
  const selectedReplay = replayByCar.get(selected);
  const real = selectedReplay ? realPlan(selectedReplay) : null;
  const plan = decodePlan(params.get("plan")) ?? real;
  const degradation = useDegradation(sessionId);
  const modelled = (degradation.data?.compounds ?? [])
    .map((c) => c.compound)
    .filter((c): c is RaceCompound => (RACE_COMPOUNDS as readonly string[]).includes(c))
    .sort((a, b) => RACE_COMPOUNDS.indexOf(a) - RACE_COMPOUNDS.indexOf(b));
  const compounds = modelled.length > 0 ? modelled : DRY;
  const [strategyRequest, setStrategyRequest] = useState<StrategyRequest | null>(null);
  const strategyActive =
    mode === "strategy" &&
    plan !== null &&
    strategyRequest?.car === selected &&
    strategyRequest.start_compound === plan.start &&
    JSON.stringify(strategyRequest.stops) === JSON.stringify(plan.stops)
      ? strategyRequest
      : null;
  const strategyResult = useStrategy(sessionId, strategyActive);

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
    update({ car, plan: null });
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
    if (strategyActive && strategyResult.data) {
      const result = strategyResult.data;
      reference = buildClock(
        {
          car_number: selected,
          line_times_s: result.line_times_s,
          compounds: [],
          tyre_ages: [],
          pit_in_laps: [],
        },
        true,
      );
      // The margin grows over the race: scale the final sigma by the share of laps run.
      sigma = result.sigma_s * Math.min(lap / Math.max(result.laps, 1), 1);
    } else if (stopActive && stopResult.data) {
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
  const accent = circuitAccent(session.event.circuit.ref);
  const tower = towerLines(clocks, replayByCar, time);
  const flag = session.neutralisations.find(
    (n) => n.lap_start != null && lap >= n.lap_start && lap <= (n.lap_end ?? totalLaps),
  );
  const name = eventName(session.event.name, locale);

  return (
    <div className="flex flex-col">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-muted">
            <Flag country={session.event.circuit.country} className="h-3.5 w-5 rounded-[2px]" />
            {t("race.eyebrow", { round: session.event.round, circuit: session.event.circuit.name })}
          </p>
          <h1 className="display text-2xl leading-tight sm:text-3xl">
            {t("race.pageTitle", { event: name, year: session.event.season })}
          </h1>
          <p className="mt-1 max-w-[80ch] text-sm text-muted">{t("race.pageIntro")}</p>
        </div>
        <TermList ids={["undercut", "overcut", "pitLoss", "stint"]} />
      </header>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[16rem_minmax(0,1fr)_22rem]">
        <section
          aria-label={name}
          className="glass glow relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-[24px] p-4 sm:p-5 md:col-span-2 xl:order-2 xl:col-span-1"
          style={{ "--glow": accent, "--glow-x": "50%", "--glow-y": "0%" } as CSSProperties}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TrackStatus status={flag?.status ?? null} />
            <p className="text-sm text-muted">{session.event.circuit.name}</p>
          </div>
          {track ? (
            <TrackMap
              track={track}
              cars={markers}
              ghost={ghost}
              title={title}
              accent={accent}
              onSelect={selectCar}
            />
          ) : (
            <EmptyState title={name}>{t("map.noTrack")}</EmptyState>
          )}
          <ReplayBar
            lap={lap}
            totalLaps={totalLaps}
            finished={finished}
            playing={clock.playing}
            speed={clock.speed}
            neutralisations={session.neutralisations}
            pitLaps={carReplay?.pit_in_laps ?? []}
            onToggle={clock.playing ? clock.pause : clock.play}
            onLap={setLap}
            onSpeed={clock.setSpeed}
          />
        </section>

        <div className="flex max-h-[32rem] min-h-0 xl:order-1 xl:max-h-[calc(100vh-6rem)]">
          <RaceTower lines={tower} byCar={byCar} selected={selected} onSelect={selectCar} />
        </div>

        {entry && (
          <aside
            aria-live="polite"
            className="glass flex flex-col gap-5 self-start rounded-[20px] p-5 xl:order-3"
          >
            <SegmentedControl
              legend={t("panel.mode")}
              hideLegend
              options={[
                { value: "stop", label: t("panel.mode.stop") },
                { value: "undercut", label: t("panel.mode.undercut") },
                { value: "strategy", label: t("panel.mode.strategy") },
              ]}
              value={mode}
              onChange={(value) => {
                update({ mode: value === "stop" ? null : value });
              }}
            />
            <div className="flex items-center gap-3">
              <DriverAvatar
                label={entry.car_number}
                name={driverName(entry)}
                colour={entry.team_colour}
                imageUrl={entryPhoto(entry)}
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

            {mode === "strategy" ? (
              real && plan ? (
                <StrategyPanel
                  entry={entry}
                  totalLaps={totalLaps}
                  real={real}
                  plan={plan}
                  compounds={compounds}
                  submitted={strategyActive !== null}
                  result={strategyResult.data}
                  isError={strategyResult.isError}
                  error={strategyResult.error}
                  onChange={(next) => {
                    update({ plan: samePlan(next, real) ? null : encodePlan(next) });
                  }}
                  onSimulate={() => {
                    setStrategyRequest({
                      car: selected,
                      start_compound: plan.start,
                      stops: plan.stops.map((stop) => ({ ...stop })),
                    });
                  }}
                  onWatch={() => {
                    clock.setTime(0);
                    clock.setSpeed(WATCH_SPEED);
                    clock.play();
                  }}
                  onRetry={() => void strategyResult.refetch()}
                />
              ) : (
                <p className="text-muted">{t("whatif.unavailable")}</p>
              )
            ) : mode === "stop" ? (
              <>
                <h2 className="text-xl leading-tight font-bold">
                  {t("stop.question", { name: entry.driver.family_name })}
                </h2>
                <StopPanel
                  sessionId={sessionId}
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
    </div>
  );
}

function NoTiming({ eventId, name }: { eventId: number; name: string }) {
  const { t, locale } = useI18n();
  return (
    <EmptyState title={eventName(name, locale)}>
      <p>{t("race.noTiming")}</p>
      <Link
        to={`/events/${eventId}`}
        className="mt-2 inline-block font-semibold text-mark-text underline"
      >
        {t("race.seeResults")}
      </Link>
    </EmptyState>
  );
}

function emptyClock(carNumber: number): CarClock {
  return { carNumber, lineTimes: [], finished: false };
}

const STATUS_TONE = {
  SC: "bg-caution text-tyre-ink",
  VSC: "bg-caution/70 text-tyre-ink",
  RED: "bg-loss text-tyre-ink",
} as const;

/** The track status at the replay lap: green, or the neutralisation under way. */
function TrackStatus({ status }: { status: "SC" | "VSC" | "RED" | null }) {
  const { t } = useI18n();
  const label =
    status === "SC"
      ? t("live.track.safety_car")
      : status === "VSC"
        ? t("live.track.virtual_safety_car")
        : status === "RED"
          ? t("live.track.red")
          : t("live.track.clear");
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
        status ? STATUS_TONE[status] : "border border-line text-muted"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${status ? "bg-tyre-ink" : "bg-gain"}`}
      />
      {label}
    </p>
  );
}

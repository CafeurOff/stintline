import type { Schema } from "@stintline/api-types";

import type { CSSProperties } from "react";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/States";
import { useTrack } from "@/features/race/api";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

import { type LiveSnapshot, TV_DELAYS, type TvDelay } from "../buffer";
import { FlagTimeline } from "./FlagTimeline";
import { GapRing } from "./GapRing";
import { LiveTrack } from "./LiveTrack";
import { PitLanePanel } from "./PitLanePanel";
import { RaceControl, Radio } from "./RaceMessages";
import { TimingTower } from "./TimingTower";
import { WeatherStrip } from "./WeatherStrip";

type Car = Schema<"LiveCar">;

interface LiveProps {
  snapshot: LiveSnapshot;
  receivedAt: number;
  finished: boolean;
  connected: boolean;
  delay: TvDelay;
  onDelay: (delay: TvDelay) => void;
}

/** Races and sprints: gaps on track, stops and rejoins make sense. */
function isRace(snapshot: LiveSnapshot): boolean {
  return /race|sprint$/i.test(snapshot.session.type) || /sprint$/i.test(snapshot.session.name);
}

/**
 * The live timing screen: the running order on the left, the circuit with every car in the
 * middle, race control, radio and the selected driver on the right (stacked on phones).
 */
export function Live({ snapshot, receivedAt, finished, connected, delay, onDelay }: LiveProps) {
  const { t, locale } = useI18n();
  const [params, update] = useSearchParamsState();
  const track = useTrack(snapshot.reference_session_id ?? 0, snapshot.reference_session_id != null);
  const cars = snapshot.cars;
  const leader = cars[0];
  const chosen = intParam(params, "car");
  const selected = cars.find((c) => c.number === chosen) ?? leader;
  const race = isRace(snapshot);
  const select = (car: number) => {
    update({ car });
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted">
            {!finished && (
              <span aria-hidden="true" className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-mark opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-mark" />
              </span>
            )}
            {finished ? t("live.finished") : t("live.now")} · {snapshot.session.name}
            {snapshot.session.circuit && ` · ${snapshot.session.circuit}`}
          </p>
          <h1 className="display text-2xl leading-tight sm:text-3xl">
            {eventName(snapshot.session.meeting, locale)}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            {snapshot.lap != null && snapshot.total_laps != null && (
              <span className="timing text-lg font-bold tabular-nums">
                {t("live.lap", { lap: snapshot.lap, total: snapshot.total_laps })}
              </span>
            )}
            <SessionClock seconds={snapshot.remaining_s ?? null} />
            <TrackStatus status={snapshot.track_status} />
            {!finished && (
              <span
                className={`flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold ${connected ? "text-muted" : "text-caution"}`}
              >
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${connected ? "bg-gain" : "bg-caution"}`}
                />
                {connected ? t("live.connected") : t("live.reconnecting")}
              </span>
            )}
          </p>
        </div>
        {!finished && (
          <SegmentedControl
            legend={t("live.delay")}
            options={TV_DELAYS.map((d) => ({
              value: String(d),
              label: d === 0 ? t("live.delay.none") : t("live.delay.seconds", { n: d }),
            }))}
            value={String(delay)}
            onChange={(value) => {
              onDelay(Number(value) as TvDelay);
            }}
          />
        )}
      </header>
      <FlagTimeline periods={snapshot.timeline} lap={snapshot.lap} total={snapshot.total_laps} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[22rem_minmax(0,1fr)_19rem] 2xl:grid-cols-[34rem_minmax(0,1fr)_20rem]">
        <section
          aria-label={t("live.mapTitle", { circuit: snapshot.session.circuit })}
          className="glass glow relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-[24px] p-4 sm:p-5 lg:col-start-1 lg:row-start-1 xl:col-start-2"
          style={
            { "--glow": "var(--color-mark)", "--glow-x": "50%", "--glow-y": "0%" } as CSSProperties
          }
        >
          {track.data ? (
            <LiveTrack
              track={track.data}
              cars={cars}
              receivedAt={receivedAt}
              delayMs={delay * 1000}
              selected={selected?.number ?? null}
              pitLossS={race ? (snapshot.pit_loss_s ?? null) : null}
              pitLossSigmaS={snapshot.pit_loss_sigma_s ?? null}
              still={finished}
              title={t("live.mapTitle", { circuit: snapshot.session.circuit })}
              onSelect={select}
            />
          ) : (
            <EmptyState title={snapshot.session.circuit}>{t("live.noTrack")}</EmptyState>
          )}
        </section>

        <section
          aria-labelledby="live-order"
          className="glass flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[20px] lg:col-start-1 lg:row-start-2 xl:col-start-1 xl:row-start-1 xl:max-h-[calc(100vh-11rem)]"
        >
          <h2 id="live-order" className="border-b border-line px-4 py-3 text-sm font-bold">
            {t("live.order")}
          </h2>
          <TimingTower cars={cars} selected={selected?.number ?? null} onSelect={select} />
        </section>

        <aside
          aria-label={t("live.side")}
          className="flex min-w-0 flex-col gap-5 self-start lg:col-start-2 lg:row-span-2 lg:row-start-1 xl:col-start-3 xl:row-span-1"
        >
          {selected && !finished && race && (
            <PitNow car={selected} cars={cars} snapshot={snapshot} />
          )}
          <RaceControl snapshot={snapshot} />
          <Radio snapshot={snapshot} />
          {selected && !finished && race && <GapRing snapshot={snapshot} selected={selected} />}
          <WeatherStrip snapshot={snapshot} />
        </aside>
      </div>
      <PitLanePanel snapshot={snapshot} />
    </div>
  );
}

/** Time left on the session clock, as on the timing screens. */
function SessionClock({ seconds }: { seconds: number | null }) {
  const { t } = useI18n();
  if (seconds == null) return null;
  const whole = Math.max(Math.floor(seconds), 0);
  const text = [Math.floor(whole / 3600), Math.floor(whole / 60) % 60, whole % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return (
    <span className="timing rounded-full border border-line px-2.5 py-0.5 text-sm font-bold tabular-nums">
      <span className="sr-only">{t("live.remaining")} </span>
      {text}
    </span>
  );
}

function TrackStatus({ status }: { status: string }) {
  const { t } = useI18n();
  const known = ["clear", "yellow", "safety_car", "virtual_safety_car", "vsc_ending", "red"];
  const key = known.includes(status) ? status : "clear";
  const tone = key === "clear" ? "text-gain" : key === "red" ? "text-loss" : "text-caution";
  return (
    <span
      className={`rounded-full border border-line-strong px-2.5 py-0.5 text-sm font-bold ${tone}`}
    >
      {t(`live.track.${key as "clear"}`)}
    </span>
  );
}

function PitNow({
  car,
  cars,
  snapshot,
}: {
  car: Car;
  cars: readonly Car[];
  snapshot: LiveSnapshot;
}) {
  const { t, f } = useI18n();
  const code = (n: number | null | undefined) => cars.find((c) => c.number === n)?.code ?? "";
  const stop = car.pit_now;
  return (
    <section aria-labelledby="live-pit" className="glass flex flex-col gap-2 rounded-[20px] p-5">
      <h2 id="live-pit" className="text-lg leading-tight font-bold">
        {t("live.pit.question", { name: car.last_name })}
      </h2>
      {car.in_pit ? (
        <p className="text-muted">{t("live.pit.inPit", { code: car.code })}</p>
      ) : stop && snapshot.pit_loss_s != null ? (
        <>
          <p className="text-2xl font-bold">
            {t("live.pit.position", { position: f.ordinal(stop.position) })}
          </p>
          <p className="text-sm text-muted">
            {stop.ahead != null && stop.margin_ahead_s != null
              ? t("live.pit.ahead", { code: code(stop.ahead), gap: f.seconds(stop.margin_ahead_s) })
              : t("live.pit.leads")}{" "}
            {stop.behind != null && stop.margin_behind_s != null
              ? t("live.pit.behind", {
                  code: code(stop.behind),
                  gap: f.seconds(stop.margin_behind_s),
                })
              : ""}
          </p>
          <p className="text-xs text-muted">
            {t("live.pit.loss", {
              loss: f.seconds(snapshot.pit_loss_s, 0),
              sigma: f.seconds(snapshot.pit_loss_sigma_s ?? 0, 1),
            })}
          </p>
        </>
      ) : (
        <p className="text-muted">{t("live.pit.unknown")}</p>
      )}
    </section>
  );
}

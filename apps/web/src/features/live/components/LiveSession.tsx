import type { Schema } from "@stintline/api-types";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/States";
import { useTrack } from "@/features/race/api";
import { type CarMarker, type Ghost, TrackMap } from "@/features/race/components/TrackMap";
import { pointAt } from "@/features/race/replay";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

import { type LiveSnapshot, TV_DELAYS, type TvDelay } from "../buffer";
import { FALLBACK_LAP_S } from "../ring";
import { FlagTimeline } from "./FlagTimeline";
import { GapRing } from "./GapRing";
import { PitLanePanel } from "./PitLanePanel";
import { RaceControl, Radio } from "./RaceMessages";
import { TimingTower } from "./TimingTower";
import { WeatherStrip } from "./WeatherStrip";

type Car = Schema<"LiveCar">;

/** Cars are moved forward between updates by at most this share of a lap. */
const MAX_EXTRAPOLATION = 0.06;

interface LiveProps {
  snapshot: LiveSnapshot;
  receivedAt: number;
  now: number;
  finished: boolean;
  connected: boolean;
  delay: TvDelay;
  onDelay: (delay: TvDelay) => void;
}

function progressOf(car: Car, elapsedS: number): number {
  const lap = car.last_lap_s ?? FALLBACK_LAP_S;
  const ahead = Math.min(Math.max(elapsedS, 0) / lap, MAX_EXTRAPOLATION);
  return car.laps + Math.min(car.lap_progress + ahead, 0.999);
}

export function Live({
  snapshot,
  receivedAt,
  now,
  finished,
  connected,
  delay,
  onDelay,
}: LiveProps) {
  const { t, locale } = useI18n();
  const [params, update] = useSearchParamsState();
  const track = useTrack(snapshot.reference_session_id ?? 0, snapshot.reference_session_id != null);
  const cars = snapshot.cars;
  const leader = cars[0];
  const chosen = intParam(params, "car");
  const selected = cars.find((c) => c.number === chosen) ?? leader;
  const elapsedS = finished ? 0 : (now - receivedAt) / 1000;

  const markers: CarMarker[] = [];
  let ghost: Ghost | null = null;
  if (track.data) {
    const points = track.data.points;
    for (const car of [...cars].reverse()) {
      if (car.retired || car.stopped) continue;
      const [x, y] = pointAt(points, progressOf(car, elapsedS));
      markers.push({
        carNumber: car.number,
        code: car.code,
        name: `${car.first_name} ${car.last_name}`,
        colour: teamColour(car.colour),
        x,
        y,
        showLabel: car.number === selected?.number || (car.position ?? 99) <= 3,
        selected: car.number === selected?.number,
        dimmed: car.in_pit,
      });
    }
    if (selected && snapshot.pit_loss_s != null && !finished && !selected.in_pit) {
      const lap = selected.last_lap_s ?? FALLBACK_LAP_S;
      const at = progressOf(selected, elapsedS) - snapshot.pit_loss_s / lap;
      const sigma = (snapshot.pit_loss_sigma_s ?? 0) / lap;
      const [x, y] = pointAt(points, at);
      ghost = {
        code: selected.code,
        x,
        y,
        zone: [-1, -0.5, 0, 0.5, 1].map((k) => pointAt(points, at + k * sigma)),
      };
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-muted">
            {!finished && <span aria-hidden="true" className="size-2 rounded-full bg-mark" />}
            {finished ? t("live.finished") : t("live.now")} · {snapshot.session.name}
          </p>
          <h1 className="text-3xl leading-tight font-bold sm:text-4xl">
            {eventName(snapshot.session.meeting, locale)}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-3">
            {snapshot.lap != null && snapshot.total_laps != null && (
              <span className="text-lg font-bold tabular-nums">
                {t("live.lap", { lap: snapshot.lap, total: snapshot.total_laps })}
              </span>
            )}
            <TrackStatus status={snapshot.track_status} />
            {!finished && (
              <span className="text-sm text-muted">
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {track.data ? (
            <TrackMap
              track={track.data}
              cars={markers}
              ghost={ghost}
              title={t("live.mapTitle", { circuit: snapshot.session.circuit })}
              onSelect={(car) => {
                update({ car });
              }}
            />
          ) : (
            <EmptyState title={snapshot.session.circuit}>{t("live.noTrack")}</EmptyState>
          )}
          <TimingTower
            cars={cars}
            selected={selected?.number ?? null}
            onSelect={(car) => {
              update({ car });
            }}
          />
          <PitLanePanel snapshot={snapshot} />
        </div>
        <aside aria-label={t("live.side")} className="flex flex-col gap-6 self-start">
          {selected && !finished && <PitNow car={selected} cars={cars} snapshot={snapshot} />}
          {selected && !finished && <GapRing snapshot={snapshot} selected={selected} />}
          <WeatherStrip snapshot={snapshot} />
          <Radio snapshot={snapshot} />
          <RaceControl snapshot={snapshot} />
        </aside>
      </div>
    </div>
  );
}

function TrackStatus({ status }: { status: string }) {
  const { t } = useI18n();
  const known = ["clear", "yellow", "safety_car", "virtual_safety_car", "vsc_ending", "red"];
  const key = known.includes(status) ? status : "clear";
  const tone = key === "clear" ? "text-gain" : key === "red" ? "text-loss" : "text-caution";
  return (
    <span className={`rounded-md border border-line-strong px-2 py-0.5 text-sm font-bold ${tone}`}>
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

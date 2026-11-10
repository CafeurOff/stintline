import type { Schema } from "@stintline/api-types";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { PageHeader } from "@/components/hub/PageHeader";
import { CompoundBadge } from "@/components/racing/CompoundBadge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useTrack } from "@/features/race/api";
import { type CarMarker, type Ghost, TrackMap } from "@/features/race/components/TrackMap";
import { pointAt } from "@/features/race/replay";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

import { useLiveStatus } from "../api";
import { delayed, type LiveSnapshot, TV_DELAYS, type TvDelay } from "../buffer";
import { useLiveSocket } from "../useLiveSocket";

type Car = Schema<"LiveCar">;

const DELAY_KEY = "stintline-tv-delay";
/** Map refresh while cars move between two feed updates. */
const TICK_MS = 250;
/** Cars are moved forward between updates by at most this share of a lap. */
const MAX_EXTRAPOLATION = 0.06;
const FALLBACK_LAP_S = 90;

function storedDelay(): TvDelay {
  try {
    const value = Number(localStorage.getItem(DELAY_KEY));
    return TV_DELAYS.find((d) => d === value) ?? 0;
  } catch {
    return 0;
  }
}

function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      clearInterval(id);
    };
  }, [active]);
  return now;
}

/** Live session from the local live process, with a TV delay; offline otherwise. */
export function LivePage() {
  const status = useLiveStatus();
  const online = status.data !== undefined && status.data.state !== "offline";
  const { buffer, connected } = useLiveSocket(online);
  const [delay, setDelay] = useState<TvDelay>(storedDelay);
  const now = useTicker(online);
  const shown = delayed(buffer, now, delay);
  const snapshot = shown?.snapshot ?? status.data?.snapshot ?? null;

  if (status.isError) {
    return <ErrorState error={status.error} onRetry={() => void status.refetch()} />;
  }
  if (!status.data) return <Skeleton className="h-[60vh]" />;
  if (!online || !snapshot) return <Offline next={status.data.next_session} />;

  return (
    <Live
      snapshot={snapshot}
      receivedAt={shown?.receivedAt ?? now}
      now={now}
      finished={status.data.state === "finished"}
      connected={connected}
      delay={delay}
      onDelay={(value) => {
        setDelay(value);
        try {
          localStorage.setItem(DELAY_KEY, String(value));
        } catch {
          // Private mode: the choice simply is not remembered.
        }
      }}
    />
  );
}

const SESSION_KINDS = ["FP1", "FP2", "FP3", "SQ", "SPRINT", "Q", "R"] as const;

function sessionLabel(kind: string, t: ReturnType<typeof useI18n>["t"]): string {
  const known = SESSION_KINDS.find((k) => k === kind);
  return known ? t(`session.${known}`) : kind;
}

function Offline({ next }: { next: Schema<"LiveStatus">["next_session"] }) {
  const { t, locale } = useI18n();
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title={t("live.offline.title")}>{t("live.offline.body")}</PageHeader>
      {next && (
        <section aria-labelledby="live-next" className="rounded-2xl bg-panel p-6">
          <p className="text-sm text-muted">{t("live.next")}</p>
          <h2 id="live-next" className="text-2xl font-bold">
            <Link to={`/events/${String(next.event_id)}`} className="hover:underline">
              {eventName(next.event_name, locale)}
            </Link>
          </h2>
          <p className="mt-1">
            <span className="font-semibold">{sessionLabel(next.kind, t)}</span>
            {" · "}
            {new Intl.DateTimeFormat(tag, {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(next.starts_at))}
          </p>
        </section>
      )}
      <section aria-labelledby="live-how" className="flex flex-col gap-2 text-muted">
        <h2 id="live-how" className="text-lg font-bold text-ink">
          {t("live.how.title")}
        </h2>
        <p>{t("live.how.body")}</p>
        <p>
          <code className="rounded bg-raised px-2 py-1 font-mono text-ink">make live</code>
        </p>
        <p className="text-sm">{t("live.how.note")}</p>
      </section>
    </div>
  );
}

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

function Live({ snapshot, receivedAt, now, finished, connected, delay, onDelay }: LiveProps) {
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
          <Leaderboard
            cars={cars}
            selected={selected?.number ?? null}
            onSelect={(car) => {
              update({ car });
            }}
          />
        </div>
        <aside aria-label={t("live.side")} className="flex flex-col gap-6 self-start">
          {selected && !finished && <PitNow car={selected} cars={cars} snapshot={snapshot} />}
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

function gapText(car: Car, t: ReturnType<typeof useI18n>["t"], f: ReturnType<typeof useI18n>["f"]) {
  if (car.position === 1) return t("live.leader");
  if (car.laps_behind > 0)
    return t(car.laps_behind === 1 ? "event.lapDown" : "event.lapsDown", { n: car.laps_behind });
  return car.gap_s == null ? "" : `+${f.number(car.gap_s, 3)}`;
}

function Leaderboard({
  cars,
  selected,
  onSelect,
}: {
  cars: readonly Car[];
  selected: number | null;
  onSelect: (car: number) => void;
}) {
  const { t, f } = useI18n();
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <caption className="sr-only">{t("live.order")}</caption>
        <thead>
          <tr>
            <th className="num">{t("col.position")}</th>
            <th>{t("col.driver")}</th>
            <th className="num">{t("live.gap")}</th>
            <th className="num hidden sm:table-cell">{t("live.interval")}</th>
            <th>{t("live.tyres")}</th>
            <th className="num hidden md:table-cell">{t("live.stops")}</th>
            <th className="num hidden md:table-cell">{t("live.lastLap")}</th>
          </tr>
        </thead>
        <tbody>
          {cars.map((car) => (
            <tr key={car.number} className={car.number === selected ? "bg-raised" : ""}>
              <td className="num font-bold">{car.position ?? "—"}</td>
              <td>
                <button
                  type="button"
                  aria-pressed={car.number === selected}
                  onClick={() => {
                    onSelect(car.number);
                  }}
                  className="flex items-center gap-2 font-semibold hover:underline"
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-1 rounded-full"
                    style={{ backgroundColor: teamColour(car.colour) }}
                  />
                  {car.code}
                  <span className="sr-only">
                    {" "}
                    {car.first_name} {car.last_name}
                  </span>
                  {(car.in_pit || car.retired) && (
                    <span className="rounded bg-raised px-1.5 text-xs text-muted">
                      {car.retired ? t("live.out") : t("live.inPit")}
                    </span>
                  )}
                </button>
              </td>
              <td className="num">{gapText(car, t, f)}</td>
              <td className="num hidden sm:table-cell">
                {car.interval_s == null ? "" : `+${f.number(car.interval_s, 3)}`}
              </td>
              <td>
                <span className="flex items-center gap-1.5">
                  {car.compound && <CompoundBadge compound={car.compound} />}
                  {car.tyre_age != null && (
                    <span className="text-sm text-muted tabular-nums">{car.tyre_age}</span>
                  )}
                </span>
              </td>
              <td className="num hidden md:table-cell">{car.pit_stops}</td>
              <td className="num hidden md:table-cell">{f.lapTime(car.last_lap_s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    <section
      aria-labelledby="live-pit"
      className="flex flex-col gap-2 rounded-2xl border border-line bg-panel p-5"
    >
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

function clock(value: string | null | undefined, locale: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function Radio({ snapshot }: { snapshot: LiveSnapshot }) {
  const { t, locale } = useI18n();
  const byNumber = new Map(snapshot.cars.map((c) => [c.number, c]));
  if (snapshot.team_radio.length === 0) return null;
  return (
    <section aria-labelledby="live-radio" className="flex flex-col gap-3">
      <h2 id="live-radio" className="text-lg font-bold">
        {t("live.radio")}
      </h2>
      <ul className="flex flex-col gap-3">
        {snapshot.team_radio.slice(0, 8).map((radio) => {
          const car = byNumber.get(radio.number);
          const label = t("live.radioOf", {
            code: car?.code ?? String(radio.number),
            time: clock(radio.at, locale),
          });
          return (
            <li key={radio.url} className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className="h-3 w-1 rounded-full"
                  style={{ backgroundColor: teamColour(car?.colour) }}
                />
                <span className="font-semibold">{car?.code ?? radio.number}</span>
                <span className="text-muted tabular-nums">{clock(radio.at, locale)}</span>
              </span>
              {/* No transcript exists for team radio clips, so there is no caption track to add. */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption -- see above */}
              <audio
                controls
                preload="none"
                src={radio.url}
                aria-label={label}
                className="h-8 w-full"
              />
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">{t("live.radioNote")}</p>
    </section>
  );
}

function RaceControl({ snapshot }: { snapshot: LiveSnapshot }) {
  const { t, locale } = useI18n();
  if (snapshot.race_control.length === 0) return null;
  return (
    <section aria-labelledby="live-rc" className="flex flex-col gap-2">
      <h2 id="live-rc" className="text-lg font-bold">
        {t("live.raceControl")}
      </h2>
      <ol className="flex flex-col gap-2 text-sm">
        {snapshot.race_control.slice(0, 10).map((message, index) => (
          <li key={`${message.at ?? ""}-${String(index)}`} className="border-b border-line pb-2">
            <span className="text-muted tabular-nums">
              {clock(message.at, locale)}
              {message.lap != null && ` · ${t("analysis.lap")} ${String(message.lap)}`}
            </span>
            <span className="block">{message.message}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

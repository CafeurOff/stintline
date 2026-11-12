import type { Schema } from "@stintline/api-types";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { Countdown } from "@/components/hub/Countdown";
import { SectionTitle } from "@/components/hub/SectionTitle";
import { CircuitMark } from "@/components/racing/CircuitMark";
import { CompoundBadge } from "@/components/racing/CompoundBadge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useEvent, useHome } from "@/features/hub/api";
import { useTrack } from "@/features/race/api";
import { type CarMarker, type Ghost, TrackMap } from "@/features/race/components/TrackMap";
import { pointAt } from "@/features/race/replay";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { sessionLabel } from "@/lib/sessions";
import { useClock } from "@/lib/useClock";
import { teamColour } from "@/lib/teams";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

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
  const { t } = useI18n();
  const status = useLiveStatus();
  useDocumentTitle(t("nav.live"));
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

const SESSION_HOURS = 2;
const HOUR_MS = 3_600_000;

/** No live data: what comes next, the weekend in the visitor's time, and replays meanwhile. */
function Offline({ next }: { next: Schema<"LiveStatus">["next_session"] }) {
  const { t, locale } = useI18n();
  const now = useClock(30_000);
  const event = useEvent(next?.event_id ?? 0, next !== null).data;
  const last = useHome().data?.last_race;
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const when = new Intl.DateTimeFormat(tag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const sessions = (event?.sessions ?? []).filter((s) => s.scheduled_start);
  const running = sessions.find((s) => {
    const start = new Date(s.scheduled_start ?? "").getTime();
    return now >= start && now < start + SESSION_HOURS * HOUR_MS;
  });

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="live-title"
        className="relative overflow-hidden rounded-xl border border-line border-mark bg-panel"
      >
        {event?.circuit.outline && (
          <CircuitMark
            path={event.circuit.outline}
            stroke="var(--color-mark)"
            width={6}
            className="pointer-events-none absolute -right-8 -bottom-10 size-80 opacity-20 sm:size-96"
          />
        )}
        <div className="relative flex flex-col gap-6 p-6 sm:p-10">
          <p className="flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
            <span className="flex items-center gap-1.5 rounded-sm bg-raised px-2 py-0.5">
              <span
                className={`size-2 rounded-full ${running ? "animate-pulse bg-mark" : "bg-line-strong"}`}
              />
              {t("nav.live")}
            </span>
          </p>
          <div>
            <h1 id="live-title" className="text-3xl leading-tight font-extrabold sm:text-5xl">
              {running ? t("live.running.title") : t("live.offline.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-lg text-muted">
              {running ? t("live.running.body") : t("live.offline.body")}
            </p>
          </div>
          {next && !running && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-bold tracking-wide text-mark-text uppercase">
                  {t("live.next")} · {sessionLabel(next.kind, t)}
                </p>
                <h2 className="text-2xl font-extrabold">
                  <Link to={`/events/${String(next.event_id)}`} className="hover:underline">
                    {eventName(next.event_name, locale)}
                  </Link>
                </h2>
                <p className="text-muted first-letter:uppercase">
                  {when.format(new Date(next.starts_at))}
                </p>
              </div>
              <Countdown target={next.starts_at} />
            </div>
          )}
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        {sessions.length > 0 && event && (
          <section
            aria-labelledby="live-weekend"
            className="flex flex-col gap-3 rounded-xl bg-panel p-5"
          >
            <SectionTitle id="live-weekend">{eventName(event.name, locale)}</SectionTitle>
            <ul className="flex flex-col">
              {sessions.map((s) => {
                const start = new Date(s.scheduled_start ?? "").getTime();
                const done = now >= start + SESSION_HOURS * HOUR_MS;
                const isRunning = s === running;
                return (
                  <li
                    key={s.id}
                    className={`flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0 ${
                      done ? "text-muted" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {isRunning && <span className="size-2 animate-pulse rounded-full bg-mark" />}
                      {sessionLabel(s.kind, t)}
                    </span>
                    <span className="text-sm tabular-nums first-letter:uppercase">
                      {done ? t("live.done") : when.format(new Date(start))}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">{t("home.localTime")}</p>
          </section>
        )}
        {last?.has_data && (
          <section
            aria-labelledby="live-replay"
            className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-xl bg-panel p-5"
          >
            {last.event.circuit.outline && (
              <CircuitMark
                path={last.event.circuit.outline}
                stroke="var(--color-ink)"
                width={4}
                className="pointer-events-none absolute top-4 right-4 size-32 opacity-20"
              />
            )}
            <div className="relative">
              <p className="text-xs font-bold tracking-wide text-muted uppercase">
                {t("live.meanwhile")}
              </p>
              <h2 id="live-replay" className="mt-1 max-w-[70%] text-2xl font-extrabold">
                {eventName(last.event.name, locale)} {last.event.season}
              </h2>
              <p className="mt-2 max-w-md text-muted">{t("live.replayBody")}</p>
            </div>
            <div className="relative flex flex-wrap gap-3">
              <Link
                to={`/sessions/${String(last.session_id)}`}
                className="inline-flex items-center gap-2 rounded-lg bg-action px-5 py-3 font-bold text-white hover:brightness-110"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
                  <path d="M7 4l13 8-13 8z" />
                </svg>
                {t("live.replayLast")}
              </Link>
              <Link
                to={`/news/${String(last.session_id)}`}
                className="rounded-lg border border-line-strong px-5 py-3 font-bold hover:border-ink"
              >
                {t("home.report")}
              </Link>
            </div>
          </section>
        )}
      </div>
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
      className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-5"
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

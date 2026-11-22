import { Route } from "lucide-react";
import { Link } from "react-router";

import { AmbientTrack } from "@/components/layout/AmbientTrack";
import { pillGlass, pillPrimary } from "@/components/layout/Glass";
import { Trails } from "@/components/layout/Trails";
import { Flag } from "@/components/racing/Flag";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCircuits } from "@/features/analysis/api";
import { weekendDates } from "@/features/calendar/dates";
import { useForecasts } from "@/features/forecast/api";
import { ForecastBadge, WeatherIcon } from "@/features/forecast/components/ForecastBadge";
import { circuitAccent } from "@/lib/accent";
import { readable } from "@/lib/colour";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { sessionLabel, sessionShort } from "@/lib/sessions";
import { timeLeft, useClock } from "@/lib/useClock";

import { type Event, glowStyle, two } from "./helpers";

export function NextRaceHero({ event }: { event: Event }) {
  const { t, locale } = useI18n();
  const now = useClock(1000);
  const accent = circuitAccent(event.circuit.ref);
  const session = event.sessions
    .filter((s) => s.scheduled_start && new Date(s.scheduled_start).getTime() > now)
    .sort((a, b) => (a.scheduled_start ?? "").localeCompare(b.scheduled_start ?? ""))[0];
  // A session under way: no countdown at zero, a way to follow it live instead.
  const running = event.sessions.find(
    (s) =>
      s.scheduled_start &&
      s.ends_at &&
      new Date(s.scheduled_start).getTime() <= now &&
      new Date(s.ends_at).getTime() > now,
  );
  const target = session?.scheduled_start ?? `${event.race_date}T12:00:00Z`;
  const left = timeLeft(new Date(target).getTime(), now);
  const forecast = useForecasts(event.id).data?.find((f) => f.session_id === session?.id);
  const parts = [
    [left.days, t("countdown.days")],
    [left.hours, t("countdown.hours")],
    [left.minutes, t("countdown.minutes")],
  ] as const;

  return (
    <section
      aria-labelledby="home-next"
      className="glass glow relative overflow-hidden rounded-[24px]"
      style={glowStyle(accent, "90%", "45%")}
    >
      <Trails colour={accent} />
      <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10">
        <div className="relative z-10 flex flex-col gap-7">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Flag country={event.circuit.country} className="text-base" />
              {t("picker.round", { round: event.round })}
            </p>
            <h2 id="home-next" className="display mt-2 text-4xl leading-[0.95] sm:text-6xl">
              {eventName(event.name, locale)}
            </h2>
            <p className="mt-2 text-lg font-bold" style={{ color: readable(accent) }}>
              {event.circuit.name}
            </p>
            <p className="text-sm font-medium text-muted">
              {weekendDates(event, locale)} · {countryName(event.circuit.country, locale)}
            </p>
          </div>

          {running ? (
            <div className="flex flex-col items-start gap-3">
              <p
                className="display flex items-center gap-3 text-3xl sm:text-5xl"
                style={{ color: readable(accent, 80) }}
              >
                <span aria-hidden="true" className="size-3 animate-pulse rounded-full bg-mark" />
                {t("home.underway", { session: sessionLabel(running.kind, t) })}
              </p>
              <Link to="/live" className={pillGlass}>
                {t("home.watchLive")}
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-muted">
                {session
                  ? t("home.startsIn", { session: sessionLabel(session.kind, t) })
                  : t("home.nextRace")}
              </p>
              <div
                role="timer"
                aria-label={t("countdown.label", {
                  days: left.days,
                  hours: left.hours,
                  minutes: left.minutes,
                })}
                className="mt-1 flex gap-6 sm:gap-9"
              >
                {parts.map(([value, unit]) => (
                  <span key={unit} aria-hidden="true" className="flex flex-col">
                    <span
                      key={value}
                      className="num timing animate-[tick_0.45s_ease-out] text-7xl leading-[0.85] sm:text-9xl"
                      style={{ color: readable(accent, 80) }}
                    >
                      {two(value)}
                    </span>
                    <span className="mt-1 text-xs font-semibold text-muted">{unit}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Link to={`/events/${String(event.id)}`} className={pillPrimary}>
              {t("home.schedule")}
            </Link>
            <Link to={`/circuits/${event.circuit.ref}`} className={pillGlass}>
              <Route aria-hidden="true" className="size-4" />
              {t("home.circuitStats")}
            </Link>
            {forecast && <ForecastBadge forecast={forecast} />}
          </div>
        </div>

        <div className="relative flex flex-col justify-between gap-4">
          {event.circuit.outline && (
            <AmbientTrack
              path={event.circuit.outline}
              colour={accent}
              className="mx-auto aspect-square w-full max-w-[460px] lg:-mt-4"
            />
          )}
          <CircuitFigures circuitRef={event.circuit.ref} />
        </div>
      </div>
      <WeekendStrip event={event} nextId={session?.id ?? null} />
    </section>
  );
}

/** Our figures for the circuit (track DNA, ADR 0017), in the style of a stat sheet. */
function CircuitFigures({ circuitRef }: { circuitRef: string }) {
  const { t, f } = useI18n();
  const circuits = useCircuits();
  // Two rows of figures: held while they load so the weekend strip below stays put.
  if (circuits.isPending) return <Skeleton className="relative z-10 h-[7.5rem]" />;
  const profile = circuits.data?.find((c) => c.circuit.ref === circuitRef);
  if (!profile) return null;
  const stats: [string, string, string | null][] = [];
  if (profile.lap_length_m != null) {
    stats.push([t("home.stat.lapLength"), f.number(profile.lap_length_m / 1000, 3), "km"]);
  }
  if (profile.top_speed_kph != null) {
    stats.push([t("home.stat.topSpeed"), f.number(profile.top_speed_kph, 0), "km/h"]);
  }
  if (profile.pit_loss_s != null) {
    stats.push([t("home.stat.pitLoss"), f.number(profile.pit_loss_s, 1), "s"]);
  }
  if (profile.degradation_s_per_lap != null) {
    stats.push([t("home.stat.wear"), f.number(profile.degradation_s_per_lap, 3), t("home.perLap")]);
  }
  if (profile.races > 0) {
    stats.push([
      t("home.stat.safetyCar"),
      `${String(profile.safety_car_races)}/${String(profile.races)}`,
      t("home.stat.races"),
    ]);
  }
  if (stats.length === 0) return null;
  return (
    <dl className="relative z-10 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
      {stats.map(([label, value, unit]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="order-3 flex items-center gap-1.5 text-xs font-medium text-muted">
            {label}
          </dt>
          <dd className="order-2 flex items-baseline gap-1">
            <span className="num display text-2xl">{value}</span>
            {unit && <span className="text-xs font-semibold text-muted">{unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The sessions of the weekend in a row: day, name, local time and the sky. */
function WeekendStrip({ event, nextId }: { event: Event; nextId: number | null }) {
  const { t, locale } = useI18n();
  const forecasts = useForecasts(event.id).data ?? [];
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const day = new Intl.DateTimeFormat(tag, { day: "2-digit" });
  const weekday = new Intl.DateTimeFormat(tag, { weekday: "short" });
  const time = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit" });
  const sessions = event.sessions
    .filter((s): s is typeof s & { scheduled_start: string } => Boolean(s.scheduled_start))
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
  if (sessions.length === 0) return null;
  return (
    <div className="relative border-t border-line">
      <h3 className="sr-only">{t("home.weekend")}</h3>
      <ol className="flex overflow-x-auto">
        {sessions.map((s) => {
          const start = new Date(s.scheduled_start);
          const forecast = forecasts.find((fc) => fc.session_id === s.id);
          const isNext = s.id === nextId;
          return (
            <li
              key={s.id}
              className={`flex min-w-36 flex-1 items-center gap-3 border-r border-line px-4 py-4 last:border-r-0 sm:min-w-44 sm:px-6 ${
                isNext ? "bg-ink/[0.06]" : ""
              }`}
            >
              <span className="flex w-9 flex-col items-center leading-none">
                <span className="num text-2xl font-bold">{day.format(start)}</span>
                <span className="mt-1 text-[0.65rem] font-bold text-muted uppercase">
                  {weekday.format(start)}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  <span className="sm:hidden" title={sessionLabel(s.kind, t)}>
                    {sessionShort(s.kind, t)}
                  </span>
                  <span className="hidden sm:inline">{sessionLabel(s.kind, t)}</span>
                </span>
                <span className="num block text-xs text-muted">{time.format(start)}</span>
              </span>
              {forecast && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <WeatherIcon code={forecast.weather_code} className="size-4" />
                  {forecast.air_c != null && (
                    <span className="num">{Math.round(forecast.air_c)}°</span>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

import type { Schema } from "@stintline/api-types";
import {
  ChevronRight,
  Flag as FlagIcon,
  Play,
  Route,
  Siren,
  Timer,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { Link } from "react-router";

import { NO_BACKDROP } from "@/components/dash/backdrop";
import { Bust } from "@/components/dash/Bust";
import { Face } from "@/components/dash/Face";
import { Move } from "@/components/dash/Move";
import {
  GlassCard,
  IconBubble,
  MoreLink,
  PillSwitch,
  pillGlass,
  pillPrimary,
} from "@/components/glass/Glass";
import { TrackMap } from "@/components/glass/TrackMap";
import { Trails } from "@/components/glass/Trails";
import { CarImage } from "@/components/racing/CarImage";
import { CircuitMark } from "@/components/racing/CircuitMark";
import { Flag } from "@/components/racing/Flag";
import { initials } from "@/components/racing/initials";
import { Skeleton, SkeletonTiles } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { weekendDates } from "@/features/calendar/dates";
import { useTitle } from "@/features/championship/api";
import { titleSummary } from "@/features/championship/summary";
import { TitleSentence } from "@/features/championship/TitleFight";
import { useForecasts } from "@/features/forecast/api";
import { ForecastBadge, WeatherIcon } from "@/features/forecast/components/ForecastBadge";
import { FILTERS, type Tag, useFacts } from "@/features/hub/facts";
import { useHome, useProgression, useSeasonEvents, useStandings } from "@/features/hub/api";
import { useCircuits } from "@/features/insights/api";
import { useHeadlines, useReport } from "@/features/news/api";
import { useAgo } from "@/features/news/useAgo";
import { useSessionDetail } from "@/features/race/api";
import { circuitAccent } from "@/lib/accent";
import { readable } from "@/lib/colour";
import { eventName } from "@/lib/i18n/content";
import { HeadlineThumb } from "@/features/news/components/HeadlineThumb";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { sessionLabel, sessionShort } from "@/lib/sessions";
import { teamColour } from "@/lib/teams";
import { timeLeft, useClock } from "@/lib/useClock";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

type Entry = Schema<"Entry">;
type Line = Schema<"StandingLine">;
type Event = Schema<"Event">;
type Report = Schema<"RaceReport">;

/** Standings rows shown on the home page; the full tables are on the standings page. */
const STANDINGS_ROWS = 10;
/** Facts shown at once in the facts card. */
const FACTS_SHOWN = 4;

/**
 * Font size that makes a word fill `pct` % of its container's width (container query units),
 * for the hollow watermarks: expanded heavy capitals and digits are about 0.9 em wide.
 */
function fitWidth(word: string, pct: number): string {
  return `${(pct / (Math.max(word.length, 1) * 0.9)).toFixed(2)}cqw`;
}

function glowStyle(colour: string, x = "100%", y = "100%"): CSSProperties {
  return { "--glow": colour, "--glow-x": x, "--glow-y": y } as CSSProperties;
}

/**
 * Home page in the glass skin (pilot): the next Grand Prix in a hero with its countdown and
 * our circuit figures, the last race around its winner, key figures as widgets, both
 * championships, the facts, the news and the season's races.
 */
export function HomePage() {
  const { t } = useI18n();
  const home = useHome();
  useDocumentTitle(null);

  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;
  if (!home.data) return <Skeleton className="h-[70vh] rounded-[20px]" />;
  if (!home.data.last_race && !home.data.next_event) {
    return (
      <EmptyState title={t("home.empty.title")}>
        <p>{t("home.empty.body")}</p>
      </EmptyState>
    );
  }
  return <Dashboard home={home.data} />;
}

function Dashboard({ home }: { home: Schema<"Home"> }) {
  const { t } = useI18n();
  const { last_race: last, next_event: next, season } = home;
  const reportQuery = useReport(last?.session_id ?? 0, last !== null);
  const report = reportQuery.data ?? null;
  const events = useSeasonEvents(season).data?.results ?? [];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">{t("home.title")}</h1>
      {next && <NextRaceHero event={next} />}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {last && <LastRaceCard race={last} report={report} />}
        {home.drivers.length > 1 && <LeaderCard lines={home.drivers} season={season} />}
      </div>

      {report && <Widgets report={report} />}
      {last && reportQuery.isPending && <SkeletonTiles className={WIDGETS_GRID} tile="h-44" />}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {season !== null && <StandingsCards season={season} />}
        {report && <FactsCard report={report} />}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <NewsCard />
        {events.length > 0 && season !== null && (
          <RacesCard season={season} events={events} nextId={next?.id ?? null} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

function photoOf(entry: { driver: Schema<"Driver">; media?: Schema<"Media"> | null }) {
  return entry.media?.driver_image_url ?? entry.driver.photo_url;
}

function codeOf(driver: Schema<"Driver">): string {
  return driver.code ?? initials(driver.given_name, driver.family_name);
}

function two(n: number): string {
  return String(n).padStart(2, "0");
}

/* ---------------------------------------------------------------- next race */

function NextRaceHero({ event }: { event: Event }) {
  const { t, locale } = useI18n();
  const now = useClock(1000);
  const accent = circuitAccent(event.circuit.ref);
  const session = event.sessions
    .filter((s) => s.scheduled_start && new Date(s.scheduled_start).getTime() > now)
    .sort((a, b) => (a.scheduled_start ?? "").localeCompare(b.scheduled_start ?? ""))[0];
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
            <TrackMap
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

/* ---------------------------------------------------------------- last race */

function LastRaceCard({ race, report }: { race: Schema<"LastRace">; report: Report | null }) {
  const { t, f, locale } = useI18n();
  const detail = useSessionDetail(race.session_id).data ?? null;
  const winner = race.podium[0];
  const colour = teamColour(winner?.team_colour);
  const winnerEntry: Entry | undefined =
    detail?.entries.find((e) => e.car_number === winner?.car_number) ?? winner;
  const margin = report?.podium[1]?.gap_s;
  const figures: [string, string][] = [];
  if (margin != null) figures.push([`+${f.seconds(margin, 3)}`, t("home.marginLabel")]);
  if (report?.winner_wins != null) figures.push([two(report.winner_wins), t("home.seasonWins")]);
  if (report?.winner_strategy) figures.push([two(report.winner_strategy.stops), t("home.pits")]);

  return (
    <section
      aria-labelledby="home-last"
      className="glass glow relative flex min-h-[460px] flex-col overflow-hidden rounded-[24px] xl:col-span-2"
      style={glowStyle(colour, "80%", "100%")}
    >
      <Trails colour={colour} className="opacity-70" />
      {winner && (
        <div
          aria-hidden="true"
          className="@container relative h-72 overflow-hidden sm:absolute sm:inset-y-0 sm:right-0 sm:h-auto sm:w-[56%]"
        >
          <span
            className="watermark num absolute top-4 right-4"
            style={{ fontSize: fitWidth(String(winner.car_number), 62) }}
          >
            {winner.car_number}
          </span>
          <span className="absolute right-[4%] bottom-3 left-[2%] z-0 h-6 rounded-[50%] bg-black/50 blur-xl" />
          <CarImage
            url={winnerEntry?.media?.car_image_url}
            className="absolute bottom-5 left-0 z-[1] w-[60%] drop-shadow-[0_18px_24px_rgb(0_0_0/0.55)]"
          />
          <Face
            url={photoOf(winnerEntry ?? winner)}
            label={codeOf(winner.driver)}
            colour={winner.team_colour}
            className="absolute right-[3%] bottom-0 z-[2] h-[94%] w-auto max-w-[44%] !object-contain object-bottom text-5xl"
            style={NO_BACKDROP}
            priority
          />
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col gap-5 p-6 sm:max-w-[44%] sm:p-9">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted">
          <span className="rounded-md bg-action px-2 py-0.5 text-xs font-bold text-white uppercase">
            {t("home.lastRace")}
          </span>
          {t("picker.round", { round: race.event.round })} · {f.date(race.event.race_date)}
        </p>
        <div>
          <h2 id="home-last" className="display text-4xl leading-[0.95] sm:text-5xl">
            {eventName(race.event.name, locale)}
          </h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Flag country={race.event.circuit.country} />
            {race.event.circuit.name}
          </p>
        </div>
        {winner && (
          <p className="text-lg font-bold">
            {t("home.winnerLine", {
              winner: `${winner.driver.given_name} ${winner.driver.family_name}`,
              team: winner.team.name,
            })}
          </p>
        )}
        {figures.length > 0 && (
          <dl className="flex gap-7">
            {figures.map(([value, label]) => (
              <div key={label} className="flex flex-col">
                <dt className="order-3 text-xs font-semibold text-muted">{label}</dt>
                <dd className="num display order-2 text-3xl" style={{ color: readable(colour) }}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div className="flex flex-wrap gap-3">
          {race.has_data && (
            <Link to={`/sessions/${String(race.session_id)}`} className={pillPrimary}>
              <Play aria-hidden="true" className="size-4 fill-current" />
              {t("home.replay")}
            </Link>
          )}
          <Link to={`/events/${String(race.event.id)}`} className={pillGlass}>
            {t("home.results")}
          </Link>
          <Link to={`/news/${String(race.session_id)}`} className={pillGlass}>
            {t("home.report")}
          </Link>
        </div>

        <ol aria-label={t("home.podium")} className="mt-auto flex flex-col gap-2">
          {race.podium.map((entry, index) => (
            <li key={entry.car_number}>
              <Link
                to={`/drivers/${entry.driver.ref}`}
                className="glass flex items-center gap-3 rounded-xl py-2 pr-4 pl-3 hover:border-line-strong"
              >
                <span className="num display w-7 text-center text-xl">{index + 1}</span>
                <Face
                  url={photoOf(entry)}
                  label={codeOf(entry.driver)}
                  colour={entry.team_colour}
                  className="size-9 shrink-0 rounded-full text-[0.6rem]"
                />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate font-bold">{entry.driver.family_name}</span>
                  <span
                    className="block truncate text-xs font-semibold"
                    style={{ color: readable(teamColour(entry.team_colour)) }}
                  >
                    {entry.team.name}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 text-muted" />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- leader */

function LeaderCard({ lines, season }: { lines: readonly Line[]; season: number | null }) {
  const { t, f } = useI18n();
  const summary = titleSummary(useTitle(season).data);
  const [first, second] = lines;
  if (!first?.driver) return null;
  const colour = teamColour(first.colour);
  const lead = (first.points ?? 0) - (second?.points ?? 0);
  const figures: [string, string][] = [
    [two(first.position ?? 1), t("home.pos")],
    [f.number(first.points ?? 0, 0), t("home.pts")],
    [two(first.wins ?? 0), t("home.wins")],
  ];
  return (
    <GlassCard
      id="home-leader"
      eyebrow={season !== null ? t("home.drivers", { season }) : undefined}
      title={t("dash.leader")}
      glow={colour}
      className="@container min-h-[460px] rounded-[24px]"
      bodyClassName="justify-end"
    >
      <span
        aria-hidden="true"
        className="watermark absolute top-2 right-4 uppercase"
        style={{ fontSize: fitWidth(codeOf(first.driver), 88) }}
      >
        {codeOf(first.driver)}
      </span>
      {/* Phones: a bust in the top corner, so the figures and the sentence stay clear. */}
      <Bust
        url={first.driver.photo_url}
        label={codeOf(first.driver)}
        colour={first.colour}
        className="absolute top-12 right-0 h-52 w-[58%] sm:hidden"
      />
      <Face
        url={first.driver.photo_url}
        label={codeOf(first.driver)}
        colour={first.colour}
        className="absolute right-0 bottom-0 hidden h-[82%] w-auto max-w-[80%] !object-contain object-bottom text-4xl sm:block"
        style={NO_BACKDROP}
      />
      <div className="relative z-10 flex flex-col gap-4 bg-gradient-to-t from-bg/80 via-bg/30 to-transparent p-6 pt-24">
        <Link
          to={`/drivers/${first.driver.ref}`}
          className="display w-fit text-3xl leading-none hover:underline"
        >
          {first.driver.given_name}
          <br />
          {first.driver.family_name}
        </Link>
        <dl className="flex gap-6">
          {figures.map(([value, label]) => (
            <div key={label} className="flex flex-col">
              <dt className="order-3 text-xs font-semibold text-muted uppercase">{label}</dt>
              <dd className="num display order-2 text-3xl" style={{ color: readable(colour) }}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="glass rounded-xl px-4 py-3 text-sm">
          {summary && summary.kind !== "open" ? (
            <TitleSentence summary={summary} />
          ) : (
            second?.driver && (
              <p className="flex items-center gap-2">
                <TrendingUp aria-hidden="true" className="size-4 text-gain" />
                {t("dash.leadBy", {
                  points: f.number(lead, 0),
                  second: second.driver.family_name,
                })}
              </p>
            )
          )}
        </div>
      </div>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ widgets */

function DriverChip({ entry }: { entry: Schema<"ReportEntry"> }) {
  return (
    <Link
      to={`/drivers/${entry.driver.ref}`}
      className="mt-auto flex items-center gap-2 text-sm hover:underline"
    >
      <Face
        url={entry.driver.photo_url}
        label={codeOf(entry.driver)}
        colour={entry.team_colour}
        className="size-8 shrink-0 rounded-full text-[0.6rem]"
      />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-bold">{entry.driver.family_name}</span>
        <span
          className="block truncate text-xs font-semibold"
          style={{ color: readable(teamColour(entry.team_colour)) }}
        >
          {entry.team.name}
        </span>
      </span>
    </Link>
  );
}

function Widget({
  label,
  icon,
  children,
  solid = false,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  solid?: boolean;
}) {
  const id = `widget-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section
      aria-labelledby={id}
      className={`relative flex min-h-44 flex-col gap-3 overflow-hidden rounded-[20px] p-5 ${
        solid
          ? "bg-gradient-to-br from-[#7b2cf5] to-[#3b1a9e] text-white [&_.text-muted]:text-white/75 [&_[style]]:!text-white/80"
          : "glass"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-sm font-bold">
          {label}
        </h2>
        <IconBubble>{icon}</IconBubble>
      </div>
      {children}
    </section>
  );
}

const WIDGETS_GRID = "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4";

function Widgets({ report }: { report: Report }) {
  const { t, f } = useI18n();
  const stop = report.pit_stops?.fastest;
  const gain = report.biggest_gain;
  const lap = report.fastest_lap;
  const n = report.neutralisations;
  const counts = [
    ["SC", n?.safety_cars ?? 0],
    ["VSC", n?.virtual_safety_cars ?? 0],
    ["RED", n?.red_flags ?? 0],
  ] as const;
  return (
    <div className={WIDGETS_GRID}>
      {stop && (
        <Widget label={t("dash.fastestStop")} icon={<Wrench />} solid>
          <p className="num display text-6xl leading-none">
            {f.number(stop.duration_s, 2)}
            <span className="ml-1 text-2xl">s</span>
          </p>
          <DriverChip entry={stop.entry} />
        </Widget>
      )}
      {gain && (
        <Widget label={t("dash.climber")} icon={<TrendingUp />}>
          <p className="flex items-baseline gap-3">
            <span className="num display text-6xl leading-none text-gain">
              +{(gain.grid_position ?? 0) - (gain.finish_position ?? 0)}
            </span>
            <span className="num text-sm font-semibold text-muted">
              {t("dash.climb", {
                grid: gain.grid_position ?? "?",
                finish: gain.finish_position ?? "?",
              })}
            </span>
          </p>
          <DriverChip entry={gain} />
        </Widget>
      )}
      {lap && (
        <Widget label={t("dash.fastestLap")} icon={<Timer />}>
          <p className="num timing text-7xl leading-none font-light text-t-purple">
            {f.lapTime(lap.fastest_lap_s)}
          </p>
          <DriverChip entry={lap} />
        </Widget>
      )}
      <Widget label={t("dash.raceControl")} icon={<Siren />}>
        <div className="flex gap-2">
          {counts.map(([label, count]) => (
            <span
              key={label}
              className={`flex flex-1 flex-col items-center rounded-xl py-2 ${
                count > 0
                  ? label === "RED"
                    ? "bg-mark text-white"
                    : "bg-t-yellow text-tyre-ink"
                  : "bg-ink/5 text-muted"
              }`}
            >
              <span className="num display text-3xl leading-none">{count}</span>
              <span className="mt-1 text-[0.65rem] font-bold">{label}</span>
            </span>
          ))}
        </div>
        <p className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-muted">
          <FlagIcon aria-hidden="true" className="size-3.5" />
          {t("dash.leadChanges", { n: report.story?.lead_changes ?? 0 })}
        </p>
      </Widget>
    </div>
  );
}

/* ---------------------------------------------------------------- standings */

/** Places won (positive) or lost since the previous round. */
function lastMove(positions: readonly (number | null)[]): number {
  const known = positions.filter((p): p is number => p !== null);
  const now = known.at(-1);
  const before = known.at(-2);
  return now === undefined || before === undefined ? 0 : before - now;
}

function StandingsCards({ season }: { season: number }) {
  const { t } = useI18n();
  const standings = useStandings(season, null).data;
  const progression = useProgression(season).data;
  const driverMoves = new Map(
    (progression?.drivers ?? []).map((d) => [d.driver.ref, lastMove(d.positions)]),
  );
  const teamMoves = new Map(
    (progression?.constructors ?? []).map((c) => [c.team.ref, lastMove(c.positions)]),
  );
  return (
    <>
      <StandingsCard
        id="home-drivers"
        title={t("home.drivers", { season })}
        lines={standings?.drivers.slice(0, STANDINGS_ROWS) ?? []}
        moves={driverMoves}
        to={`/standings/${String(season)}`}
      />
      <StandingsCard
        id="home-teams"
        title={t("home.constructors", { season })}
        lines={standings?.constructors.slice(0, STANDINGS_ROWS) ?? []}
        moves={teamMoves}
        to={`/standings/${String(season)}?table=constructors`}
      />
    </>
  );
}

function StandingsCard({
  id,
  title,
  lines,
  moves,
  to,
}: {
  id: string;
  title: string;
  lines: readonly Line[];
  moves: Map<string, number>;
  to: string;
}) {
  const { t, f } = useI18n();
  const leader = lines[0];
  const isDrivers = Boolean(leader?.driver);
  return (
    <GlassCard
      id={id}
      title={title}
      glow={leader ? teamColour(leader.colour) : null}
      action={<MoreLink to={to}>{t("home.allStandings")}</MoreLink>}
    >
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">{t("col.position")}</th>
            <th scope="col">{isDrivers ? t("col.driver") : t("col.team")}</th>
            <th scope="col">{t("col.points")}</th>
            <th scope="col">{t("dash.evo")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const driver = line.driver;
            const ref = driver?.ref ?? line.team?.ref ?? String(index);
            const colour = teamColour(line.colour);
            return (
              <tr key={ref} className="group border-t border-line first:border-0">
                <td className="num w-12 py-3 pl-6 text-sm font-bold text-muted">
                  {line.position != null ? two(line.position) : line.position_text}
                </td>
                <td className="py-3">
                  <Link
                    to={driver ? `/drivers/${driver.ref}` : `/teams/${line.team?.ref ?? ""}`}
                    className="flex items-center gap-3"
                  >
                    {driver ? (
                      <Face
                        url={driver.photo_url}
                        label={codeOf(driver)}
                        colour={line.colour}
                        className="size-9 shrink-0 rounded-full text-[0.6rem]"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="h-8 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: colour }}
                      />
                    )}
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate font-bold group-hover:underline">
                        {driver ? driver.family_name : line.team?.name}
                      </span>
                      <span
                        className="block truncate text-xs font-semibold"
                        style={{ color: readable(colour) }}
                      >
                        {driver ? (line.team?.name ?? codeOf(driver)) : t("home.wins")}
                        {!driver && ` ${String(line.wins ?? 0)}`}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="py-3 text-right whitespace-nowrap">
                  <span className="num display block text-base leading-tight">
                    {f.number(line.points ?? 0, 0)}
                  </span>
                  <span className="block text-[0.65rem] font-bold text-muted">
                    {t("home.pts").toUpperCase()}
                  </span>
                </td>
                <td className="w-16 py-3 pr-6 text-right">
                  <Move value={moves.get(ref) ?? 0} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </GlassCard>
  );
}

/* -------------------------------------------------------------------- facts */

const TAG_COLOUR: Record<Tag, string> = {
  driver: "var(--color-t-blue)",
  team: "var(--color-t-green)",
  race: "var(--color-t-yellow)",
};

function FactsCard({ report }: { report: Report }) {
  const { t, f, locale } = useI18n();
  const facts = useFacts(report);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const shown = facts.filter((x) => filter === "all" || x.tag === filter).slice(0, FACTS_SHOWN);
  return (
    <GlassCard
      id="home-facts"
      title={t("dash.facts")}
      eyebrow={`${eventName(report.event.name, locale)} · ${f.date(report.event.race_date)}`}
    >
      <div className="px-6 pt-2 pb-4">
        <PillSwitch
          label={t("dash.facts")}
          value={filter}
          options={FILTERS.map((v) => [v, v === "all" ? t("dash.all") : t(`dash.tag.${v}`)])}
          onChange={setFilter}
        />
      </div>
      <ul className="flex flex-col gap-3 px-4 pb-4">
        {shown.map((fact) => (
          <li key={fact.key} className="flex flex-col gap-2 rounded-xl bg-ink/[0.04] p-4">
            <span className="flex w-fit items-center gap-1.5 text-[0.65rem] font-bold tracking-wider uppercase">
              <span
                aria-hidden="true"
                className="h-3 w-1 rounded-full"
                style={{ backgroundColor: TAG_COLOUR[fact.tag] }}
              />
              {t(`dash.tag.${fact.tag}`)}
            </span>
            <p className="leading-snug font-bold">{fact.title}</p>
            {fact.body && <p className="text-sm text-muted">{fact.body}</p>}
          </li>
        ))}
      </ul>
      <Link
        to={`/news/${String(report.session_id)}`}
        className="mt-auto flex items-center justify-center gap-2 border-t border-line py-4 text-sm font-bold hover:bg-ink/5"
      >
        {t("home.report")}
        <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
    </GlassCard>
  );
}

/* --------------------------------------------------------------------- news */

function NewsCard() {
  const { t, locale } = useI18n();
  const ago = useAgo();
  const headlines = useHeadlines(locale, 8).data ?? [];
  if (headlines.length === 0) return null;
  const [lead, ...rest] = headlines;
  return (
    <GlassCard
      id="home-news"
      title={t("news.latest")}
      className="xl:col-span-2"
      action={<MoreLink to="/news">{t("news.all")}</MoreLink>}
    >
      <div className="grid gap-4 p-4 pt-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {lead && (
          <a
            href={lead.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex min-h-80 flex-col justify-end self-stretch overflow-hidden rounded-2xl"
          >
            <HeadlineThumb headline={lead} className="absolute inset-0 size-full" eager />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"
            />
            <span className="relative flex flex-col gap-2 p-5 text-white">
              <span className="w-fit rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold backdrop-blur">
                {lead.source_name} · {ago(lead.published_at)}
              </span>
              <span className="display text-2xl leading-tight group-hover:underline">
                {lead.title}
                <span className="sr-only"> {t("news.opensNew")}</span>
              </span>
            </span>
          </a>
        )}
        <ul className="flex flex-col">
          {rest.slice(0, 5).map((h) => (
            <li key={h.url} className="border-t border-line first:border-0">
              <a
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 py-3"
              >
                <HeadlineThumb headline={h} className="h-16 w-24 shrink-0 rounded-xl" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="line-clamp-2 leading-snug font-bold group-hover:underline">
                    {h.title}
                    <span className="sr-only"> {t("news.opensNew")}</span>
                  </span>
                  <span className="text-xs font-medium text-muted">
                    {h.source_name} · {ago(h.published_at)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </GlassCard>
  );
}

/* -------------------------------------------------------------------- races */

function RacesCard({
  season,
  events,
  nextId,
}: {
  season: number;
  events: readonly Event[];
  nextId: number | null;
}) {
  const { t, locale } = useI18n();
  const upcoming = events.filter((e) => !e.winner);
  const past = events.filter((e) => e.winner).reverse();
  const [view, setView] = useState<"upcoming" | "past">(upcoming.length > 0 ? "upcoming" : "past");
  const shown = view === "upcoming" ? upcoming : past;
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const day = new Intl.DateTimeFormat(tag, { day: "2-digit", timeZone: "UTC" });
  const month = new Intl.DateTimeFormat(tag, { month: "short", timeZone: "UTC" });
  return (
    <GlassCard
      id="home-season"
      title={t("home.season", { season })}
      eyebrow={t("dash.seasonDone", { done: past.length, total: events.length })}
      action={<MoreLink to={`/calendar/${String(season)}`}>{t("home.calendar")}</MoreLink>}
    >
      <div className="px-6 pt-2 pb-3">
        <PillSwitch
          label={t("home.season", { season })}
          value={view}
          options={[
            ["upcoming", t("home.upcomingRaces")],
            ["past", t("home.pastRaces")],
          ]}
          onChange={setView}
        />
      </div>
      <ol className="flex max-h-[30rem] flex-col overflow-y-auto">
        {shown.map((event) => {
          const raceDay = new Date(`${event.race_date}T12:00:00Z`);
          const accent = circuitAccent(event.circuit.ref);
          const winner = event.winner;
          return (
            <li key={event.id} className="border-t border-line">
              <Link
                to={`/events/${String(event.id)}`}
                className={`flex items-center gap-4 px-6 py-3 hover:bg-ink/5 ${
                  event.id === nextId ? "bg-ink/[0.06]" : ""
                }`}
              >
                <span className="flex w-10 flex-col leading-none">
                  <span className="num text-xl font-bold">{day.format(raceDay)}</span>
                  <span className="text-xs font-semibold text-muted">{month.format(raceDay)}</span>
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate font-bold">{eventName(event.name, locale)}</span>
                  <span className="block truncate text-xs font-semibold text-muted">
                    R{event.round} ·{" "}
                    <span style={{ color: readable(accent) }}>{event.circuit.locality}</span>
                  </span>
                </span>
                {winner ? (
                  <Face
                    url={winner.driver.photo_url}
                    label={codeOf(winner.driver)}
                    colour={winner.team_colour}
                    className="size-9 shrink-0 rounded-full text-[0.55rem]"
                  />
                ) : (
                  event.circuit.outline && (
                    <CircuitMark
                      path={event.circuit.outline}
                      width={2}
                      stroke="var(--color-ink)"
                      className="size-9 shrink-0"
                    />
                  )
                )}
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
              </Link>
            </li>
          );
        })}
      </ol>
    </GlassCard>
  );
}

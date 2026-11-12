import type { Schema } from "@stintline/api-types";
import { ArrowRight, CalendarDays, Newspaper, Play, TrendingUp, Trophy } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { NO_BACKDROP } from "@/components/dash/backdrop";
import { Face } from "@/components/dash/Face";
import { Move } from "@/components/dash/Move";
import { Panel, Tile } from "@/components/dash/Panel";
import { CircuitMark } from "@/components/racing/CircuitMark";
import { Flag } from "@/components/racing/Flag";
import { initials } from "@/components/racing/initials";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import {
  ClimberTile,
  FactsPanel,
  FastestLapTile,
  FastestStopTile,
  RaceControlTile,
} from "@/features/hub/RaceFacts";
import { weekendDates } from "@/features/calendar/dates";
import { useHome, useProgression, useSeasonEvents, useStandings } from "@/features/hub/api";
import { useHeadlines, useReport } from "@/features/news/api";
import { useAgo } from "@/features/news/useAgo";
import { useSessionDetail } from "@/features/race/api";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { sessionLabel } from "@/lib/sessions";
import { inkOn, teamColour, teamTint } from "@/lib/teams";
import { timeLeft, useClock } from "@/lib/useClock";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

type Entry = Schema<"Entry">;
type Line = Schema<"StandingLine">;
type Headline = Schema<"Headline">;
type Event = Schema<"Event">;

/** Standings rows shown on the home page; the full tables are on the standings page. */
const STANDINGS_ROWS = 10;

/**
 * Home page as a dashboard: key figures of the weekend and the season in tiles, both
 * championships with their last move, the last race in facts, the news and the calendar.
 */
export function HomePage() {
  const { t } = useI18n();
  const home = useHome();
  useDocumentTitle(null);

  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;
  if (!home.data) return <Skeleton className="h-[70vh]" />;
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
  const report = useReport(last?.session_id ?? 0, last !== null).data ?? null;
  const detail = useSessionDetail(last?.session_id ?? 0, last !== null).data ?? null;
  const events = useSeasonEvents(season).data?.results ?? [];
  const entries = [...(detail?.entries ?? [])]
    .filter((e) => e.finish_position != null)
    .sort((a, b) => (a.finish_position ?? 99) - (b.finish_position ?? 99));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">{t("home.title")}</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {next && <CountdownTile event={next} />}
        {season !== null && <SeasonTile season={season} next={next} events={events} />}
        {last && entries[0] && <WinnerTile race={last} winner={entries[0]} second={entries[1]} />}
        {report?.pit_stops?.fastest && <FastestStopTile report={report} />}
        {home.drivers.length > 1 && <LeaderTile lines={home.drivers} />}
        {report?.biggest_gain && <ClimberTile entry={report.biggest_gain} />}
        {report?.fastest_lap && <FastestLapTile entry={report.fastest_lap} />}
        {report && <RaceControlTile report={report} />}
      </div>

      {last && <LastRaceBanner race={last} />}

      <div className="grid gap-4 xl:grid-cols-3">
        {season !== null && <StandingsPanels season={season} />}
        {report && <FactsPanel report={report} />}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <NewsPanel />
        {events.length > 0 && season !== null && (
          <CalendarPanel season={season} events={events} nextId={next?.id ?? null} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ shells */

function photoOf(entry: { driver: Schema<"Driver">; media?: Schema<"Media"> | null }) {
  return entry.media?.driver_image_url ?? entry.driver.photo_url;
}

function codeOf(driver: Schema<"Driver">): string {
  return driver.code ?? initials(driver.given_name, driver.family_name);
}

/* ------------------------------------------------------------------- tiles */

/** The next session, counted down on a race-red tile. */
function CountdownTile({ event }: { event: Event }) {
  const { t, locale } = useI18n();
  const now = useClock(1000);
  const session = event.sessions
    .filter((s) => s.scheduled_start && new Date(s.scheduled_start).getTime() > now)
    .sort((a, b) => (a.scheduled_start ?? "").localeCompare(b.scheduled_start ?? ""))[0];
  const target = session?.scheduled_start ?? `${event.race_date}T12:00:00Z`;
  const left = timeLeft(new Date(target).getTime(), now);
  const parts = [
    [left.days, t("countdown.days")],
    [left.hours, t("countdown.hours")],
    [left.minutes, t("countdown.minutes")],
    [left.seconds, t("countdown.seconds")],
  ] as const;
  return (
    <section
      aria-labelledby="home-countdown"
      className="relative flex min-h-36 flex-col justify-between gap-3 overflow-hidden rounded-xl bg-action p-5 text-white"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: "repeating-linear-gradient(120deg, #fff 0 2px, transparent 2px 18px)",
        }}
      />
      <h2 id="home-countdown" className="relative flex items-center gap-2 text-sm font-semibold">
        <span className="rounded border border-white/50 px-1.5 text-xs">R{event.round}</span>
        <span className="truncate">
          {eventName(event.name, locale)}
          {session ? ` · ${sessionLabel(session.kind, t)}` : ""}
        </span>
      </h2>
      <div
        role="timer"
        aria-label={t("countdown.label", {
          days: left.days,
          hours: left.hours,
          minutes: left.minutes,
        })}
        className="relative flex gap-5"
      >
        {parts.map(([value, unit]) => (
          <span key={unit} aria-hidden="true" className="flex flex-col items-center">
            <span className="num text-4xl leading-none font-semibold">
              {String(value).padStart(2, "0")}
            </span>
            <span className="mt-1 text-[0.65rem] font-semibold uppercase opacity-80">{unit}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

/** Where the season stands: next Grand Prix with its flag and circuit, rounds done. */
function SeasonTile({
  season,
  next,
  events,
}: {
  season: number;
  next: Event | null;
  events: readonly Event[];
}) {
  const { t, locale } = useI18n();
  const done = events.filter((e) => e.winner).length;
  const total = events.length;
  const share = total > 0 ? done / total : 0;
  return (
    <Tile label={t("dash.season", { season })} icon={<CalendarDays className="size-4" />}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {next && (
            <Link
              to={`/events/${String(next.id)}`}
              className="flex items-center gap-2 text-2xl font-extrabold hover:underline"
            >
              <Flag country={next.circuit.country} className="text-xl" />
              <span className="truncate">{next.circuit.locality}</span>
            </Link>
          )}
          <p className="mt-1 text-xs text-muted">{next ? weekendDates(next, locale) : ""}</p>
        </div>
        {next?.circuit.outline && (
          <CircuitMark path={next.circuit.outline} width={2.5} className="size-16 shrink-0" />
        )}
      </div>
      {total > 0 && (
        <div className="mt-auto flex items-center gap-3">
          <span aria-hidden="true" className="flex flex-1 gap-[3px]">
            {events.map((e) => (
              <span
                key={e.id}
                className={`h-2 flex-1 rounded-[1px] ${
                  e.winner ? "bg-gain" : e.id === next?.id ? "bg-mark" : "bg-raised"
                }`}
              />
            ))}
          </span>
          <span className="num text-xs whitespace-nowrap text-muted">
            {t("dash.seasonDone", { done, total })} · {Math.round(share * 100)}%
          </span>
        </div>
      )}
    </Tile>
  );
}

function WinnerTile({
  race,
  winner,
  second,
}: {
  race: Schema<"LastRace">;
  winner: Entry;
  second: Entry | undefined;
}) {
  const { t, locale } = useI18n();
  const margin =
    second?.race_time_s != null && winner.race_time_s != null
      ? `+${(second.race_time_s - winner.race_time_s).toFixed(3)} s`
      : null;
  return (
    <section
      aria-labelledby="home-winner"
      className="relative flex min-h-36 overflow-hidden rounded-xl border border-line p-5"
      style={{ backgroundColor: teamTint(winner.team_colour, 28) }}
    >
      <div className="relative z-10 flex max-w-[60%] min-w-0 flex-1 flex-col gap-1">
        <h2 id="home-winner" className="flex items-center gap-2 text-sm font-semibold">
          <Flag country={race.event.circuit.country} />
          {t("dash.winner")}
        </h2>
        <Link
          to={`/drivers/${winner.driver.ref}`}
          className="mt-1 text-2xl leading-tight font-extrabold hover:underline"
        >
          {winner.driver.given_name}
          <br />
          {winner.driver.family_name}
        </Link>
        <p className="text-sm text-muted">
          {eventName(race.event.name, locale)}
          {margin ? ` · ${margin}` : ""}
        </p>
      </div>
      <Face
        url={photoOf(winner)}
        label={codeOf(winner.driver)}
        colour={winner.team_colour}
        className="absolute -right-2 bottom-0 h-[125%] w-36"
        style={NO_BACKDROP}
      />
    </section>
  );
}

function LeaderTile({ lines }: { lines: readonly Line[] }) {
  const { t, f } = useI18n();
  const [first, second] = lines;
  if (!first?.driver) return null;
  const lead = (first.points ?? 0) - (second?.points ?? 0);
  return (
    <Tile label={t("dash.leader")} icon={<Trophy className="size-4" />}>
      <div className="flex items-center gap-3">
        <Face
          url={first.driver.photo_url}
          label={codeOf(first.driver)}
          colour={first.colour}
          className="size-14 shrink-0 rounded-full"
        />
        <div className="min-w-0">
          <Link
            to={`/drivers/${first.driver.ref}`}
            className="block truncate text-xl font-extrabold hover:underline"
          >
            {first.driver.family_name}
          </Link>
          <p className="num text-2xl font-semibold">
            {f.number(first.points ?? 0, 0)} <span className="text-sm text-muted">pts</span>
          </p>
        </div>
      </div>
      {second?.driver && (
        <p className="mt-auto flex items-center gap-1.5 text-xs text-muted">
          <TrendingUp aria-hidden="true" className="size-3.5 text-gain" />
          {t("dash.leadBy", { points: f.number(lead, 0), second: second.driver.family_name })}
        </p>
      )}
    </Tile>
  );
}

/* ----------------------------------------------------------- last race band */

function LastRaceBanner({ race }: { race: Schema<"LastRace"> }) {
  const { t, f, locale } = useI18n();
  return (
    <section
      aria-labelledby="home-last"
      className="relative overflow-hidden rounded-xl border border-line bg-panel"
    >
      {race.event.circuit.outline && (
        <CircuitMark
          path={race.event.circuit.outline}
          stroke="var(--color-line-strong)"
          width={10}
          className="pointer-events-none absolute top-1/2 left-[30%] hidden h-[150%] -translate-y-1/2 lg:block"
        />
      )}
      <div className="relative grid items-end gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-3 self-center">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Flag country={race.event.circuit.country} className="text-base" />
            <span className="font-semibold text-mark-text">{t("home.lastRace")}</span>
            <span>
              · {t("picker.round", { round: race.event.round })} · {f.date(race.event.race_date)}
            </span>
          </p>
          <h2 id="home-last" className="text-4xl leading-none font-extrabold sm:text-5xl">
            {eventName(race.event.name, locale)}
          </h2>
          <p className="text-muted">
            {race.event.circuit.name} · {countryName(race.event.circuit.country, locale)}
          </p>
          {race.podium[0] && (
            <p className="text-lg font-semibold">
              {t("home.winnerLine", {
                winner: `${race.podium[0].driver.given_name} ${race.podium[0].driver.family_name}`,
                team: race.podium[0].team.name,
              })}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-3">
            {race.has_data && (
              <Link
                to={`/sessions/${String(race.session_id)}`}
                className="inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2.5 font-semibold text-white hover:brightness-110"
              >
                <Play aria-hidden="true" className="size-4 fill-current" />
                {t("home.replay")}
              </Link>
            )}
            <Link
              to={`/events/${String(race.event.id)}`}
              className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-raised px-4 py-2.5 font-semibold hover:border-ink"
            >
              {t("home.results")}
            </Link>
            <Link
              to={`/news/${String(race.session_id)}`}
              className="inline-flex items-center gap-2 rounded-lg px-2 py-2.5 font-semibold hover:underline"
            >
              {t("home.report")}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
        <ol aria-label={t("home.podium")} className="grid grid-cols-3 items-end gap-3">
          {[1, 0, 2].map((index) => {
            const entry = race.podium[index];
            if (!entry) return <li key={index} />;
            const colour = teamColour(entry.team_colour);
            return (
              <li key={entry.car_number}>
                <Link
                  to={`/drivers/${entry.driver.ref}`}
                  className="group flex flex-col overflow-hidden rounded-lg"
                  style={{ backgroundColor: teamTint(entry.team_colour, 30) }}
                >
                  <Face
                    url={photoOf(entry)}
                    label={codeOf(entry.driver)}
                    colour={entry.team_colour}
                    className={`w-full text-3xl ${index === 0 ? "h-60" : "h-48"}`}
                    style={NO_BACKDROP}
                  />
                  <span
                    className="flex items-center gap-2 p-2.5"
                    style={{ backgroundColor: colour, color: inkOn(colour) }}
                  >
                    <span className="num text-xl leading-none font-bold">{index + 1}</span>
                    <span className="truncate font-extrabold uppercase group-hover:underline">
                      {entry.driver.family_name}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- standings */

/** Places won (positive) or lost since the previous round. */
function lastMove(positions: readonly (number | null)[]): number {
  const known = positions.filter((p): p is number => p !== null);
  const now = known.at(-1);
  const before = known.at(-2);
  return now === undefined || before === undefined ? 0 : before - now;
}

function StandingsPanels({ season }: { season: number }) {
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
      <StandingsTable
        id="home-drivers"
        title={t("home.drivers", { season })}
        lines={standings?.drivers.slice(0, STANDINGS_ROWS) ?? []}
        moves={driverMoves}
        to={`/standings/${String(season)}`}
      />
      <StandingsTable
        id="home-teams"
        title={t("home.constructors", { season })}
        lines={standings?.constructors.slice(0, STANDINGS_ROWS) ?? []}
        moves={teamMoves}
        to={`/standings/${String(season)}?table=constructors`}
      />
    </>
  );
}

function StandingsTable({
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
  const top = lines[0]?.points ?? 0;
  return (
    <Panel id={id} title={title} icon={<Trophy className="size-5" />}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted uppercase">
            <th scope="col" className="py-2.5 pl-5 text-left font-semibold">
              {t("col.position")}
            </th>
            <th scope="col" className="py-2.5 text-left font-semibold">
              {lines[0]?.driver ? t("col.driver") : t("col.team")}
            </th>
            <th scope="col" className="py-2.5 text-right font-semibold">
              {t("col.points")}
            </th>
            <th scope="col" className="py-2.5 pr-5 text-right font-semibold">
              {t("dash.evo")}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const driver = line.driver;
            const ref = driver?.ref ?? line.team?.ref ?? String(index);
            const points = line.points ?? 0;
            return (
              <tr key={ref} className="border-t border-line hover:bg-raised/60">
                <td className="num py-2 pl-5 font-semibold">{line.position_text}</td>
                <td className="py-2">
                  <Link
                    to={driver ? `/drivers/${driver.ref}` : `/teams/${line.team?.ref ?? ""}`}
                    className="flex items-center gap-2.5 hover:underline"
                  >
                    {driver ? (
                      <Face
                        url={driver.photo_url}
                        label={codeOf(driver)}
                        colour={line.colour}
                        className="size-8 shrink-0 rounded-full text-[0.6rem]"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="h-6 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: teamColour(line.colour) }}
                      />
                    )}
                    <span className="truncate font-semibold">
                      {driver ? driver.family_name : line.team?.name}
                    </span>
                    {driver && (
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: teamColour(line.colour) }}
                      />
                    )}
                  </Link>
                </td>
                <td className="num py-2 text-right whitespace-nowrap">
                  <span className="font-semibold">{f.number(points, 0)}</span>
                  {index > 0 && (
                    <span className="ml-2 text-xs text-muted">−{f.number(top - points, 0)}</span>
                  )}
                </td>
                <td className="py-2 pr-5 text-right">
                  <Move value={moves.get(ref) ?? 0} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Link
        to={to}
        className="mt-auto flex items-center justify-center gap-2 border-t border-line py-3 text-sm font-semibold hover:bg-raised"
      >
        {t("home.allStandings")}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </Panel>
  );
}

/* --------------------------------------------------------------------- news */

function NewsThumb({ headline, className }: { headline: Headline; className: string }) {
  const [failed, setFailed] = useState(false);
  if (headline.image_url && !failed) {
    return (
      <img
        src={headline.image_url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          setFailed(true);
        }}
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center bg-raised text-muted ${className}`}
    >
      <Newspaper className="size-6" />
    </span>
  );
}

function NewsPanel() {
  const { t, locale } = useI18n();
  const ago = useAgo();
  const headlines = useHeadlines(locale, 8).data ?? [];
  if (headlines.length === 0) return null;
  const [lead, ...rest] = headlines;
  return (
    <Panel
      id="home-news"
      title={t("news.latest")}
      icon={<Newspaper className="size-5" />}
      className="xl:col-span-2"
      action={
        <Link
          to="/news"
          className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
        >
          {t("news.all")}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      }
    >
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {lead && (
          <a
            href={lead.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col self-start overflow-hidden rounded-lg border border-line bg-raised/50"
          >
            <NewsThumb
              headline={lead}
              className={lead.image_url ? "aspect-[16/9] w-full" : "h-28 w-full"}
            />
            <span className="flex flex-col gap-1.5 p-4">
              <span className="text-xs font-bold text-mark-text uppercase">
                {lead.source_name} · {ago(lead.published_at)}
              </span>
              <span className="text-xl leading-snug font-bold group-hover:underline">
                {lead.title}
                <span className="sr-only"> {t("news.opensNew")}</span>
              </span>
            </span>
          </a>
        )}
        <ul className="flex flex-col divide-y divide-line">
          {rest.slice(0, 6).map((h) => (
            <li key={h.url}>
              <a
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3 py-2.5"
              >
                <NewsThumb headline={h} className="h-16 w-24 shrink-0 rounded-md" />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="line-clamp-2 leading-snug font-semibold group-hover:underline">
                    {h.title}
                    <span className="sr-only"> {t("news.opensNew")}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {h.source_name} · {ago(h.published_at)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/* ----------------------------------------------------------------- calendar */

function CalendarPanel({
  season,
  events,
  nextId,
}: {
  season: number;
  events: readonly Event[];
  nextId: number | null;
}) {
  const { t, locale } = useI18n();
  return (
    <Panel
      id="home-season"
      title={t("home.season", { season })}
      icon={<CalendarDays className="size-5" />}
      action={
        <Link
          to={`/calendar/${String(season)}`}
          className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
        >
          {t("home.calendar")}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      }
    >
      <ol className="flex max-h-[34rem] flex-col overflow-y-auto">
        {events.map((event) => {
          const winner = event.winner;
          const isNext = event.id === nextId;
          return (
            <li key={event.id} className="border-t border-line first:border-0">
              <Link
                to={`/events/${String(event.id)}`}
                className={`flex items-center gap-3 px-4 py-2.5 hover:bg-raised/60 ${
                  isNext ? "bg-mark/10" : ""
                }`}
              >
                <span className="num w-7 text-xs text-muted">R{event.round}</span>
                <Flag country={event.circuit.country} className="text-base" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {eventName(event.name, locale)}
                  </span>
                  <span className="block text-xs text-muted">{weekendDates(event, locale)}</span>
                </span>
                {winner ? (
                  <span className="flex items-center gap-2 text-xs">
                    <span className="hidden font-semibold sm:inline">
                      {winner.driver.code ?? winner.driver.family_name}
                    </span>
                    <Face
                      url={winner.driver.photo_url}
                      label={codeOf(winner.driver)}
                      colour={winner.team_colour}
                      className="size-7 rounded-full text-[0.55rem]"
                    />
                  </span>
                ) : (
                  event.circuit.outline && (
                    <CircuitMark
                      path={event.circuit.outline}
                      width={2}
                      stroke={isNext ? "var(--color-mark)" : "var(--color-muted)"}
                      className="size-7"
                    />
                  )
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

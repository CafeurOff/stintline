import type { Schema } from "@stintline/api-types";
import { Link } from "react-router";

import { Countdown } from "@/components/hub/Countdown";
import { SectionTitle } from "@/components/hub/SectionTitle";
import { CircuitMark } from "@/components/racing/CircuitMark";
import { DriverPhoto } from "@/components/racing/DriverPhoto";
import { initials } from "@/components/racing/initials";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { weekendDates } from "@/features/calendar/dates";
import { useHome, useSeasonEvents } from "@/features/hub/api";
import { useHeadlines, useReports } from "@/features/news/api";
import { HeadlineList, ReportCard } from "@/features/news/components/NewsParts";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { sessionLabel } from "@/lib/sessions";
import { teamColour, teamTint } from "@/lib/teams";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

type Entry = Schema<"Entry">;
type Line = Schema<"StandingLine">;

/** Landing page: the last race up front, then what comes next, the title fight and news. */
export function HomePage() {
  const { t } = useI18n();
  const home = useHome();
  useDocumentTitle(null);

  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;
  if (!home.data) return <Skeleton className="h-[70vh]" />;
  const { last_race: last, next_event: next, drivers, constructors, season } = home.data;
  if (!last && !next) {
    return (
      <EmptyState title={t("home.empty.title")}>
        <p>{t("home.empty.body")}</p>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <h1 className="sr-only">{t("home.title")}</h1>
      {last && <LastRaceHero race={last} />}
      <div className="grid gap-6 lg:grid-cols-3">
        {next && <NextEvent event={next} />}
        {season !== null && drivers.length > 0 && (
          <Championship
            id="home-drivers"
            title={t("home.drivers", { season })}
            lines={drivers}
            to={`/standings/${String(season)}`}
          />
        )}
        {season !== null && constructors.length > 0 && (
          <Championship
            id="home-teams"
            title={t("home.constructors", { season })}
            lines={constructors}
            to={`/standings/${String(season)}?table=constructors`}
          />
        )}
      </div>
      <LatestNews />
      {season !== null && <SeasonStrip season={season} />}
    </div>
  );
}

function gapOf(entry: Entry, winner: Entry | undefined): string | null {
  if (!winner || entry === winner || entry.race_time_s == null || winner.race_time_s == null) {
    return null;
  }
  return `+${(entry.race_time_s - winner.race_time_s).toFixed(3)} s`;
}

/** The last Grand Prix, broadcast style: who won, the podium in photos, the circuit. */
function LastRaceHero({ race }: { race: Schema<"LastRace"> }) {
  const { t, f, locale } = useI18n();
  const name = eventName(race.event.name, locale);
  const winner = race.podium[0];
  const colour = winner?.team_colour;
  return (
    <section
      aria-labelledby="home-last"
      className="relative -mx-4 overflow-hidden border-t-4 sm:mx-0 sm:rounded-3xl"
      style={{ borderTopColor: teamColour(colour), backgroundColor: teamTint(colour, 22) }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 14px)",
        }}
      />
      {race.event.circuit.outline && (
        <CircuitMark
          path={race.event.circuit.outline}
          stroke={teamColour(colour)}
          width={6}
          className="pointer-events-none absolute -right-10 -bottom-16 size-[28rem] opacity-25 lg:right-[38%] lg:-bottom-24"
        />
      )}
      <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-end">
        <div className="flex flex-col gap-4">
          <p className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-widest uppercase">
            <span className="rounded-sm bg-mark px-2 py-0.5 text-white">{t("home.lastRace")}</span>
            <span className="text-muted">
              {t("picker.round", { round: race.event.round })} · {f.date(race.event.race_date)}
            </span>
          </p>
          <h2 id="home-last" className="text-4xl leading-[0.95] font-black uppercase sm:text-6xl">
            {name}
          </h2>
          {winner && (
            <p className="max-w-md text-lg text-muted">
              {t("home.winnerLine", {
                winner: `${winner.driver.given_name} ${winner.driver.family_name}`,
                team: winner.team.name,
              })}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-3">
            {race.has_data && (
              <Link
                to={`/sessions/${race.session_id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-action px-5 py-3 font-bold text-white hover:brightness-110"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
                  <path d="M7 4l13 8-13 8z" />
                </svg>
                {t("home.replay")}
              </Link>
            )}
            <Link
              to={`/events/${race.event.id}`}
              className="rounded-lg border border-line-strong bg-bg/40 px-5 py-3 font-bold backdrop-blur hover:border-ink"
            >
              {t("home.results")}
            </Link>
            <Link
              to={`/news/${race.session_id}`}
              className="rounded-lg px-3 py-3 font-bold text-mark-text hover:underline"
            >
              {t("home.report")} →
            </Link>
          </div>
        </div>
        <ol aria-label={t("home.podium")} className="grid grid-cols-3 items-end gap-3">
          {[1, 0, 2].map((index) => {
            const entry = race.podium[index];
            if (!entry) return <li key={index} />;
            return (
              <PodiumCard
                key={entry.car_number}
                entry={entry}
                place={index + 1}
                gap={gapOf(entry, winner)}
              />
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function PodiumCard({ entry, place, gap }: { entry: Entry; place: number; gap: string | null }) {
  const { f } = useI18n();
  const colour = teamColour(entry.team_colour);
  const photo = entry.media?.driver_image_url ?? entry.driver.photo_url;
  return (
    <li className={place === 1 ? "" : "pt-10"}>
      <Link
        to={`/drivers/${entry.driver.ref}`}
        className="group block overflow-hidden rounded-2xl bg-bg/50 backdrop-blur transition hover:-translate-y-1"
      >
        <span className="relative block">
          <DriverPhoto
            imageUrl={photo}
            label={entry.driver.code ?? initials(entry.driver.given_name, entry.driver.family_name)}
            colour={entry.team_colour}
            className={`w-full ${place === 1 ? "h-56 sm:h-72" : "h-44 sm:h-56"}`}
          />
          <span
            className="absolute top-2 left-2 grid size-9 place-items-center rounded-md text-lg font-black text-white"
            style={{ backgroundColor: colour }}
          >
            {place}
          </span>
        </span>
        <span className="block border-t-4 p-3" style={{ borderTopColor: colour }}>
          <span className="block text-xs text-muted">{entry.driver.given_name}</span>
          <span className="block truncate text-sm leading-tight font-black uppercase group-hover:underline sm:text-lg">
            {entry.driver.family_name}
          </span>
          <span className="block truncate text-xs text-muted">
            {gap ?? (entry.race_time_s != null ? f.lapTime(entry.race_time_s) : entry.team.name)}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** The next Grand Prix: countdown to lights out and the weekend in the visitor's time. */
function NextEvent({ event }: { event: Schema<"Event"> }) {
  const { t, locale } = useI18n();
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const race = event.sessions.find((s) => s.kind === "R");
  const target = race?.scheduled_start ?? `${event.race_date}T12:00:00Z`;
  const day = new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric" });
  const time = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit" });
  const sessions = event.sessions.filter((s) => s.scheduled_start);
  return (
    <section
      aria-labelledby="home-next"
      className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border-t-4 border-mark bg-panel p-5"
    >
      {event.circuit.outline && (
        <CircuitMark
          path={event.circuit.outline}
          stroke="var(--color-ink)"
          width={4}
          className="pointer-events-none absolute top-4 right-4 size-28 opacity-25"
        />
      )}
      <div className="relative">
        <p className="text-xs font-bold tracking-widest text-mark-text uppercase">
          {t("home.nextRace")} · {weekendDates(event, locale)}
        </p>
        <h2 id="home-next" className="mt-1 max-w-[75%] text-2xl leading-tight font-black uppercase">
          <Link to={`/events/${event.id}`} className="hover:underline">
            {eventName(event.name, locale)}
          </Link>
        </h2>
        <p className="text-sm text-muted">
          {event.circuit.locality} · {countryName(event.circuit.country, locale)}
        </p>
      </div>
      <Countdown target={target} />
      {sessions.length > 0 && (
        <ul aria-label={t("home.schedule")} className="flex flex-col text-sm">
          {sessions.map((s) => (
            <li
              key={s.id}
              className={`flex items-center justify-between border-b border-line py-1.5 last:border-0 ${
                s.kind === "R" ? "font-bold" : ""
              }`}
            >
              <span>{sessionLabel(s.kind, t)}</span>
              <span className="text-muted tabular-nums first-letter:uppercase">
                {day.format(new Date(s.scheduled_start ?? ""))} ·{" "}
                {time.format(new Date(s.scheduled_start ?? ""))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">{t("home.localTime")}</p>
    </section>
  );
}

/** Top of a championship: photo (drivers) or colour (teams), points and a bar to the leader. */
function Championship({
  id,
  title,
  lines,
  to,
}: {
  id: string;
  title: string;
  lines: readonly Line[];
  to: string;
}) {
  const { t, f } = useI18n();
  const top = lines[0]?.points ?? 0;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-2xl bg-panel p-5">
      <SectionTitle id={id} to={to} linkLabel={t("home.allStandings")}>
        {title}
      </SectionTitle>
      <ol className="flex flex-col gap-1">
        {lines.map((line, index) => {
          const colour = teamColour(line.colour);
          const share = top > 0 ? ((line.points ?? 0) / top) * 100 : 0;
          const driver = line.driver;
          const name = driver ? driver.family_name : (line.team?.name ?? "");
          const href = driver ? `/drivers/${driver.ref}` : `/teams/${line.team?.ref ?? ""}`;
          return (
            <li key={driver?.ref ?? line.team?.ref ?? index}>
              <Link
                to={href}
                className="group flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-raised"
              >
                <span className="w-5 text-center font-black text-muted tabular-nums">
                  {line.position_text}
                </span>
                {driver ? (
                  <DriverPhoto
                    imageUrl={driver.photo_url}
                    label={driver.code ?? initials(driver.given_name, driver.family_name)}
                    colour={line.colour}
                    className="size-10 shrink-0 rounded-full bg-raised text-xs"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-8 w-1.5 shrink-0 -skew-x-[16deg] rounded-sm"
                    style={{ backgroundColor: colour }}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-bold group-hover:underline">
                      {driver && (
                        <span className="font-normal text-muted">{driver.given_name} </span>
                      )}
                      {name}
                    </span>
                    <span className="font-black tabular-nums">{f.number(line.points ?? 0, 0)}</span>
                  </span>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-raised">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${String(share)}%`, backgroundColor: colour }}
                    />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The latest race report and a few headlines in the page language. */
function LatestNews() {
  const { t, locale } = useI18n();
  const reports = useReports(3);
  const headlines = useHeadlines(locale, 6);
  const [report, ...older] = reports.data ?? [];
  const items = headlines.data ?? [];
  if (!report && items.length === 0) return null;
  return (
    <section aria-labelledby="home-news" className="flex flex-col gap-4">
      <SectionTitle id="home-news" to="/news" linkLabel={t("news.all")}>
        {t("news.latest")}
      </SectionTitle>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {report && (
          <div className="flex flex-col gap-4">
            <ReportCard report={report} lead />
            {older.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {older.map((item) => (
                  <ReportCard key={item.session_id} report={item} />
                ))}
              </div>
            )}
          </div>
        )}
        {items.length > 0 && <HeadlineList headlines={items} />}
      </div>
    </section>
  );
}

/** Every round of the season in a row: circuit, winner, and where the season stands. */
function SeasonStrip({ season }: { season: number }) {
  const { t, locale } = useI18n();
  const events = useSeasonEvents(season).data?.results ?? [];
  if (events.length === 0) return null;
  return (
    <section aria-labelledby="home-season" className="flex flex-col gap-4">
      <SectionTitle
        id="home-season"
        to={`/calendar/${String(season)}`}
        linkLabel={t("home.calendar")}
      >
        {t("home.season", { season })}
      </SectionTitle>
      <ol className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {events.map((event) => {
          const winner = event.winner;
          const colour = winner ? teamColour(winner.team_colour) : "var(--color-line-strong)";
          return (
            <li key={event.id} className="w-36 shrink-0 snap-start">
              <Link
                to={`/events/${String(event.id)}`}
                className="group flex h-full flex-col gap-2 rounded-xl border-t-4 bg-panel p-3 hover:bg-raised"
                style={{ borderTopColor: colour }}
              >
                <span className="text-[0.65rem] font-bold tracking-widest text-muted uppercase">
                  {t("picker.round", { round: event.round })}
                </span>
                {event.circuit.outline ? (
                  <CircuitMark
                    path={event.circuit.outline}
                    stroke={winner ? colour : "var(--color-muted)"}
                    width={3}
                    className="h-16 w-full"
                  />
                ) : (
                  <span className="h-16" />
                )}
                <span className="truncate text-sm font-bold group-hover:underline">
                  {event.circuit.locality}
                </span>
                <span className="truncate text-xs text-muted">
                  {winner ? winner.driver.family_name : weekendDates(event, locale)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

import type { Schema } from "@stintline/api-types";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { CircuitMark } from "@/components/racing/CircuitMark";
import { DriverPhoto } from "@/components/racing/DriverPhoto";
import { initials } from "@/components/racing/initials";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { weekendDates } from "@/features/calendar/dates";
import { useHome, useSeasonEvents } from "@/features/hub/api";
import { useHeadlines, useReports } from "@/features/news/api";
import { useAgo } from "@/features/news/useAgo";
import { writeReport } from "@/features/news/write";
import { useSessionDetail, useStints } from "@/features/race/api";
import { compoundInfo } from "@/lib/compounds";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { sessionLabel } from "@/lib/sessions";
import { inkOn, teamColour } from "@/lib/teams";
import { timeLeft, useClock } from "@/lib/useClock";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

type Entry = Schema<"Entry">;
type Line = Schema<"StandingLine">;
type EntryStints = Schema<"EntryStints">;

/** Rows of the last race shown on the home page; the full table is on the Grand Prix page. */
const CLASSIFICATION_ROWS = 10;
/** A stint narrower than this share of the race shows its colour without the letter. */
const STINT_LETTER_MIN_SHARE = 0.07;

/**
 * Landing page, "pit wall" design (docs/design.md): the last race as a timing sheet, what
 * comes next, both championships, the news wire and the season as a ruler.
 */
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
    <div className="flex flex-col gap-14">
      <h1 className="sr-only">{t("home.title")}</h1>
      <div className="grid gap-x-10 gap-y-12 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-10">{last && <LastRace race={last} />}</div>
        <div className="flex min-w-0 flex-col gap-10">{next && <NextEvent event={next} />}</div>
      </div>
      {season !== null && (drivers.length > 0 || constructors.length > 0) && (
        <div className="grid gap-x-10 gap-y-12 md:grid-cols-2">
          {drivers.length > 0 && (
            <Championship
              id="home-drivers"
              title={t("home.drivers", { season })}
              lines={drivers}
              to={`/standings/${String(season)}`}
            />
          )}
          {constructors.length > 0 && (
            <Championship
              id="home-teams"
              title={t("home.constructors", { season })}
              lines={constructors}
              to={`/standings/${String(season)}?table=constructors`}
            />
          )}
        </div>
      )}
      <LatestNews />
      {season !== null && <SeasonRuler season={season} nextId={next?.id ?? null} />}
    </div>
  );
}

/** Section heading: plain weight and size, a hairline under it and an optional link. */
function Heading({
  id,
  children,
  to,
  linkLabel,
}: {
  id: string;
  children: ReactNode;
  to?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line-strong pb-2">
      <h2 id={id} className="text-lg font-bold">
        {children}
      </h2>
      {to && linkLabel && (
        <Link to={to} className="text-sm text-muted hover:text-ink hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

/** Position in a pit-board box: team colour fill, chamfered corner, mono digits. */
function PositionBox({ position, colour }: { position: string; colour?: string | null }) {
  const fill = colour ? teamColour(colour) : "var(--color-raised)";
  return (
    <span
      className="chamfer num inline-grid h-6 w-7 shrink-0 place-items-center text-sm font-semibold [--cut:5px]"
      style={{ backgroundColor: fill, color: colour ? inkOn(fill) : "var(--color-ink)" }}
    >
      {position}
    </span>
  );
}

function photoOf(entry: Entry): string | null {
  return entry.media?.driver_image_url ?? entry.driver.photo_url;
}

/** Gap to the winner as a timing sheet writes it: time, laps down or the retirement. */
function useGap() {
  const { t, f } = useI18n();
  return (entry: Entry, winner: Entry | undefined): string => {
    if (!winner || entry === winner) return f.lapTime(entry.race_time_s);
    const classified = /^\d+$/.test(entry.classification ?? "");
    if (!classified) return entry.status ?? entry.classification ?? "—";
    const down = (winner.laps_completed ?? 0) - (entry.laps_completed ?? 0);
    if (down > 0) return t("home.lapsDown", { laps: down });
    if (entry.race_time_s == null || winner.race_time_s == null) return "—";
    return `+${(entry.race_time_s - winner.race_time_s).toFixed(3)}`;
  };
}

/** The last Grand Prix: title, key numbers, podium in official photos, then the classification. */
function LastRace({ race }: { race: Schema<"LastRace"> }) {
  const { t, f, locale } = useI18n();
  const name = eventName(race.event.name, locale);
  const detail = useSessionDetail(race.session_id);
  const winner = race.podium[0];
  const second = race.podium[1];
  const entries = detail.data?.entries ?? [];
  const fastest = entries.find((e) => e.fastest_lap_rank === 1);
  const laps = detail.data?.total_laps ?? winner?.laps_completed ?? null;
  const gap = useGap();

  return (
    <section aria-labelledby="home-last" className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] lg:items-end">
        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-sm text-muted">
            <span className="font-semibold text-mark-text">{t("home.lastRace")}</span>
            {" · "}
            {t("picker.round", { round: race.event.round })} · {f.date(race.event.race_date)} ·{" "}
            {race.event.circuit.locality}, {countryName(race.event.circuit.country, locale)}
          </p>
          <h2
            id="home-last"
            className="condensed text-5xl leading-[0.9] font-extrabold uppercase sm:text-7xl"
          >
            {name}
          </h2>
          {winner && (
            <p className="text-lg">
              {t("home.winnerLine", {
                winner: `${winner.driver.given_name} ${winner.driver.family_name}`,
                team: winner.team.name,
              })}
            </p>
          )}
          <dl className="mt-2 grid grid-cols-2 border-t border-line">
            <Figure label={t("home.stat.time")} value={f.lapTime(winner?.race_time_s)} />
            <Figure
              label={t("home.stat.margin")}
              value={winner && second ? gap(second, winner) : "—"}
            />
            <Figure
              label={t("home.stat.fastest")}
              value={fastest ? f.lapTime(fastest.fastest_lap_s) : "—"}
              note={fastest?.driver.code ?? fastest?.driver.family_name}
            />
            <Figure label={t("home.stat.laps")} value={laps === null ? "—" : String(laps)} />
          </dl>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {race.has_data && (
              <Link
                to={`/sessions/${String(race.session_id)}`}
                className="chamfer inline-flex h-11 items-center gap-2 bg-action px-5 font-semibold text-white [--cut:10px] hover:brightness-110"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
                  <path d="M7 4l13 8-13 8z" />
                </svg>
                {t("home.replay")}
              </Link>
            )}
            <Link to={`/events/${String(race.event.id)}`} className="font-semibold hover:underline">
              {t("home.results")}
            </Link>
            <Link to={`/news/${String(race.session_id)}`} className="font-semibold hover:underline">
              {t("home.report")}
            </Link>
          </div>
        </div>
        <ol aria-label={t("home.podium")} className="grid grid-cols-3 items-end gap-px bg-line">
          {[1, 0, 2].map((index) => {
            const entry = race.podium[index];
            if (!entry) return <li key={index} className="bg-bg" />;
            return (
              <Podium
                key={entry.car_number}
                entry={entry}
                place={index + 1}
                detail={index === 0 ? f.lapTime(entry.race_time_s) : gap(entry, winner)}
              />
            );
          })}
        </ol>
      </div>
      <Classification sessionId={race.session_id} hasTiming={race.has_data} />
    </section>
  );
}

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-3 pr-4 even:border-l even:pl-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num text-xl font-medium">
        {value}
        {note && <span className="ml-2 text-sm text-muted">{note}</span>}
      </dd>
    </div>
  );
}

function Podium({ entry, place, detail }: { entry: Entry; place: number; detail: string }) {
  const colour = teamColour(entry.team_colour);
  return (
    <li className="h-full bg-bg">
      <Link to={`/drivers/${entry.driver.ref}`} className="group flex h-full flex-col justify-end">
        <DriverPhoto
          imageUrl={photoOf(entry)}
          label={entry.driver.code ?? initials(entry.driver.given_name, entry.driver.family_name)}
          colour={entry.team_colour}
          className={`w-full bg-panel ${place === 1 ? "h-60" : "h-48"}`}
        />
        <span className="block border-t-[3px] pt-2" style={{ borderTopColor: colour }}>
          <span className="flex items-center gap-2">
            <PositionBox position={String(place)} />
            <span className="condensed truncate text-lg leading-none font-bold uppercase group-hover:underline">
              {entry.driver.family_name}
            </span>
          </span>
          <span className="num mt-1 block truncate text-xs text-muted">{detail}</span>
        </span>
      </Link>
    </li>
  );
}

/** The top of the race as a timing sheet, with each driver's tyre strategy across the race. */
function Classification({ sessionId, hasTiming }: { sessionId: number; hasTiming: boolean }) {
  const { t } = useI18n();
  const detail = useSessionDetail(sessionId);
  const stints = useStints(sessionId, hasTiming);
  const gap = useGap();
  if (detail.isPending) return <Skeleton className="h-80" />;
  if (detail.isError) return null;
  const entries = [...detail.data.entries]
    .filter((e) => e.finish_position != null)
    .sort((a, b) => (a.finish_position ?? 99) - (b.finish_position ?? 99))
    .slice(0, CLASSIFICATION_ROWS);
  const winner = entries[0];
  const byCar = new Map((stints.data ?? []).map((s) => [s.car_number, s]));
  const totalLaps =
    detail.data.total_laps ??
    Math.max(1, ...[...byCar.values()].flatMap((s) => s.stints.map((x) => x.lap_end ?? 0)));
  const showStrategy = byCar.size > 0;

  return (
    <section aria-labelledby="home-classification" className="flex flex-col gap-3">
      <Heading
        id="home-classification"
        to={`/events/${String(detail.data.event.id)}`}
        linkLabel={t("home.fullClassification")}
      >
        {t("home.classification")}
      </Heading>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="w-10 py-2 font-medium">
                {t("col.position")}
              </th>
              <th scope="col" className="py-2 font-medium">
                {t("col.driver")}
              </th>
              <th scope="col" className="hidden py-2 font-medium md:table-cell">
                {t("col.team")}
              </th>
              <th scope="col" className="py-2 pr-6 text-right font-medium">
                {t("home.gapLeader")}
              </th>
              {showStrategy && (
                <th scope="col" className="w-[38%] py-2 font-medium">
                  {t("home.strategy")}
                </th>
              )}
              <th scope="col" className="py-2 pl-4 text-right font-medium">
                {t("col.points")}
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const colour = teamColour(entry.team_colour);
              const stint = byCar.get(entry.car_number);
              return (
                <tr key={entry.car_number} className="border-t border-line hover:bg-panel">
                  <td className="py-2">
                    <PositionBox position={entry.classification ?? "—"} />
                  </td>
                  <td className="py-2">
                    <Link
                      to={`/drivers/${entry.driver.ref}`}
                      className="flex items-center gap-2.5 hover:underline"
                    >
                      <span
                        aria-hidden="true"
                        className="h-4 w-[3px] shrink-0"
                        style={{ backgroundColor: colour }}
                      />
                      <span className="num w-8 text-muted">{entry.car_number}</span>
                      <span className="whitespace-nowrap">
                        <span className="text-muted">{entry.driver.given_name} </span>
                        <span className="font-semibold">{entry.driver.family_name}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden py-2 whitespace-nowrap text-muted md:table-cell">
                    {entry.team.name}
                  </td>
                  <td className="num py-2 pr-6 text-right">{gap(entry, winner)}</td>
                  {showStrategy && (
                    <td className="py-2">
                      {stint ? <StrategyStrip stint={stint} totalLaps={totalLaps} /> : null}
                    </td>
                  )}
                  <td className="num py-2 pl-4 text-right font-medium">
                    {entry.points ? String(entry.points) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Stints laid along the race distance: compound colour, letter when it fits, stops as gaps. */
function StrategyStrip({ stint, totalLaps }: { stint: EntryStints; totalLaps: number }) {
  const { t } = useI18n();
  const parts = stint.stints.filter((s) => s.lap_start != null && s.lap_end != null);
  const label = parts
    .map(
      (s) =>
        `${t(`compound.${compoundInfo(s.compound).key}`)} ${String(s.lap_start)}–${String(s.lap_end)}`,
    )
    .join(", ");
  return (
    <span role="img" aria-label={label} className="relative block h-4 w-full bg-raised">
      {parts.map((s) => {
        const info = compoundInfo(s.compound);
        const start = ((s.lap_start ?? 1) - 1) / totalLaps;
        const share = ((s.lap_end ?? 0) - (s.lap_start ?? 1) + 1) / totalLaps;
        return (
          <span
            key={s.stint_number}
            className="absolute inset-y-0 grid place-items-center border-r-2 border-bg text-[0.65rem] font-semibold text-tyre-ink"
            style={{
              left: `${String(start * 100)}%`,
              width: `${String(share * 100)}%`,
              backgroundColor: info.fill,
            }}
          >
            {share >= STINT_LETTER_MIN_SHARE ? info.letter : ""}
          </span>
        );
      })}
    </span>
  );
}

/** The next Grand Prix: the circuit, one countdown and the weekend in the visitor's time. */
function NextEvent({ event }: { event: Schema<"Event"> }) {
  const { t, locale } = useI18n();
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const race = event.sessions.find((s) => s.kind === "R");
  const target = race?.scheduled_start ?? `${event.race_date}T12:00:00Z`;
  const day = new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric", month: "short" });
  const time = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit" });
  const sessions = event.sessions.filter((s) => s.scheduled_start);
  return (
    <section aria-labelledby="home-next" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between border-b border-line-strong pb-2">
        <span className="text-lg font-bold">{t("home.nextRace")}</span>
        <span className="text-sm text-muted">{weekendDates(event, locale)}</span>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="home-next" className="condensed text-3xl leading-none font-extrabold uppercase">
            <Link to={`/events/${String(event.id)}`} className="hover:underline">
              {eventName(event.name, locale)}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-muted">
            {event.circuit.name} · {countryName(event.circuit.country, locale)}
          </p>
        </div>
        {event.circuit.outline && (
          <CircuitMark path={event.circuit.outline} width={2.5} className="size-24 shrink-0" />
        )}
      </div>
      <RaceCountdown target={target} />
      {sessions.length > 0 && (
        <ul aria-label={t("home.schedule")} className="flex flex-col text-sm">
          {sessions.map((s) => (
            <li
              key={s.id}
              className={`grid grid-cols-[1fr_auto_auto] gap-4 border-t border-line py-2 ${
                s.kind === "R" ? "font-semibold" : ""
              }`}
            >
              <span>{sessionLabel(s.kind, t)}</span>
              <span className="text-muted first-letter:uppercase">
                {day.format(new Date(s.scheduled_start ?? ""))}
              </span>
              <span className="num">{time.format(new Date(s.scheduled_start ?? ""))}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">{t("home.localTime")}</p>
    </section>
  );
}

/** One line of mono digits, like the clock of a timing screen. */
function RaceCountdown({ target }: { target: string }) {
  const { t } = useI18n();
  const now = useClock(1000);
  const left = timeLeft(new Date(target).getTime(), now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div
      role="timer"
      aria-label={t("countdown.label", {
        days: left.days,
        hours: left.hours,
        minutes: left.minutes,
      })}
      className="flex items-baseline gap-3 border-y border-line py-3"
    >
      <span aria-hidden="true" className="num text-4xl font-medium">
        {left.days}
        <span className="text-xl text-muted">
          {t("countdown.days").charAt(0).toLowerCase()}
        </span>{" "}
        {pad(left.hours)}:{pad(left.minutes)}:{pad(left.seconds)}
      </span>
    </div>
  );
}

/** A championship as a short standings table: points, gap to the leader and a scaled bar. */
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
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <Heading id={id} to={to} linkLabel={t("home.allStandings")}>
        {title}
      </Heading>
      <ol className="flex flex-col">
        {lines.map((line, index) => {
          const colour = teamColour(line.colour);
          const points = line.points ?? 0;
          const share = top > 0 ? (points / top) * 100 : 0;
          const driver = line.driver;
          const href = driver ? `/drivers/${driver.ref}` : `/teams/${line.team?.ref ?? ""}`;
          return (
            <li key={driver?.ref ?? line.team?.ref ?? index} className="border-b border-line">
              <Link
                to={href}
                className="group grid grid-cols-[2rem_minmax(0,1fr)_4rem_3.5rem] items-center gap-3 py-2 hover:bg-panel"
              >
                <span className="num text-muted">{line.position_text}</span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate group-hover:underline">
                    {driver ? (
                      <>
                        <span className="text-muted">{driver.given_name} </span>
                        <span className="font-semibold">{driver.family_name}</span>
                      </>
                    ) : (
                      <span className="font-semibold">{line.team?.name}</span>
                    )}
                  </span>
                  <span aria-hidden="true" className="block h-[3px] bg-raised">
                    <span
                      className="block h-full"
                      style={{ width: `${String(share)}%`, backgroundColor: colour }}
                    />
                  </span>
                </span>
                <span className="num text-right font-semibold">{f.number(points, 0)}</span>
                <span className="num text-right text-xs text-muted">
                  {index === 0 ? "" : `−${f.number(top - points, 0)}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Our latest race reports next to the publishers' headlines (title and link only). */
function LatestNews() {
  const { t, f, locale } = useI18n();
  const reports = useReports(4);
  const headlines = useHeadlines(locale, 8);
  const ago = useAgo();
  const items = reports.data ?? [];
  const wire = headlines.data ?? [];
  if (items.length === 0 && wire.length === 0) return null;
  return (
    <section aria-labelledby="home-news" className="flex flex-col gap-4">
      <Heading id="home-news" to="/news" linkLabel={t("news.all")}>
        {t("news.latest")}
      </Heading>
      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {items.length > 0 && (
          <div className="flex flex-col">
            <h3 className="pb-1 text-sm text-muted">{t("home.reports")}</h3>
            <ul className="flex flex-col">
              {items.map((report, index) => {
                const written = writeReport(report, t, f, locale);
                const colour = teamColour(report.winner.team_colour);
                return (
                  <li key={report.session_id} className="flex gap-3 border-t border-line py-3">
                    <span
                      aria-hidden="true"
                      className="mt-1 h-4 w-[3px] shrink-0"
                      style={{ backgroundColor: colour }}
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-xs text-muted">
                        {report.kind === "SPRINT" ? t("news.sprint") : t("news.race")} ·{" "}
                        {f.date(report.event.race_date)}
                      </span>
                      <Link
                        to={`/news/${String(report.session_id)}`}
                        className={`leading-snug font-semibold hover:underline ${
                          index === 0 ? "text-xl" : ""
                        }`}
                      >
                        {written.title}
                      </Link>
                      {index === 0 && <span className="text-muted">{written.lede}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {wire.length > 0 && (
          <div className="flex flex-col">
            <h3 className="pb-1 text-sm text-muted">{t("home.wire")}</h3>
            <ul className="flex flex-col">
              {wire.map((headline) => (
                <li
                  key={headline.url}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border-t border-line py-2.5"
                >
                  <time dateTime={headline.published_at} className="num pt-0.5 text-xs text-muted">
                    {ago(headline.published_at)}
                  </time>
                  <span className="flex min-w-0 flex-col">
                    <a
                      href={headline.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="leading-snug hover:underline"
                    >
                      {headline.title}
                      <span className="sr-only"> {t("news.opensNew")}</span>
                    </a>
                    <span className="text-xs text-muted">{headline.source_name}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/** The season as a ruler: one column per round, the winner's colour, the next round marked. */
function SeasonRuler({ season, nextId }: { season: number; nextId: number | null }) {
  const { t } = useI18n();
  const events = useSeasonEvents(season).data?.results ?? [];
  if (events.length === 0) return null;
  return (
    <section aria-labelledby="home-season" className="flex flex-col gap-3">
      <Heading id="home-season" to={`/calendar/${String(season)}`} linkLabel={t("home.calendar")}>
        {t("home.season", { season })}
      </Heading>
      <ol className="-mx-4 flex overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {events.map((event) => {
          const winner = event.winner;
          const isNext = event.id === nextId;
          const colour = winner ? teamColour(winner.team_colour) : null;
          return (
            <li
              key={event.id}
              className="min-w-[4.75rem] flex-1 border-l border-line first:border-l-0"
            >
              <Link
                to={`/events/${String(event.id)}`}
                className={`group flex h-full flex-col gap-2 border-t-[3px] px-2 pt-2 pb-3 hover:bg-panel ${
                  isNext ? "border-mark" : "border-transparent"
                }`}
              >
                <span className="num text-xs text-muted">
                  {isNext ? (
                    <span className="font-semibold text-mark-text">{t("home.nextTag")}</span>
                  ) : (
                    `R${String(event.round)}`
                  )}
                </span>
                {event.circuit.outline ? (
                  <CircuitMark
                    path={event.circuit.outline}
                    stroke={colour ?? "var(--color-muted)"}
                    width={2}
                    className="h-10 w-full"
                  />
                ) : (
                  <span className="h-10" />
                )}
                <span className="truncate text-xs group-hover:underline">
                  {event.circuit.locality}
                </span>
                <span className="num truncate text-xs font-semibold">
                  {winner ? (winner.driver.code ?? winner.driver.family_name) : "·"}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

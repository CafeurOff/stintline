import type { ReactNode } from "react";
import { Link } from "react-router";

import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { sessionLabel } from "@/lib/sessions";
import { teamColour, teamTint } from "@/lib/teams";

import { type HomeBundle, pad, photoOf, raceStart, useCountdown, useGap } from "./data";
import { NewsImage, Portrait, PositionTag, StrategyStrip, TrackArt } from "./parts";

/** A: paddock dashboard. Full panels with header strips, the whole screen used. */
export function DirectionA({ data }: { data: HomeBundle }) {
  const { t, f, locale } = useI18n();
  const gap = useGap();
  const { last, next, entries } = data;
  const winner = entries[0];
  const fastest = entries.find((e) => e.fastest_lap_rank === 1);

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex h-14 items-center gap-8 border-b border-line bg-panel px-6">
        <span className="condensed text-xl font-extrabold tracking-tight uppercase">
          Stint<span className="text-mark-text">Line</span>
        </span>
        <nav className="hidden gap-6 text-sm font-semibold text-muted md:flex">
          <span className="text-ink">{t("nav.live")}</span>
          <span>{t("nav.calendar")}</span>
          <span>{t("nav.standings")}</span>
          <span>{t("nav.drivers")}</span>
          <span>{t("nav.teams")}</span>
          <span>{t("nav.news")}</span>
        </nav>
      </header>

      <div className="grid gap-3 p-3 xl:grid-cols-12">
        {last && (
          <Panel
            className="xl:col-span-8"
            title={t("home.lastRace")}
            meta={`${t("picker.round", { round: last.event.round })} · ${f.date(last.event.race_date)}`}
          >
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="condensed text-5xl leading-[0.9] font-extrabold uppercase">
                    {eventName(last.event.name, locale)}
                  </h2>
                  <p className="mt-1 text-muted">
                    {last.event.circuit.name} · {countryName(last.event.circuit.country, locale)}
                  </p>
                </div>
                {last.event.circuit.outline && (
                  <TrackArt
                    path={last.event.circuit.outline}
                    className="h-56 w-full"
                    line={teamColour(winner?.team_colour)}
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Tile label={t("home.stat.time")} value={f.lapTime(winner?.race_time_s)} />
                  <Tile
                    label={t("home.stat.margin")}
                    value={winner && entries[1] ? gap(entries[1], winner) : "—"}
                  />
                  <Tile
                    label={t("home.stat.fastest")}
                    value={fastest ? f.lapTime(fastest.fastest_lap_s) : "—"}
                    note={fastest?.driver.code}
                  />
                  <Tile
                    label={t("home.stat.laps")}
                    value={data.totalLaps === null ? "—" : String(data.totalLaps)}
                  />
                </div>
              </div>
              <ol aria-label={t("home.podium")} className="grid grid-cols-3 items-end gap-2">
                {[1, 0, 2].map((i) => {
                  const entry = last.podium[i];
                  if (!entry) return <li key={i} />;
                  return (
                    <li
                      key={entry.car_number}
                      className="flex flex-col overflow-hidden rounded-[4px]"
                      style={{ backgroundColor: teamTint(entry.team_colour, 30) }}
                    >
                      <Portrait
                        url={photoOf(entry)}
                        label={entry.driver.code ?? ""}
                        colour={entry.team_colour}
                        className={`w-full ${i === 0 ? "h-80" : "h-64"}`}
                      />
                      <span className="flex items-center gap-2 bg-bg/70 p-2">
                        <PositionTag position={String(i + 1)} colour={entry.team_colour} />
                        <span className="min-w-0">
                          <span className="condensed block truncate text-lg leading-none font-extrabold uppercase">
                            {entry.driver.family_name}
                          </span>
                          <span className="num block truncate text-xs text-muted">
                            {gap(entry, winner)}
                          </span>
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </Panel>
        )}

        {next && (
          <Panel
            className="xl:col-span-4"
            title={t("home.nextRace")}
            meta={eventName(next.name, locale)}
          >
            <NextBlock event={next} />
          </Panel>
        )}

        {entries.length > 0 && (
          <Panel className="xl:col-span-8" title={t("home.classification")}>
            <ol className="flex flex-col p-2">
              {entries.slice(0, 10).map((entry) => {
                const stint = data.stints.get(entry.car_number);
                return (
                  <li
                    key={entry.car_number}
                    className="grid grid-cols-[2rem_2.25rem_minmax(0,10rem)_6rem_minmax(0,1fr)_2.5rem] items-center gap-3 rounded-[3px] px-2 py-1.5 odd:bg-raised/60"
                  >
                    <PositionTag position={entry.classification ?? ""} colour={entry.team_colour} />
                    <Portrait
                      url={photoOf(entry)}
                      label={entry.driver.code ?? ""}
                      colour={entry.team_colour}
                      className="size-9 rounded-full bg-raised text-[0.45rem]"
                    />
                    <span className="truncate">
                      <span className="font-bold">{entry.driver.family_name}</span>
                      <span className="block truncate text-xs text-muted">{entry.team.name}</span>
                    </span>
                    <span className="num text-right text-sm">{gap(entry, winner)}</span>
                    {stint && data.totalLaps ? (
                      <StrategyStrip stint={stint} totalLaps={data.totalLaps} />
                    ) : (
                      <span />
                    )}
                    <span className="num text-right font-semibold">
                      {entry.points ? String(entry.points) : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Panel>
        )}

        {data.drivers.length > 0 && data.season !== null && (
          <Panel className="xl:col-span-4" title={t("home.drivers", { season: data.season })}>
            <ol className="flex flex-col p-2">
              {data.drivers.map((line) => (
                <li
                  key={line.driver?.ref ?? line.position_text}
                  className="flex items-center gap-3 rounded-[3px] px-2 py-2 odd:bg-raised/60"
                >
                  <span className="num w-5 text-muted">{line.position_text}</span>
                  <Portrait
                    url={line.driver?.photo_url}
                    label={line.driver?.code ?? ""}
                    colour={line.colour}
                    className="size-11 rounded-full bg-raised text-[0.5rem]"
                  />
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {line.driver?.family_name}
                  </span>
                  <span
                    className="num rounded-[3px] px-2 py-0.5 font-semibold"
                    style={{ backgroundColor: teamTint(line.colour, 35) }}
                  >
                    {f.number(line.points ?? 0, 0)}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        {data.headlines.length > 0 && (
          <Panel className="xl:col-span-12" title={t("news.latest")}>
            <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
              {data.headlines.slice(0, 8).map((h, i) => (
                <a
                  key={h.url}
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex flex-col overflow-hidden rounded-[4px] bg-raised ${
                    i === 0 ? "md:col-span-2 md:row-span-2" : ""
                  }`}
                >
                  <NewsImage
                    headline={h}
                    className={`w-full ${i === 0 ? "aspect-[16/9] flex-1" : "aspect-[16/9]"}`}
                  />
                  <span className="flex flex-col gap-1 p-3">
                    <span className="text-xs font-semibold text-mark-text uppercase">
                      {h.source_name}
                    </span>
                    <span
                      className={`leading-snug font-semibold group-hover:underline ${
                        i === 0 ? "text-2xl" : ""
                      }`}
                    >
                      {h.title}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          </Panel>
        )}

        {data.events.length > 0 && data.season !== null && (
          <Panel className="xl:col-span-12" title={t("home.season", { season: data.season })}>
            <ol className="flex gap-2 overflow-x-auto p-3">
              {data.events.map((event) => (
                <li
                  key={event.id}
                  className="flex w-40 shrink-0 flex-col gap-1 rounded-[4px] p-3"
                  style={{ backgroundColor: teamTint(event.winner?.team_colour, 20) }}
                >
                  <span className="num text-xs text-muted">R{event.round}</span>
                  {event.circuit.outline ? (
                    <TrackArt path={event.circuit.outline} className="h-20 w-full" width={6} />
                  ) : (
                    <span className="h-20" />
                  )}
                  <span className="truncate text-sm font-bold">{event.circuit.locality}</span>
                  <span className="truncate text-xs text-muted">
                    {event.winner?.driver.family_name ?? "·"}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Panel({
  title,
  meta,
  className = "",
  children,
}: {
  title: string;
  meta?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-[6px] border border-line bg-panel ${className}`}
    >
      <div className="flex h-10 items-center justify-between gap-4 border-b border-line bg-raised/50 px-4">
        <h2 className="condensed text-base font-extrabold tracking-wide uppercase">{title}</h2>
        {meta && <span className="truncate text-sm text-muted">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string | undefined }) {
  return (
    <div className="rounded-[4px] bg-raised px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="num text-xl font-medium">
        {value}
        {note && <span className="ml-2 text-xs text-muted">{note}</span>}
      </div>
    </div>
  );
}

function NextBlock({ event }: { event: NonNullable<HomeBundle["next"]> }) {
  const { t, locale } = useI18n();
  const left = useCountdown(raceStart(event));
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const when = new Intl.DateTimeFormat(tag, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="flex flex-col gap-4 p-4">
      {event.circuit.outline && (
        <TrackArt path={event.circuit.outline} className="h-52 w-full" line="var(--color-mark)" />
      )}
      <p className="text-sm text-muted">
        {event.circuit.name} · {countryName(event.circuit.country, locale)}
      </p>
      <div role="timer" className="grid grid-cols-4 gap-2 text-center">
        {[left.days, left.hours, left.minutes, left.seconds].map((v, i) => (
          <span key={i} className="num rounded-[4px] bg-raised py-2 text-3xl font-medium">
            {pad(v)}
          </span>
        ))}
      </div>
      <ul className="flex flex-col text-sm">
        {event.sessions
          .filter((s) => s.scheduled_start)
          .map((s) => (
            <li key={s.id} className="flex justify-between border-t border-line py-1.5">
              <span className={s.kind === "R" ? "font-bold" : ""}>{sessionLabel(s.kind, t)}</span>
              <span className="num text-muted first-letter:uppercase">
                {when.format(new Date(s.scheduled_start ?? ""))}
              </span>
            </li>
          ))}
      </ul>
      <Link to={`/events/${String(event.id)}`} className="text-sm font-semibold hover:underline">
        {eventName(event.name, locale)} →
      </Link>
    </div>
  );
}

import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { teamColour, teamTint } from "@/lib/teams";

import { useAgo } from "@/features/news/useAgo";

import { type HomeBundle, pad, photoOf, raceStart, useCountdown, useGap } from "./data";
import { NewsImage, Portrait, StrategyStrip, TrackArt } from "./parts";

/** C: racing magazine. News pictures up front, the race told large, drivers as a gallery. */
export function DirectionC({ data }: { data: HomeBundle }) {
  const { t, f, locale } = useI18n();
  const gap = useGap();
  const ago = useAgo();
  const { last, next, entries } = data;
  const [lead, ...rest] = data.headlines;
  const winner = entries[0] ?? last?.podium[0];

  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto flex max-w-[1320px] items-end justify-between gap-6 border-b-2 border-ink px-6 pt-8 pb-3">
        <span className="condensed text-5xl leading-none font-extrabold tracking-tight uppercase">
          StintLine
        </span>
        <nav className="hidden gap-6 pb-1 text-sm font-semibold md:flex">
          <span>{t("nav.live")}</span>
          <span>{t("nav.calendar")}</span>
          <span>{t("nav.standings")}</span>
          <span>{t("nav.drivers")}</span>
          <span>{t("nav.news")}</span>
        </nav>
      </header>

      <main className="mx-auto flex max-w-[1320px] flex-col gap-14 px-6 py-8">
        {lead && (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <a
              href={lead.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-3"
            >
              <NewsImage headline={lead} className="aspect-[16/9] w-full rounded-[3px]" />
              <span className="text-sm font-bold text-mark-text uppercase">{lead.source_name}</span>
              <span className="text-4xl leading-tight font-bold group-hover:underline">
                {lead.title}
              </span>
            </a>
            <ul className="flex flex-col">
              {rest.slice(0, 6).map((h) => (
                <li key={h.url} className="border-b border-line py-3 first:pt-0">
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3"
                  >
                    <NewsImage
                      headline={h}
                      className="aspect-[4/3] w-full rounded-[3px] text-[0.6rem]"
                    />
                    <span className="flex flex-col gap-1">
                      <span className="leading-snug font-semibold group-hover:underline">
                        {h.title}
                      </span>
                      <span className="text-xs text-muted">
                        {h.source_name} · {ago(h.published_at)}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {last && winner && (
          <section
            className="relative overflow-hidden rounded-[4px]"
            style={{ backgroundColor: teamTint(winner.team_colour, 22) }}
          >
            {last.event.circuit.outline && (
              <TrackArt
                path={last.event.circuit.outline}
                className="absolute -top-10 -left-10 h-[120%] opacity-60"
                line={teamColour(winner.team_colour)}
              />
            )}
            <div className="relative grid gap-6 p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="flex flex-col justify-end gap-3">
                <span className="text-sm font-bold uppercase">
                  {t("home.lastRace")} · {f.date(last.event.race_date)}
                </span>
                <h2 className="condensed text-6xl leading-[0.9] font-extrabold uppercase">
                  {eventName(last.event.name, locale)}
                </h2>
                <p className="text-lg">
                  {t("home.winnerLine", {
                    winner: `${winner.driver.given_name} ${winner.driver.family_name}`,
                    team: winner.team.name,
                  })}
                </p>
              </div>
              <ol className="grid grid-cols-3 items-end gap-3">
                {[1, 0, 2].map((i) => {
                  const entry = last.podium[i];
                  if (!entry) return <li key={i} />;
                  return (
                    <li key={entry.car_number} className="flex flex-col items-center">
                      <Portrait
                        url={photoOf(entry)}
                        label={entry.driver.code ?? ""}
                        colour={entry.team_colour}
                        className={`w-full object-contain object-bottom ${i === 0 ? "h-80" : "h-64"}`}
                      />
                      <span
                        className="condensed w-full py-2 text-center text-2xl font-extrabold uppercase"
                        style={{ borderTop: `4px solid ${teamColour(entry.team_colour)}` }}
                      >
                        {i + 1}. {entry.driver.family_name}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
            {entries.length > 0 && data.totalLaps && (
              <ol className="relative grid gap-x-8 gap-y-1 bg-bg/80 p-6 md:grid-cols-2">
                {entries.slice(0, 10).map((entry) => {
                  const stint = data.stints.get(entry.car_number);
                  return (
                    <li
                      key={entry.car_number}
                      className="grid grid-cols-[1.5rem_8rem_5.5rem_minmax(0,1fr)] items-center gap-3 py-1 text-sm"
                    >
                      <span className="num text-muted">{entry.classification}</span>
                      <span className="truncate font-semibold">{entry.driver.family_name}</span>
                      <span className="num text-right">{gap(entry, winner)}</span>
                      {stint && data.totalLaps ? (
                        <StrategyStrip stint={stint} totalLaps={data.totalLaps} className="h-3" />
                      ) : (
                        <span />
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        )}

        {data.drivers.length > 0 && data.season !== null && (
          <section className="flex flex-col gap-4">
            <h2 className="condensed text-3xl font-extrabold uppercase">
              {t("home.drivers", { season: data.season })}
            </h2>
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {data.drivers.map((line) => (
                <li
                  key={line.driver?.ref ?? line.position_text}
                  className="flex flex-col overflow-hidden rounded-[3px]"
                  style={{ backgroundColor: teamTint(line.colour, 28) }}
                >
                  <Portrait
                    url={line.driver?.photo_url}
                    label={line.driver?.code ?? ""}
                    colour={line.colour}
                    className="h-52 w-full object-contain object-bottom"
                  />
                  <span className="flex items-baseline justify-between bg-bg/70 px-3 py-2">
                    <span className="truncate font-bold">
                      {line.position_text}. {line.driver?.family_name}
                    </span>
                    <span className="num font-semibold">{f.number(line.points ?? 0, 0)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {next && <NextFeature event={next} />}
      </main>
    </div>
  );
}

function NextFeature({ event }: { event: NonNullable<HomeBundle["next"]> }) {
  const { t, locale } = useI18n();
  const left = useCountdown(raceStart(event));
  return (
    <section className="grid items-center gap-8 border-y-2 border-ink py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {event.circuit.outline && (
        <TrackArt
          path={event.circuit.outline}
          className="h-80 w-full"
          line="var(--color-mark)"
          width={18}
        />
      )}
      <div className="flex flex-col gap-3">
        <span className="text-sm font-bold text-mark-text uppercase">{t("home.nextRace")}</span>
        <h2 className="condensed text-6xl leading-[0.9] font-extrabold uppercase">
          {eventName(event.name, locale)}
        </h2>
        <p className="text-muted">
          {event.circuit.name} · {countryName(event.circuit.country, locale)}
        </p>
        <p role="timer" className="num text-5xl font-medium">
          {left.days}d {pad(left.hours)}:{pad(left.minutes)}:{pad(left.seconds)}
        </p>
      </div>
    </section>
  );
}

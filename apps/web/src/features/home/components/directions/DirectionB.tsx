import { useState } from "react";

import { compoundInfo } from "@/lib/compounds";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { sessionLabel } from "@/lib/sessions";
import { inkOn, teamColour } from "@/lib/teams";

import { type HomeBundle, pad, photoOf, raceStart, useCountdown, useGap } from "./data";
import { NewsImage, Portrait, PositionTag, TrackArt } from "./parts";

/** B: TV graphics. Solid team colour, big cut-out portraits, a timing tower, lower thirds. */
export function DirectionB({ data }: { data: HomeBundle }) {
  const { t, f, locale } = useI18n();
  const gap = useGap();
  const { last, next, entries } = data;
  const winner = entries[0] ?? last?.podium[0];
  const colour = teamColour(winner?.team_colour);
  const ink = inkOn(colour);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b-4 border-mark bg-[#08080a] text-white">
        <div className="flex h-16 items-center gap-8 px-6">
          <span className="condensed text-2xl font-extrabold tracking-tight uppercase italic">
            StintLine
          </span>
          <nav className="hidden gap-6 text-sm font-bold tracking-wide uppercase md:flex">
            <span>{t("nav.live")}</span>
            <span className="opacity-70">{t("nav.calendar")}</span>
            <span className="opacity-70">{t("nav.standings")}</span>
            <span className="opacity-70">{t("nav.drivers")}</span>
            <span className="opacity-70">{t("nav.news")}</span>
          </nav>
        </div>
      </header>

      {last && winner && (
        <section
          className="relative overflow-hidden"
          style={{ backgroundColor: colour, color: ink }}
        >
          {last.event.circuit.outline && (
            <TrackArt
              path={last.event.circuit.outline}
              className="absolute top-1/2 right-[8%] h-[130%] -translate-y-1/2 opacity-25"
              road="transparent"
              edge={ink}
              line={ink}
              width={10}
            />
          )}
          <div className="relative mx-auto grid max-w-[1400px] items-end gap-6 px-6 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3 pb-10">
              <span className="w-fit bg-black px-3 py-1 text-sm font-bold tracking-widest text-white uppercase">
                {t("dev.winner")} · {eventName(last.event.name, locale)}
              </span>
              <h2 className="condensed text-7xl leading-[0.85] font-extrabold uppercase italic sm:text-9xl">
                {winner.driver.given_name}
                <br />
                {winner.driver.family_name}
              </h2>
              <p className="text-xl font-semibold">
                {winner.team.name} · {f.lapTime(winner.race_time_s)}
              </p>
            </div>
            <Portrait
              url={photoOf(winner)}
              label={winner.driver.code ?? ""}
              colour={winner.team_colour}
              className="h-[26rem] w-full object-contain object-bottom"
            />
          </div>
        </section>
      )}

      <div className="mx-auto grid max-w-[1400px] gap-8 px-6 py-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {entries.length > 0 && (
          <section aria-label={t("dev.tower")} className="bg-[#08080a] text-white">
            <div className="flex items-center justify-between bg-mark px-3 py-2 text-sm font-extrabold uppercase">
              <span>{t("dev.tower")}</span>
              <span className="num">
                {t("home.stat.laps")} {data.totalLaps ?? ""}
              </span>
            </div>
            <ol>
              {entries.slice(0, 20).map((entry) => {
                const stint = data.stints.get(entry.car_number);
                const lastStint = stint?.stints.at(-1);
                const info = compoundInfo(lastStint?.compound);
                return (
                  <li
                    key={entry.car_number}
                    className="grid grid-cols-[2rem_4px_3.5rem_minmax(0,1fr)_1.5rem] items-center gap-2 border-b border-white/10 py-1 pr-2"
                  >
                    <span className="num text-center font-semibold">{entry.classification}</span>
                    <span
                      className="h-5 w-1"
                      style={{ backgroundColor: teamColour(entry.team_colour) }}
                    />
                    <span className="font-extrabold">{entry.driver.code}</span>
                    <span className="num text-right text-sm text-white/80">
                      {gap(entry, winner)}
                    </span>
                    <span
                      className="grid size-5 place-items-center rounded-full text-[0.65rem] font-bold text-tyre-ink"
                      style={{ backgroundColor: info.fill }}
                    >
                      {info.letter}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <div className="flex min-w-0 flex-col gap-8">
          {last && (
            <div className="grid gap-4 sm:grid-cols-2">
              {last.podium.slice(1, 3).map((entry, i) => (
                <LowerThird
                  key={entry.car_number}
                  entry={entry}
                  place={i + 2}
                  detail={gap(entry, winner)}
                />
              ))}
            </div>
          )}

          {winner?.media?.car_image_url && <CarRender url={winner.media.car_image_url} />}

          {next && <NextBand event={next} />}

          {data.headlines.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="condensed w-fit bg-mark px-3 py-1 text-xl font-extrabold text-white uppercase italic">
                {t("news.latest")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.headlines.slice(0, 6).map((h) => (
                  <a
                    key={h.url}
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col bg-[#08080a] text-white"
                  >
                    <NewsImage headline={h} className="aspect-[16/9] w-full" />
                    <span className="flex flex-col gap-1 border-t-4 border-mark p-3">
                      <span className="text-xs font-bold tracking-widest uppercase opacity-70">
                        {h.source_name}
                      </span>
                      <span className="leading-snug font-bold group-hover:underline">
                        {h.title}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function LowerThird({
  entry,
  place,
  detail,
}: {
  entry: HomeBundle["entries"][number];
  place: number;
  detail: string;
}) {
  const colour = teamColour(entry.team_colour);
  return (
    <div className="flex h-40 items-end overflow-hidden bg-[#08080a] text-white">
      <Portrait
        url={photoOf(entry)}
        label={entry.driver.code ?? ""}
        colour={entry.team_colour}
        className="h-full w-36 shrink-0 object-contain object-bottom"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-3 pb-2">
          <PositionTag
            position={String(place)}
            colour={entry.team_colour}
            className="h-9 w-10 text-xl"
          />
          <span className="condensed truncate text-3xl leading-none font-extrabold uppercase italic">
            {entry.driver.family_name}
          </span>
        </div>
        <div
          className="flex justify-between px-3 py-1.5 text-sm font-bold"
          style={{ backgroundColor: colour, color: inkOn(colour) }}
        >
          <span className="truncate">{entry.team.name}</span>
          <span className="num">{detail}</span>
        </div>
      </div>
    </div>
  );
}

function CarRender({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => {
        setFailed(true);
      }}
      className="mx-auto max-h-56 w-full object-contain"
    />
  );
}

function NextBand({ event }: { event: NonNullable<HomeBundle["next"]> }) {
  const { t, locale } = useI18n();
  const left = useCountdown(raceStart(event));
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const when = new Intl.DateTimeFormat(tag, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <section className="grid overflow-hidden bg-[#08080a] text-white md:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="grid place-items-center bg-white/5 p-4">
        {event.circuit.outline && (
          <TrackArt
            path={event.circuit.outline}
            className="h-48 w-full"
            road="#2a2a30"
            edge="#ffffff"
            line="#ff2d2d"
            width={10}
          />
        )}
      </div>
      <div className="flex flex-col gap-3 p-5">
        <span className="text-sm font-bold tracking-widest text-mark-text uppercase">
          {t("home.nextRace")}
        </span>
        <h2 className="condensed text-5xl leading-none font-extrabold uppercase italic">
          {eventName(event.name, locale)}
        </h2>
        <p className="text-white/70">
          {event.circuit.name} · {countryName(event.circuit.country, locale)}
        </p>
        <div role="timer" className="flex items-baseline gap-4">
          <span className="text-sm font-bold uppercase opacity-70">{t("dev.lightsOut")}</span>
          <span className="num text-4xl font-semibold">
            {left.days}d {pad(left.hours)}:{pad(left.minutes)}:{pad(left.seconds)}
          </span>
        </div>
        <ul className="flex flex-wrap gap-2 text-sm">
          {event.sessions
            .filter((s) => s.scheduled_start)
            .map((s) => (
              <li
                key={s.id}
                className={`px-2 py-1 ${s.kind === "R" ? "bg-mark font-bold" : "bg-white/10"}`}
              >
                {sessionLabel(s.kind, t)} ·{" "}
                <span className="num">{when.format(new Date(s.scheduled_start ?? ""))}</span>
              </li>
            ))}
        </ul>
      </div>
    </section>
  );
}

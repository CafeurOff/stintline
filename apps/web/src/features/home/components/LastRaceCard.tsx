import type { Schema } from "@stintline/api-types";
import { ChevronRight, Play } from "lucide-react";
import { Link } from "react-router";

import { pillGlass, pillPrimary } from "@/components/layout/Glass";
import { Trails } from "@/components/layout/Trails";
import { NO_BACKDROP } from "@/components/racing/backdrop";
import { CarImage } from "@/components/racing/CarImage";
import { Face } from "@/components/racing/Face";
import { Flag } from "@/components/racing/Flag";
import { useSessionDetail } from "@/features/race/api";
import { readable } from "@/lib/colour";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import { type Entry, type Report, codeOf, fitWidth, glowStyle, photoOf, two } from "./helpers";

export function LastRaceCard({
  race,
  report,
}: {
  race: Schema<"LastRace">;
  report: Report | null;
}) {
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

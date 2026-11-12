import type { Schema } from "@stintline/api-types";
import { Play } from "lucide-react";
import { Link } from "react-router";

import { Face } from "@/components/dash/Face";
import { CircuitMark } from "@/components/racing/CircuitMark";
import { Flag } from "@/components/racing/Flag";
import { initials } from "@/components/racing/initials";
import { timedSessions } from "@/features/session-picker/useRaces";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { teamColour, teamTint } from "@/lib/teams";
import { timeLeft } from "@/lib/useClock";

import { weekendDates } from "../dates";

type EventItem = Schema<"Event">;

const pad = (n: number) => String(n).padStart(2, "0");

/** A Grand Prix as a dashboard card: flag and round, the circuit, the winner or the start. */
export function GrandPrixCard({
  event,
  isNext,
  now,
}: {
  event: EventItem;
  isNext: boolean;
  now: number;
}) {
  const { t, locale } = useI18n();
  const name = eventName(event.name, locale);
  const race = timedSessions(event).find((s) => s.kind === "R");
  const winner = event.winner;
  const scheduled = event.sessions.find((s) => s.kind === "R")?.scheduled_start ?? null;
  const raceStart = scheduled
    ? new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(scheduled))
    : null;
  const left = scheduled ? timeLeft(Date.parse(scheduled), now) : null;

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-xl border bg-panel transition-colors hover:border-line-strong ${
        isNext ? "border-mark" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-xs">
        <span className="flex items-center gap-2 font-semibold">
          <Flag country={event.circuit.country} className="text-sm" />
          <span className="num rounded border border-line px-1.5">R{event.round}</span>
          <span className="text-muted">{weekendDates(event, locale)}</span>
        </span>
        <span className="flex gap-1.5">
          {event.format === "sprint" && (
            <span className="rounded bg-t-yellow/15 px-1.5 py-0.5 font-bold text-t-yellow">
              {t("picker.sprint")}
            </span>
          )}
          {isNext && (
            <span className="rounded bg-mark px-1.5 py-0.5 font-bold text-white">
              {t("calendar.next")}
            </span>
          )}
          {!winner && !isNext && (
            <span className="rounded bg-raised px-1.5 py-0.5 font-bold text-muted">
              {t("picker.upcoming")}
            </span>
          )}
        </span>
      </div>
      <div className="flex flex-1 items-center gap-3 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-bold">
            <Link
              to={`/events/${String(event.id)}`}
              className="after:absolute after:inset-0 hover:underline"
            >
              {name}
            </Link>
          </h2>
          <p className="text-sm text-muted">
            {event.circuit.locality} · {countryName(event.circuit.country, locale)}
          </p>
        </div>
        {event.circuit.outline && (
          <CircuitMark
            path={event.circuit.outline}
            stroke={
              winner
                ? teamColour(winner.team_colour)
                : isNext
                  ? "var(--color-mark)"
                  : "var(--color-muted)"
            }
            width={2.5}
            className="size-20 shrink-0"
          />
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 px-4 pb-4">
        {winner ? (
          <span
            className="flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-3 pl-1"
            style={{ backgroundColor: teamTint(winner.team_colour, 22) }}
          >
            <Face
              url={winner.driver.photo_url}
              label={
                winner.driver.code ?? initials(winner.driver.given_name, winner.driver.family_name)
              }
              colour={winner.team_colour}
              className="size-9 shrink-0 rounded-md text-xs"
            />
            <span className="min-w-0 leading-tight">
              <span className="block text-[0.7rem] text-muted">{t("col.winner")}</span>
              <span className="block truncate font-bold">{winner.driver.family_name}</span>
            </span>
          </span>
        ) : (
          <span className="leading-tight">
            <span className="block text-[0.7rem] text-muted">{t("session.R")}</span>
            <span className="block text-sm font-semibold first-letter:uppercase">
              {raceStart ?? weekendDates(event, locale)}
            </span>
            {isNext && left && (
              <span
                role="timer"
                aria-label={t("countdown.label", {
                  days: left.days,
                  hours: left.hours,
                  minutes: left.minutes,
                })}
                className="num mt-0.5 block text-lg font-semibold text-mark-text"
              >
                {left.days}d {pad(left.hours)}:{pad(left.minutes)}:{pad(left.seconds)}
              </span>
            )}
          </span>
        )}
        {race && (
          <Link
            to={`/sessions/${String(race.id)}`}
            className="relative z-10 flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-1.5 text-sm font-semibold hover:border-transparent hover:bg-action hover:text-white"
            aria-label={t("calendar.replayOf", { name })}
          >
            <Play aria-hidden="true" className="size-3.5 fill-current" />
            {t("col.replay")}
          </Link>
        )}
      </div>
    </article>
  );
}

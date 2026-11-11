import type { Schema } from "@stintline/api-types";
import { Link } from "react-router";

import { Countdown } from "@/components/hub/Countdown";
import { CircuitMark } from "@/components/racing/CircuitMark";
import { DriverPhoto } from "@/components/racing/DriverPhoto";
import { initials } from "@/components/racing/initials";
import { timedSessions } from "@/features/session-picker/useRaces";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { teamColour, teamTint } from "@/lib/teams";

import { weekendDates } from "../dates";

type EventItem = Schema<"Event">;
const DAY_MS = 86_400_000;

/** A Grand Prix as a card: the circuit drawn behind, the weekend, the winner, the replay. */
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
  const colour = winner ? teamColour(winner.team_colour) : null;
  const upcoming = !winner;
  const days = Math.max(0, Math.ceil((Date.parse(`${event.race_date}T12:00:00Z`) - now) / DAY_MS));
  const relative = new Intl.RelativeTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    numeric: "auto",
  });
  const scheduled = event.sessions.find((s) => s.kind === "R")?.scheduled_start ?? null;
  const nextRaceStart = scheduled;
  const raceStart = scheduled
    ? new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(scheduled))
    : null;
  const accent = colour ?? (isNext ? "var(--color-mark)" : "var(--color-line-strong)");

  return (
    <article
      className={`group relative flex h-full min-h-60 flex-col overflow-hidden rounded-2xl border-t-4 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 ${
        isNext ? "ring-2 ring-mark" : ""
      }`}
      style={{
        borderTopColor: accent,
        backgroundColor: winner ? teamTint(winner.team_colour, 16) : "var(--color-panel)",
      }}
    >
      {event.circuit.outline && (
        <CircuitMark
          path={event.circuit.outline}
          stroke={colour ?? "var(--color-ink)"}
          width={4}
          className={`pointer-events-none absolute top-16 right-3 size-32 ${
            upcoming && !isNext ? "opacity-20" : "opacity-35"
          } transition-opacity group-hover:opacity-60`}
        />
      )}
      <div className="relative flex flex-1 flex-col gap-1 p-4">
        <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-muted uppercase">
          <span className="text-ink">{t("picker.round", { round: event.round })}</span>
          <span aria-hidden="true">·</span>
          <span>{weekendDates(event, locale)}</span>
        </p>
        <h2 className="relative mt-1 max-w-[85%] text-xl leading-tight font-black">
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
        <p className="mt-2 flex flex-wrap gap-1.5">
          {event.format === "sprint" && (
            <span className="rounded-sm bg-caution/20 px-1.5 py-0.5 text-xs font-bold tracking-wide text-caution uppercase">
              {t("picker.sprint")}
            </span>
          )}
          {isNext && (
            <span className="rounded-sm bg-mark px-1.5 py-0.5 text-xs font-bold tracking-wide text-white uppercase">
              {t("calendar.next")} · {relative.format(days, "day")}
            </span>
          )}
          {upcoming && !isNext && (
            <span className="rounded-sm bg-raised px-1.5 py-0.5 text-xs font-bold tracking-wide text-muted uppercase">
              {t("picker.upcoming")}
            </span>
          )}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          {winner ? (
            <span className="flex min-w-0 items-end gap-3">
              <DriverPhoto
                imageUrl={winner.driver.photo_url}
                label={
                  winner.driver.code ??
                  initials(winner.driver.given_name, winner.driver.family_name)
                }
                colour={winner.team_colour}
                className="h-16 w-14 shrink-0 rounded-lg bg-raised text-base"
              />
              <span className="min-w-0 leading-tight">
                <span className="block text-[0.65rem] font-bold tracking-widest text-muted uppercase">
                  {t("col.winner")}
                </span>
                <span className="block truncate text-lg font-bold">
                  {winner.driver.family_name}
                </span>
                <span className="flex items-center gap-1.5 truncate text-xs text-muted">
                  <span
                    aria-hidden="true"
                    className="h-3 w-1 rounded-full"
                    style={{ backgroundColor: colour ?? undefined }}
                  />
                  {winner.team.name}
                </span>
              </span>
            </span>
          ) : raceStart ? (
            <span className="leading-tight">
              <span className="block text-[0.65rem] font-bold tracking-widest text-muted uppercase">
                {t("session.R")}
              </span>
              <span className="block font-bold first-letter:uppercase">{raceStart}</span>
              {isNext && (
                <span className="mt-2 block">
                  <Countdown target={nextRaceStart ?? ""} compact />
                </span>
              )}
            </span>
          ) : (
            <span />
          )}
          {race && (
            <Link
              to={`/sessions/${String(race.id)}`}
              className="relative z-10 flex shrink-0 items-center gap-1.5 rounded-lg bg-bg/60 px-3 py-1.5 text-sm font-bold backdrop-blur hover:bg-action hover:text-white"
              aria-label={t("calendar.replayOf", { name })}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
                <path d="M7 4l13 8-13 8z" />
              </svg>
              {t("col.replay")}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

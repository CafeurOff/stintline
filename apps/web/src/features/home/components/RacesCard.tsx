import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { GlassCard, MoreLink, PillSwitch } from "@/components/layout/Glass";
import { CircuitMark } from "@/components/racing/CircuitMark";
import { Face } from "@/components/racing/Face";
import { circuitAccent } from "@/lib/accent";
import { readable } from "@/lib/colour";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";

import { type Event, codeOf } from "./helpers";

export function RacesCard({
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

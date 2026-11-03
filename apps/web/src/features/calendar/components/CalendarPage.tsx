import type { Schema } from "@stintline/api-types";
import { Link, useNavigate, useParams } from "react-router";

import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { DriverAvatar } from "@/components/racing/DriverAvatar";
import { initials } from "@/components/racing/initials";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useSeasonEvents } from "@/features/hub/api";
import { useCurrentSeason } from "@/features/hub/useCurrentSeason";
import { timedSessions } from "@/features/session-picker/useRaces";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { teamColour, teamTint } from "@/lib/teams";
import { useNow } from "@/lib/useNow";

type EventItem = Schema<"Event">;
const DAY_MS = 86_400_000;

/** Every Grand Prix of a season as cards: who won, what comes next, what can be replayed. */
export function CalendarPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const params = useParams();
  const current = useCurrentSeason();
  const now = useNow();
  const fromUrl = params.year && /^\d{4}$/.test(params.year) ? Number(params.year) : null;
  const year = fromUrl ?? current.season;
  const events = useSeasonEvents(year);
  const list = events.data?.results ?? [];
  const nextId = list.find((e) => !e.winner && Date.parse(`${e.race_date}T23:59:59Z`) >= now)?.id;
  const done = list.filter((e) => e.winner).length;

  return (
    <div>
      <PageHeader
        title={year === null ? t("calendar.title") : t("calendar.season", { year })}
        actions={
          <SeasonSelect
            value={year}
            onChange={(value) => {
              if (value !== null) void navigate(`/calendar/${String(value)}`);
            }}
          />
        }
      >
        {list.length > 0
          ? t("calendar.progress", { done, total: list.length })
          : t("calendar.intro")}
      </PageHeader>
      {events.isError ? (
        <ErrorState error={events.error} onRetry={() => void events.refetch()} />
      ) : !events.data ? (
        <Skeleton className="h-96" />
      ) : list.length === 0 ? (
        <EmptyState title={t("calendar.empty")} />
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((event) => (
            <li key={event.id}>
              <EventCard event={event} isNext={event.id === nextId} now={now} />
            </li>
          ))}
        </ol>
      )}
      <p className="mt-6 text-sm text-muted">{t("calendar.intro")}</p>
    </div>
  );
}

function EventCard({ event, isNext, now }: { event: EventItem; isNext: boolean; now: number }) {
  const { t, f, locale } = useI18n();
  const name = eventName(event.name, locale);
  const race = timedSessions(event).find((s) => s.kind === "R");
  const winner = event.winner;
  const days = Math.max(0, Math.ceil((Date.parse(`${event.race_date}T12:00:00Z`) - now) / DAY_MS));
  const relative = new Intl.RelativeTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    numeric: "auto",
  });

  return (
    <article
      className={`relative flex h-full flex-col gap-3 rounded-2xl border p-4 transition hover:border-ink ${
        isNext ? "border-mark" : "border-line"
      } ${winner || isNext ? "" : "opacity-75"}`}
      style={winner ? { backgroundColor: teamTint(winner.team_colour, 10) } : undefined}
    >
      <header className="flex items-baseline justify-between gap-2 text-sm text-muted">
        <span className="font-semibold tabular-nums">
          {t("picker.round", { round: event.round })}
        </span>
        <span>{f.date(event.race_date)}</span>
      </header>
      <h2 className="text-lg leading-tight font-bold">
        <Link
          to={`/events/${String(event.id)}`}
          className="after:absolute after:inset-0 hover:underline"
        >
          {name}
        </Link>
      </h2>
      <p className="-mt-2 text-sm text-muted">
        {event.circuit.locality} · {countryName(event.circuit.country, locale)}
        {event.format === "sprint" && ` · ${t("picker.sprint")}`}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2">
        {winner ? (
          <span className="flex min-w-0 items-center gap-2">
            <DriverAvatar
              label={
                winner.driver.code ?? initials(winner.driver.given_name, winner.driver.family_name)
              }
              name={`${winner.driver.given_name} ${winner.driver.family_name}`}
              colour={winner.team_colour}
              imageUrl={winner.driver.portrait_url}
              size="sm"
              decorative
            />
            <span className="min-w-0 leading-tight">
              <span className="block text-xs text-muted">{t("col.winner")}</span>
              <span className="flex items-center gap-1.5 truncate font-semibold">
                <span
                  aria-hidden="true"
                  className="h-3 w-1 rounded-full"
                  style={{ backgroundColor: teamColour(winner.team_colour) }}
                />
                {winner.driver.family_name}
              </span>
            </span>
          </span>
        ) : (
          <span className={`text-sm font-semibold ${isNext ? "text-mark-text" : "text-muted"}`}>
            {isNext
              ? `${t("calendar.next")} · ${relative.format(days, "day")}`
              : t("picker.upcoming")}
          </span>
        )}
        {race && (
          <Link
            to={`/sessions/${String(race.id)}`}
            className="relative z-10 shrink-0 rounded-md border border-line-strong px-2 py-1 text-sm font-semibold hover:border-ink"
            aria-label={t("calendar.replayOf", { name })}
          >
            {t("col.replay")}
          </Link>
        )}
      </div>
    </article>
  );
}

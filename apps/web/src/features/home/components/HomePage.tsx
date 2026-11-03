import type { Schema } from "@stintline/api-types";
import { Link } from "react-router";

import { DriverName } from "@/components/hub/DriverName";
import { TeamName } from "@/components/hub/TeamName";
import { DriverAvatar } from "@/components/racing/DriverAvatar";
import { initials } from "@/components/racing/initials";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useHome } from "@/features/hub/api";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { useNow } from "@/lib/useNow";

const DAY_MS = 86_400_000;

/** Landing page: the last race on the circuit, the next Grand Prix and the title fight. */
export function HomePage() {
  const { t } = useI18n();
  const home = useHome();

  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;
  if (!home.data) return <Skeleton className="mt-6 h-[60vh]" />;
  const { last_race: last, next_event: next, drivers, constructors, season } = home.data;
  if (!last && !next) {
    return (
      <EmptyState title={t("home.empty.title")}>
        <p>{t("home.empty.body")}</p>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <h1 className="max-w-3xl text-3xl leading-tight font-bold sm:text-5xl">{t("home.title")}</h1>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {last && <LastRace race={last} />}
        <div className="flex flex-col gap-10">
          {next && <NextEvent event={next} />}
          {season !== null && drivers.length > 0 && (
            <section aria-labelledby="home-standings" className="flex flex-col gap-3">
              <h2 id="home-standings" className="text-xl font-bold">
                {t("home.standings", { season })}
              </h2>
              <ol className="flex flex-col">
                {drivers.map((line) =>
                  line.driver ? (
                    <li
                      key={line.driver.ref}
                      className="flex items-center gap-3 border-b border-line py-2"
                    >
                      <span className="w-6 text-muted tabular-nums">{line.position_text}</span>
                      <span className="min-w-0 flex-1">
                        <DriverName driver={line.driver} avatar="xs" />
                      </span>
                      <span className="font-bold tabular-nums">{line.points}</span>
                    </li>
                  ) : null,
                )}
              </ol>
              <p className="text-sm text-muted">
                {t("home.leadingTeam")}{" "}
                {constructors[0]?.team && <TeamName team={constructors[0].team} link />}
              </p>
              <Link to={`/standings/${season}`} className="font-semibold text-mark-text">
                {t("home.allStandings")} →
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function LastRace({ race }: { race: Schema<"LastRace"> }) {
  const { t, f, locale } = useI18n();
  const name = eventName(race.event.name, locale);
  return (
    <section aria-labelledby="home-last" className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted">
          {t("home.lastRace")} · {f.date(race.event.race_date)}
        </p>
        <h2 id="home-last" className="text-2xl font-bold">
          {name}
        </h2>
      </div>
      <ol className="grid grid-cols-3 items-end gap-3" aria-label={t("home.podium")}>
        {[1, 0, 2].map((index) => {
          const entry = race.podium[index];
          if (!entry) return <li key={index} />;
          const driverName = `${entry.driver.given_name} ${entry.driver.family_name}`;
          return (
            <li
              key={entry.car_number}
              className={`flex flex-col items-center gap-2 text-center ${index === 0 ? "" : "pt-6"}`}
            >
              <Link
                to={`/drivers/${entry.driver.ref}`}
                className="flex flex-col items-center gap-2"
              >
                <DriverAvatar
                  label={
                    entry.driver.code ?? initials(entry.driver.given_name, entry.driver.family_name)
                  }
                  name={driverName}
                  colour={entry.team_colour}
                  imageUrl={entry.media?.driver_image_url ?? entry.driver.portrait_url}
                  size={index === 0 ? "xl" : "lg"}
                  decorative
                />
                <span className="text-sm text-muted">{f.ordinal(index + 1)}</span>
                <span className="font-bold">{entry.driver.family_name}</span>
              </Link>
              <span className="text-sm text-muted">{entry.team.name}</span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-3">
        {race.has_data && (
          <Link
            to={`/sessions/${race.session_id}`}
            className="rounded-lg bg-action px-4 py-3 font-bold text-white hover:brightness-110"
          >
            {t("home.replay")}
          </Link>
        )}
        <Link
          to={`/events/${race.event.id}`}
          className="rounded-lg border border-line-strong px-4 py-3 font-bold hover:border-ink"
        >
          {t("home.results")}
        </Link>
      </div>
    </section>
  );
}

function NextEvent({ event }: { event: Schema<"Event"> }) {
  const { t, f, locale } = useI18n();
  const now = useNow();
  const raceStart = event.sessions.find((s) => s.kind === "R")?.scheduled_start;
  const target = new Date(raceStart ?? `${event.race_date}T12:00:00Z`).getTime();
  const days = Math.max(0, Math.ceil((target - now) / DAY_MS));
  const relative = new Intl.RelativeTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    numeric: "auto",
  });
  return (
    <section aria-labelledby="home-next" className="flex flex-col gap-2">
      <p className="text-sm text-muted">{t("home.nextRace")}</p>
      <h2 id="home-next" className="text-2xl font-bold">
        <Link to={`/events/${event.id}`} className="hover:underline">
          {eventName(event.name, locale)}
        </Link>
      </h2>
      <p className="text-muted">
        {event.circuit.name} · {countryName(event.circuit.country, locale)}
      </p>
      <p>
        <span className="font-bold">{f.date(event.race_date)}</span>{" "}
        <span className="text-mark-text">({relative.format(days, "day")})</span>
      </p>
    </section>
  );
}

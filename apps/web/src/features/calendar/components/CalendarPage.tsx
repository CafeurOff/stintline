import { Link, useNavigate, useParams } from "react-router";

import { DriverName } from "@/components/hub/DriverName";
import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useSeasonEvents } from "@/features/hub/api";
import { useCurrentSeason } from "@/features/hub/useCurrentSeason";
import { timedSessions } from "@/features/session-picker/useRaces";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";

/** Every Grand Prix of a season, with its winner and a way into the race replay. */
export function CalendarPage() {
  const { t, f, locale } = useI18n();
  const navigate = useNavigate();
  const params = useParams();
  const current = useCurrentSeason();
  const fromUrl = params.year && /^\d{4}$/.test(params.year) ? Number(params.year) : null;
  const year = fromUrl ?? current.season;
  const events = useSeasonEvents(year);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title={year === null ? t("calendar.title") : t("calendar.season", { year })}
        actions={
          <SeasonSelect
            value={year}
            onChange={(value) => {
              if (value !== null) void navigate(`/calendar/${value}`);
            }}
          />
        }
      >
        {t("calendar.intro")}
      </PageHeader>
      {events.isError ? (
        <ErrorState error={events.error} onRetry={() => void events.refetch()} />
      ) : !events.data ? (
        <Skeleton className="h-96" />
      ) : events.data.results.length === 0 ? (
        <EmptyState title={t("calendar.empty")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">{t("calendar.season", { year: year ?? "" })}</caption>
            <thead>
              <tr>
                <th className="num">{t("col.round")}</th>
                <th>{t("col.date")}</th>
                <th>{t("col.grandPrix")}</th>
                <th className="hidden md:table-cell">{t("col.circuit")}</th>
                <th>{t("col.winner")}</th>
                <th>
                  <span className="sr-only">{t("col.replay")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {events.data.results.map((event) => {
                const race = timedSessions(event).find((s) => s.kind === "R");
                const upcoming = event.race_date >= today && !event.winner;
                return (
                  <tr key={event.id} className={upcoming ? "text-muted" : ""}>
                    <td className="num text-muted">{event.round}</td>
                    <td className="whitespace-nowrap">{f.date(event.race_date)}</td>
                    <td>
                      <Link to={`/events/${event.id}`} className="font-semibold hover:underline">
                        {eventName(event.name, locale)}
                      </Link>
                      {event.format === "sprint" && (
                        <span className="ml-2 text-xs text-muted">{t("picker.sprint")}</span>
                      )}
                    </td>
                    <td className="hidden text-muted md:table-cell">
                      {event.circuit.locality} · {countryName(event.circuit.country, locale)}
                    </td>
                    <td>
                      {event.winner ? (
                        <DriverName
                          driver={event.winner.driver}
                          colour={event.winner.team_colour}
                          avatar="xs"
                        />
                      ) : (
                        <span className="text-sm">{upcoming ? t("picker.upcoming") : "—"}</span>
                      )}
                    </td>
                    <td className="text-right">
                      {race && (
                        <Link
                          to={`/sessions/${race.id}`}
                          className="text-sm font-semibold whitespace-nowrap text-mark-text hover:underline"
                          aria-label={t("calendar.replayOf", {
                            name: eventName(event.name, locale),
                          })}
                        >
                          {t("col.replay")} →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

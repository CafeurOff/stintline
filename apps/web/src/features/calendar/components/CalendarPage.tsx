import { useNavigate, useParams } from "react-router";

import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useSeasonEvents } from "@/features/hub/api";
import { useCurrentSeason } from "@/features/hub/useCurrentSeason";
import { useI18n } from "@/lib/i18n/context";
import { useNow } from "@/lib/useNow";

import { GrandPrixCard } from "./GrandPrixCard";

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
              <GrandPrixCard event={event} isNext={event.id === nextId} now={now} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

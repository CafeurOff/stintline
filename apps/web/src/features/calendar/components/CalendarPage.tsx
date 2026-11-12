import { useNavigate, useParams } from "react-router";

import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useSeasonEvents } from "@/features/hub/api";
import { useCurrentSeason } from "@/features/hub/useCurrentSeason";
import { useI18n } from "@/lib/i18n/context";
import { useNow } from "@/lib/useNow";
import type { Schema } from "@stintline/api-types";
import { KeyFigures } from "@/components/hub/KeyFigures";

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
        <div className="flex flex-col gap-4">
          <SeasonFigures events={list} />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {list.map((event) => (
              <li key={event.id}>
                <GrandPrixCard event={event} isNext={event.id === nextId} now={now} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** The season at a glance: rounds run, sprints, different winners, the most wins. */
function SeasonFigures({ events }: { events: readonly Schema<"Event">[] }) {
  const { t } = useI18n();
  const wins = new Map<string, { name: string; count: number }>();
  for (const event of events) {
    const w = event.winner;
    if (!w) continue;
    const entry = wins.get(w.driver.ref) ?? { name: w.driver.family_name, count: 0 };
    entry.count += 1;
    wins.set(w.driver.ref, entry);
  }
  const top = [...wins.values()].sort((a, b) => b.count - a.count)[0];
  const done = events.filter((e) => e.winner).length;
  return (
    <KeyFigures
      label={t("calendar.figures")}
      figures={[
        { label: t("calendar.fig.run"), value: `${String(done)} / ${String(events.length)}` },
        {
          label: t("calendar.fig.sprints"),
          value: events.filter((e) => e.format === "sprint").length,
        },
        { label: t("calendar.fig.winners"), value: wins.size },
        {
          label: t("calendar.fig.mostWins"),
          value: top ? `${top.name} · ${String(top.count)}` : "—",
        },
      ]}
    />
  );
}

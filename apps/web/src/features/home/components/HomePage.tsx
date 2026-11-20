import type { Schema } from "@stintline/api-types";

import { Skeleton, SkeletonTiles } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useReport } from "@/features/news/api";
import { useI18n } from "@/lib/i18n/context";
import { useHome, useSeasonEvents } from "@/lib/queries";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

import { FactsCard } from "./FactsCard";
import { LastRaceCard } from "./LastRaceCard";
import { LeaderCard } from "./LeaderCard";
import { NewsCard } from "./NewsCard";
import { NextRaceHero } from "./NextRace";
import { RacesCard } from "./RacesCard";
import { StandingsCards } from "./StandingsCards";
import { WIDGETS_GRID, Widgets } from "./Widgets";

/**
 * Home page: the next Grand Prix in a hero with its countdown and our circuit figures, the
 * last race around its winner, key figures as widgets, both championships, the facts, the
 * news and the season's races.
 */
export function HomePage() {
  const { t } = useI18n();
  const home = useHome();
  useDocumentTitle(null);

  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;
  if (!home.data) return <Skeleton className="h-[70vh] rounded-[20px]" />;
  if (!home.data.last_race && !home.data.next_event) {
    return (
      <EmptyState title={t("home.empty.title")}>
        <p>{t("home.empty.body")}</p>
      </EmptyState>
    );
  }
  return <Dashboard home={home.data} />;
}

function Dashboard({ home }: { home: Schema<"Home"> }) {
  const { t } = useI18n();
  const { last_race: last, next_event: next, season } = home;
  const reportQuery = useReport(last?.session_id ?? 0, last !== null);
  const report = reportQuery.data ?? null;
  const events = useSeasonEvents(season).data?.results ?? [];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">{t("home.title")}</h1>
      {next && <NextRaceHero event={next} />}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {last && <LastRaceCard race={last} report={report} />}
        {home.drivers.length > 1 && <LeaderCard lines={home.drivers} season={season} />}
      </div>

      {report && <Widgets report={report} />}
      {last && reportQuery.isPending && <SkeletonTiles className={WIDGETS_GRID} tile="h-44" />}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {season !== null && <StandingsCards season={season} />}
        {report && <FactsCard report={report} />}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <NewsCard />
        {events.length > 0 && season !== null && (
          <RacesCard season={season} events={events} nextId={next?.id ?? null} />
        )}
      </div>
    </div>
  );
}

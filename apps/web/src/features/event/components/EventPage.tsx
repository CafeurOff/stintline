import { useParams } from "react-router";
import { ListOrdered } from "lucide-react";

import { Panel } from "@/components/layout/Panel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton, SkeletonTiles } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { WeekendForecast } from "@/features/forecast/components/WeekendForecast";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { useReport } from "@/features/news/api";
import { useDecisions } from "@/features/paddock/api";
import type { LapMark } from "@/features/race-analysis/components/LapChart";
import { RaceAnalysis } from "@/features/race-analysis/components/RaceAnalysis";
import {
  ClimberTile,
  FactsPanel,
  FastestLapTile,
  FastestStopTile,
  RaceControlTile,
} from "@/features/race-facts/RaceFacts";
import { useSessionDetail } from "@/features/race/api";
import { byFinish } from "@/features/race/entries";
import { ApiError } from "@/lib/errors";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { useEvent } from "@/lib/queries";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useSearchParamsState } from "@/lib/useSearchParam";

import { GoFurther, RacePreview, ResultFacts } from "./EventExtras";
import { EventHero } from "./EventHero";
import { type Kind, SessionResults } from "./SessionResults";
import { StewardsPanel } from "./StewardsPanel";
import { WeekendSessions } from "./WeekendSessions";

const RESULT_KINDS: readonly Kind[] = ["R", "SPRINT", "Q"];

/** A Grand Prix weekend: results of the race, sprint and qualifying, and the replay. */
export function EventPage() {
  const { eventId } = useParams();
  const id = eventId && /^\d+$/.test(eventId) ? Number(eventId) : null;
  if (id === null) return <NotFoundPage />;
  return <EventLoader eventId={id} />;
}

function EventLoader({ eventId }: { eventId: number }) {
  const { t, locale } = useI18n();
  const event = useEvent(eventId);
  const [params, update] = useSearchParamsState();
  useDocumentTitle(
    event.data ? `${eventName(event.data.name, locale)} ${String(event.data.season)}` : null,
  );

  if (event.error instanceof ApiError && event.error.status === 404) return <NotFoundPage />;
  if (event.isError) return <ErrorState error={event.error} onRetry={() => void event.refetch()} />;
  if (!event.data) return <Skeleton className="h-[60vh]" />;
  const data = event.data;

  const sessions = RESULT_KINDS.map((kind) => data.sessions.find((s) => s.kind === kind)).filter(
    (s): s is (typeof data.sessions)[number] => s !== undefined,
  );
  const wanted = params.get("session");
  const shown = sessions.find((s) => s.kind === wanted) ?? sessions[0];
  const replays = sessions.filter((s) => s.has_data && (s.kind === "R" || s.kind === "SPRINT"));
  const race = sessions.find((s) => s.kind === "R");
  /** Before the race: a preview of the circuit takes the wide column. */
  const upcoming = data.winner === null && data.race_date >= new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <EventHero event={data} replays={replays} raceId={race?.id ?? null} />
      <WeekendSessions sessions={data.sessions} />
      <WeekendForecast eventId={data.id} />
      {race?.has_data && <RaceFigures sessionId={race.id} />}
      <div className="grid gap-4 xl:grid-cols-3">
        {!shown ? (
          <EmptyState title={t("event.noResults")} />
        ) : (
          <Panel
            id="event-results"
            title={t("event.results")}
            icon={<ListOrdered />}
            className={upcoming ? "xl:order-2" : "xl:col-span-2"}
            action={
              sessions.length > 1 && (
                <SegmentedControl
                  legend={t("event.session")}
                  hideLegend
                  options={sessions.map((s) => ({
                    value: s.kind,
                    label: t(`kind.${s.kind as Kind}`),
                  }))}
                  value={shown.kind}
                  onChange={(value) => {
                    update({ session: value === sessions[0]?.kind ? null : value });
                  }}
                />
              )
            }
          >
            <SessionResults key={shown.id} sessionId={shown.id} kind={shown.kind as Kind} />
          </Panel>
        )}
        {race?.has_data && <RaceFactsColumn sessionId={race.id} />}
        {race && !race.has_data && !upcoming && <ResultFacts sessionId={race.id} />}
        {upcoming && (
          <div className={shown ? "xl:order-1 xl:col-span-2" : "xl:col-span-3"}>
            <RacePreview circuitRef={data.circuit.ref} />
          </div>
        )}
      </div>
      {!upcoming && (
        <GoFurther
          season={data.season}
          round={data.round}
          eventId={data.id}
          circuitRef={data.circuit.ref}
          raceId={race?.id ?? null}
          timed={race?.has_data === true}
        />
      )}
      <StewardsPanel eventId={data.id} season={data.season} />
      {shown && shown.has_data && shown.kind !== "Q" && (
        <div className="glass rounded-[20px] p-5">
          <AnalysisLoader
            key={`analysis-${String(shown.id)}`}
            sessionId={shown.id}
            eventId={data.id}
          />
        </div>
      )}
    </div>
  );
}

const FIGURES_GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";

/** The race in tiles: fastest stop, biggest climber, fastest lap, race control. */
function RaceFigures({ sessionId }: { sessionId: number }) {
  const { data: report, isPending } = useReport(sessionId);
  if (isPending) return <SkeletonTiles className={FIGURES_GRID} tile="h-[170px]" />;
  if (!report) return null;
  return (
    <div className={FIGURES_GRID}>
      {report.pit_stops?.fastest && <FastestStopTile report={report} />}
      {report.biggest_gain && <ClimberTile entry={report.biggest_gain} />}
      {report.fastest_lap && <FastestLapTile entry={report.fastest_lap} />}
      <RaceControlTile report={report} />
    </div>
  );
}

function RaceFactsColumn({ sessionId }: { sessionId: number }) {
  const report = useReport(sessionId).data;
  const { t } = useI18n();
  return report ? (
    <FactsPanel report={report} limit={Number.POSITIVE_INFINITY} title={t("event.facts")} />
  ) : null;
}

function AnalysisLoader({ sessionId, eventId }: { sessionId: number; eventId: number }) {
  const { t } = useI18n();
  const session = useSessionDetail(sessionId);
  const decisions = useDecisions({ event: eventId });
  if (!session.data) return null;
  const marks: LapMark[] = (decisions.data ?? []).flatMap((d) =>
    d.session_id === sessionId && d.lap != null && d.car_number != null
      ? [
          {
            key: String(d.document_id),
            car: d.car_number,
            lap: d.lap,
            label: t("event.markLabel", {
              driver: d.driver?.code ?? d.driver_name ?? "",
              lap: d.lap,
              fact: d.fact ?? "",
            }),
          },
        ]
      : [],
  );
  const entries = [...session.data.entries].sort(byFinish);
  return (
    <RaceAnalysis
      sessionId={sessionId}
      entries={entries}
      neutralisations={session.data.neutralisations}
      totalLaps={session.data.total_laps ?? 0}
      marks={marks}
    />
  );
}

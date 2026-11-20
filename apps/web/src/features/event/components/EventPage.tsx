import type { Schema } from "@stintline/api-types";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router";

import { ListOrdered, Play, Scale } from "lucide-react";

import { pillGlass, pillPrimary } from "@/components/layout/Glass";
import { TrackMap } from "@/components/layout/TrackMap";
import { Trails } from "@/components/layout/Trails";
import { Bust } from "@/components/racing/Bust";
import { Panel } from "@/components/layout/Panel";
import { ShowAll } from "@/components/hub/Collapsible";
import { DriverName } from "@/components/hub/DriverName";
import { useCollapsed } from "@/components/hub/useCollapsed";
import { Flag } from "@/components/racing/Flag";
import { GridSlot, ResultPosition } from "@/components/racing/ResultStatus";
import { useOutText } from "@/lib/useOutText";
import { TeamName } from "@/components/hub/TeamName";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton, SkeletonTiles } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { useEvent } from "@/lib/queries";
import {
  ClimberTile,
  FactsPanel,
  FastestLapTile,
  FastestStopTile,
  RaceControlTile,
} from "@/features/race-facts/RaceFacts";
import { useReport } from "@/features/news/api";
import { GoFurther, RacePreview, ResultFacts } from "./EventExtras";
import { teamColour } from "@/lib/teams";
import { circuitAccent } from "@/lib/accent";
import { readable } from "@/lib/colour";
import type { LapMark } from "@/features/race-analysis/components/LapChart";
import { RaceAnalysis } from "@/features/race-analysis/components/RaceAnalysis";
import { WeekendForecast } from "@/features/forecast/components/WeekendForecast";
import { useDecisions } from "@/features/paddock/api";
import { DecisionTable } from "@/features/paddock/components/DecisionTable";
import { useSessionDetail } from "@/features/race/api";
import { byFinish } from "@/features/race/entries";
import { ApiError } from "@/lib/errors";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { useSearchParamsState } from "@/lib/useSearchParam";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

type Entry = Schema<"Entry">;
type Kind = "R" | "SPRINT" | "Q";
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

function EventHero({
  event,
  replays,
  raceId,
}: {
  event: Schema<"Event">;
  replays: Schema<"Event">["sessions"];
  raceId: number | null;
}) {
  const { t, f, locale } = useI18n();
  const podium = useSessionDetail(raceId ?? 0, raceId !== null);
  const top3 = [...(podium.data?.entries ?? [])]
    .sort(byFinish)
    .filter((e) => e.finish_position != null)
    .slice(0, 3);
  const accent = circuitAccent(event.circuit.ref);
  const glow = top3[0] ? teamColour(top3[0].team_colour) : accent;

  return (
    <header
      className="glass glow relative overflow-hidden rounded-[24px]"
      style={{ "--glow": glow, "--glow-x": "70%", "--glow-y": "100%" } as CSSProperties}
    >
      <Trails colour={glow} className="opacity-70" />
      <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-end xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_15rem]">
        <div className="flex flex-col gap-5 self-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-muted">
              <Flag country={event.circuit.country} className="text-base" />
              <Link to={`/calendar/${String(event.season)}`} className="hover:underline">
                {t("event.eyebrow", { season: event.season, round: event.round })}
              </Link>
            </p>
            <h1 className="display mt-2 text-4xl leading-[0.95] sm:text-6xl">
              {eventName(event.name, locale)}
            </h1>
            <p className="mt-3 font-bold" style={{ color: readable(accent) }}>
              {event.circuit.name}
            </p>
            <p className="text-sm text-muted">
              {event.circuit.locality}, {countryName(event.circuit.country, locale)} ·{" "}
              {f.date(event.race_date)}
            </p>
          </div>
          {replays.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {replays.map((s) => (
                <Link
                  key={s.id}
                  to={`/sessions/${String(s.id)}`}
                  className={s.kind === "R" ? pillPrimary : pillGlass}
                >
                  <Play aria-hidden="true" className="size-4 fill-current" />
                  {s.kind === "R" ? t("event.replay") : t("event.replaySprint")}
                </Link>
              ))}
            </div>
          )}
        </div>
        {top3.length > 0 ? (
          <ol aria-label={t("home.podium")} className="grid grid-cols-3 items-end gap-3">
            {[1, 0, 2].map((index) => {
              const entry = top3[index];
              if (!entry) return <li key={index} />;
              const colour = teamColour(entry.team_colour);
              return (
                <li key={entry.car_number}>
                  <Link
                    to={`/drivers/${entry.driver.ref}`}
                    className="group glass glow relative flex flex-col overflow-hidden rounded-[20px]"
                    style={
                      { "--glow": colour, "--glow-x": "50%", "--glow-y": "100%" } as CSSProperties
                    }
                  >
                    <Bust
                      url={entry.media?.driver_image_url ?? entry.driver.photo_url}
                      label={entry.driver.code ?? entry.driver.family_name.slice(0, 3)}
                      colour={entry.team_colour}
                      className={`w-full transition-transform duration-500 group-hover:scale-[1.03] ${
                        index === 0 ? "h-60" : "h-48"
                      }`}
                    />
                    <span
                      aria-hidden="true"
                      className="num timing absolute top-2 left-3 text-5xl leading-none"
                    >
                      {index + 1}
                    </span>
                    <span className="relative -mt-6 flex flex-col px-2.5 pb-4 leading-tight sm:px-4">
                      <span className="display truncate text-base">
                        <span className="sm:hidden" title={entry.driver.family_name}>
                          {entry.driver.code ?? entry.driver.family_name}
                        </span>
                        <span className="hidden sm:inline">{entry.driver.family_name}</span>
                      </span>
                      <span
                        className="truncate text-xs font-bold"
                        style={{ color: readable(colour) }}
                      >
                        {entry.team.name}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : event.winner !== null && podium.isPending ? (
          // The podium's height, held while the race loads so the page below stays put.
          <Skeleton className="h-[17rem]" />
        ) : (
          <span />
        )}
        {event.circuit.outline && (
          <TrackMap
            path={event.circuit.outline}
            colour={accent}
            className="hidden aspect-square w-full self-center xl:block"
          />
        )}
      </div>
    </header>
  );
}

/** Races first, then qualifying and practice: what changed the result comes first. */
const DECISION_ORDER = ["R", "SPRINT", "Q", "SQ", "FP3", "FP2", "FP1"];
/** Decisions shown before "show all": a weekend can have forty. */
const DECISIONS_SHOWN = 8;

function decisionRank(kind: string | null | undefined): number {
  const index = DECISION_ORDER.indexOf(kind ?? "");
  return index === -1 ? DECISION_ORDER.length : index;
}

/** Stewards' decisions of the weekend (ADR 0018); nothing when there are none. */
function StewardsPanel({ eventId, season }: { eventId: number; season: number }) {
  const { t } = useI18n();
  const decisions = useDecisions({ event: eventId });
  const sorted = [...(decisions.data ?? [])].sort(
    (a, b) => decisionRank(a.session_kind) - decisionRank(b.session_kind),
  );
  const collapsed = useCollapsed(sorted, DECISIONS_SHOWN);
  if (sorted.length === 0) return null;
  return (
    <Panel
      title={t("docs.decisions")}
      icon={<Scale />}
      action={
        <Link
          to={`/documents?season=${String(season)}&event=${String(eventId)}`}
          className="text-sm font-semibold text-muted hover:text-ink"
        >
          {t("event.allDocuments")}
        </Link>
      }
    >
      <DecisionTable decisions={collapsed.shown} />
      {collapsed.hidden > 0 || collapsed.open ? (
        <div className="flex px-5 pt-1 pb-5">
          <ShowAll
            hidden={collapsed.hidden}
            open={collapsed.open}
            onToggle={() => {
              collapsed.setOpen(!collapsed.open);
            }}
          />
        </div>
      ) : null}
    </Panel>
  );
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

function SessionResults({ sessionId, kind }: { sessionId: number; kind: Kind }) {
  const { t } = useI18n();
  const session = useSessionDetail(sessionId);
  if (session.isError) {
    return <ErrorState error={session.error} onRetry={() => void session.refetch()} />;
  }
  if (!session.data) return <Skeleton className="h-96" />;
  const entries = [...session.data.entries].sort(byFinish);
  if (entries.length === 0) return <EmptyState title={t("event.noResults")} />;
  return kind === "Q" ? <QualifyingTable entries={entries} /> : <RaceTable entries={entries} />;
}

function RaceTable({ entries }: { entries: Entry[] }) {
  const { t, f } = useI18n();
  const outText = useOutText();
  const winner = entries[0];
  const gap = (entry: Entry): string => {
    if (!winner) return "";
    if (entry === winner) return f.lapTime(entry.race_time_s);
    const out = outText(entry.classification, entry.status);
    if (out !== null) return out;
    // Lapped cars also have a time (for fewer laps): the gap is in laps, not seconds.
    const down = (winner.laps_completed ?? 0) - (entry.laps_completed ?? 0);
    if (entry.finish_position != null && down > 0) {
      return t(down === 1 ? "event.lapDown" : "event.lapsDown", { n: down });
    }
    if (entry.race_time_s != null && winner.race_time_s != null) {
      return `+${f.seconds(entry.race_time_s - winner.race_time_s, 3)}`;
    }
    return entry.status ?? "";
  };
  return (
    <div className="overflow-x-auto">
      <table className="data-table text-sm">
        <thead>
          <tr>
            <th className="num">{t("col.position")}</th>
            <th>{t("col.driver")}</th>
            <th className="hidden sm:table-cell">{t("col.team")}</th>
            <th className="num hidden md:table-cell">{t("col.grid")}</th>
            <th className="num hidden md:table-cell">{t("col.laps")}</th>
            <th className="num">{t("col.time")}</th>
            <th className="num">{t("col.points")}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.car_number}>
              <td className="num font-bold">
                <ResultPosition
                  classification={entry.classification}
                  position={entry.finish_position}
                />
              </td>
              <td>
                <DriverName
                  driver={entry.driver}
                  colour={entry.team_colour}
                  imageUrl={entry.media?.driver_image_url}
                />
                {entry.fastest_lap_rank === 1 && (
                  <span
                    className="ml-2 rounded bg-raised px-1.5 py-0.5 text-xs font-semibold"
                    title={t("event.fastestLap")}
                  >
                    {t("event.fastestLapShort")}
                    <span className="sr-only"> {t("event.fastestLap")}</span>
                  </span>
                )}
              </td>
              <td className="hidden sm:table-cell">
                <TeamName team={entry.team} colour={entry.team_colour} />
              </td>
              <td className="num hidden text-muted md:table-cell">
                <GridSlot grid={entry.grid_position} />
              </td>
              <td className="num hidden text-muted md:table-cell">{entry.laps_completed}</td>
              <td className="num whitespace-nowrap">{gap(entry)}</td>
              <td className="num font-semibold">{entry.points ? f.number(entry.points, 0) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QualifyingTable({ entries }: { entries: Entry[] }) {
  const { t, f } = useI18n();
  return (
    <div className="overflow-x-auto">
      <table className="data-table text-sm">
        <thead>
          <tr>
            <th className="num">{t("col.position")}</th>
            <th>{t("col.driver")}</th>
            <th className="hidden sm:table-cell">{t("col.team")}</th>
            <th className="num">Q1</th>
            <th className="num">Q2</th>
            <th className="num">Q3</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.car_number}>
              <td className="num font-bold">{entry.finish_position ?? "—"}</td>
              <td>
                <DriverName driver={entry.driver} colour={entry.team_colour} />
              </td>
              <td className="hidden sm:table-cell">
                <TeamName team={entry.team} colour={entry.team_colour} />
              </td>
              <td className="num">{entry.q1_s == null ? "" : f.lapTime(entry.q1_s)}</td>
              <td className="num">{entry.q2_s == null ? "" : f.lapTime(entry.q2_s)}</td>
              <td className="num">{entry.q3_s == null ? "" : f.lapTime(entry.q3_s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

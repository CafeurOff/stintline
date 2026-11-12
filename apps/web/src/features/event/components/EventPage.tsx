import type { Schema } from "@stintline/api-types";
import { Link, useParams } from "react-router";

import { ListOrdered, Play } from "lucide-react";

import { NO_BACKDROP } from "@/components/dash/backdrop";
import { Face } from "@/components/dash/Face";
import { Panel } from "@/components/dash/Panel";
import { DriverName } from "@/components/hub/DriverName";
import { CircuitMark } from "@/components/racing/CircuitMark";
import { Flag } from "@/components/racing/Flag";
import { CircuitOutline } from "@/components/racing/CircuitOutline";
import { TeamName } from "@/components/hub/TeamName";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { useEvent } from "@/features/hub/api";
import {
  ClimberTile,
  FactsPanel,
  FastestLapTile,
  FastestStopTile,
  RaceControlTile,
} from "@/features/hub/RaceFacts";
import { useReport } from "@/features/news/api";
import { inkOn, teamColour, teamTint } from "@/lib/teams";
import { RaceAnalysis } from "@/features/analysis/components/RaceAnalysis";
import { useSessionDetail, useTrack } from "@/features/race/api";
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

  return (
    <div className="flex flex-col gap-4">
      <EventHero event={data} replays={replays} raceId={race?.id ?? null} />
      {race?.has_data && <RaceFigures sessionId={race.id} />}
      <div className="grid gap-4 xl:grid-cols-3">
        {!shown ? (
          <EmptyState title={t("event.noResults")} />
        ) : (
          <Panel
            id="event-results"
            title={t("event.results")}
            icon={<ListOrdered />}
            className="xl:col-span-2"
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
      </div>
      {shown && shown.has_data && shown.kind !== "Q" && (
        <div className="rounded-xl border border-line bg-panel p-5">
          <AnalysisLoader key={`analysis-${String(shown.id)}`} sessionId={shown.id} />
        </div>
      )}
    </div>
  );
}

/** The race in tiles: fastest stop, biggest climber, fastest lap, race control. */
function RaceFigures({ sessionId }: { sessionId: number }) {
  const report = useReport(sessionId).data;
  if (!report) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
  const track = useTrack(raceId ?? 0, raceId !== null);
  const podium = useSessionDetail(raceId ?? 0, raceId !== null);
  const top3 = [...(podium.data?.entries ?? [])]
    .sort(byFinish)
    .filter((e) => e.finish_position != null)
    .slice(0, 3);

  return (
    <header className="relative grid gap-6 overflow-hidden rounded-xl border border-line bg-panel p-5 sm:p-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_14rem] lg:items-end">
      <div className="flex flex-col gap-4 self-center">
        <div>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Flag country={event.circuit.country} className="text-base" />
            <Link to={`/calendar/${String(event.season)}`} className="hover:underline">
              {t("event.eyebrow", { season: event.season, round: event.round })}
            </Link>
          </p>
          <h1 className="mt-1 text-4xl leading-none font-extrabold sm:text-5xl">
            {eventName(event.name, locale)}
          </h1>
          <p className="mt-2 text-muted">
            {event.circuit.name} · {event.circuit.locality},{" "}
            {countryName(event.circuit.country, locale)} · {f.date(event.race_date)}
          </p>
        </div>
        {replays.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {replays.map((s) => (
              <Link
                key={s.id}
                to={`/sessions/${String(s.id)}`}
                className={
                  s.kind === "R"
                    ? "inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2.5 font-semibold text-white hover:brightness-110"
                    : "inline-flex items-center gap-2 rounded-lg border border-line-strong bg-raised px-4 py-2.5 font-semibold hover:border-ink"
                }
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
                  className="group flex flex-col overflow-hidden rounded-lg"
                  style={{ backgroundColor: teamTint(entry.team_colour, 30) }}
                >
                  <Face
                    url={entry.media?.driver_image_url ?? entry.driver.photo_url}
                    label={entry.driver.code ?? entry.driver.family_name.slice(0, 3)}
                    colour={entry.team_colour}
                    className={`w-full text-2xl ${index === 0 ? "h-48" : "h-40"}`}
                    style={NO_BACKDROP}
                  />
                  <span
                    className="flex items-center gap-2 px-2.5 py-2"
                    style={{ backgroundColor: colour, color: inkOn(colour) }}
                  >
                    <span className="num font-bold">{index + 1}</span>
                    <span className="truncate text-sm font-extrabold uppercase group-hover:underline">
                      {entry.driver.family_name}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <span />
      )}
      {track.data ? (
        <CircuitOutline track={track.data} className="hidden h-48 w-full self-center lg:block" />
      ) : (
        event.circuit.outline && (
          <CircuitMark
            path={event.circuit.outline}
            width={3}
            className="hidden h-48 w-full self-center lg:block"
          />
        )
      )}
    </header>
  );
}

function AnalysisLoader({ sessionId }: { sessionId: number }) {
  const session = useSessionDetail(sessionId);
  if (!session.data) return null;
  const entries = [...session.data.entries].sort(byFinish);
  return (
    <RaceAnalysis
      sessionId={sessionId}
      entries={entries}
      neutralisations={session.data.neutralisations}
      totalLaps={session.data.total_laps ?? 0}
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
  const winner = entries[0];
  const gap = (entry: Entry): string => {
    if (!winner) return "";
    if (entry === winner) return f.lapTime(entry.race_time_s);
    // Lapped cars also have a time (for fewer laps): the gap is in laps, not seconds.
    const down = (winner.laps_completed ?? 0) - (entry.laps_completed ?? 0);
    if (entry.finish_position != null && down > 0) {
      return t(down === 1 ? "event.lapDown" : "event.lapsDown", { n: down });
    }
    if (entry.race_time_s != null && winner.race_time_s != null) {
      return `+${f.number(entry.race_time_s - winner.race_time_s, 3)}`;
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
              <td className="num font-bold">{entry.classification ?? entry.finish_position}</td>
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
                {entry.grid_position === 0 ? "—" : (entry.grid_position ?? "—")}
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

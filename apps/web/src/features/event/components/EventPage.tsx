import type { Schema } from "@stintline/api-types";
import { Link, useParams } from "react-router";

import { DriverName } from "@/components/hub/DriverName";
import { CircuitOutline } from "@/components/racing/CircuitOutline";
import { TeamName } from "@/components/hub/TeamName";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { useEvent } from "@/features/hub/api";
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
    <div className="flex flex-col gap-10">
      <EventHero event={data} replays={replays} raceId={race?.id ?? null} />
      {!shown ? (
        <EmptyState title={t("event.noResults")} />
      ) : (
        <section aria-labelledby="event-results" className="flex flex-col gap-4">
          <h2 id="event-results" className="text-2xl font-bold">
            {t("event.results")}
          </h2>
          {sessions.length > 1 && (
            <SegmentedControl
              legend={t("event.session")}
              hideLegend
              options={sessions.map((s) => ({ value: s.kind, label: t(`kind.${s.kind as Kind}`) }))}
              value={shown.kind}
              onChange={(value) => {
                update({ session: value === sessions[0]?.kind ? null : value });
              }}
            />
          )}
          <SessionResults key={shown.id} sessionId={shown.id} kind={shown.kind as Kind} />
        </section>
      )}
      {shown && shown.has_data && shown.kind !== "Q" && (
        <AnalysisLoader key={`analysis-${String(shown.id)}`} sessionId={shown.id} />
      )}
    </div>
  );
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
    <header className="grid gap-8 rounded-3xl bg-panel p-6 sm:p-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-muted">
            <Link to={`/calendar/${String(event.season)}`} className="hover:underline">
              {t("event.eyebrow", { season: event.season, round: event.round })}
            </Link>
          </p>
          <h1 className="text-4xl leading-none font-bold sm:text-6xl">
            {eventName(event.name, locale)}
          </h1>
          <p className="mt-2 text-muted">
            {event.circuit.name} · {event.circuit.locality},{" "}
            {countryName(event.circuit.country, locale)} · {f.date(event.race_date)}
          </p>
        </div>
        {top3.length > 0 && (
          <ol aria-label={t("home.podium")} className="flex flex-wrap gap-x-6 gap-y-3">
            {top3.map((entry, index) => (
              <li key={entry.car_number} className="flex items-center gap-3">
                <span className="text-2xl font-bold text-muted tabular-nums">{index + 1}</span>
                <DriverName
                  driver={entry.driver}
                  colour={entry.team_colour}
                  imageUrl={entry.media?.driver_image_url}
                />
              </li>
            ))}
          </ol>
        )}
        {replays.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {replays.map((s) => (
              <Link
                key={s.id}
                to={`/sessions/${String(s.id)}`}
                className={
                  s.kind === "R"
                    ? "rounded-lg bg-action px-4 py-3 font-bold text-white hover:brightness-110"
                    : "rounded-lg border border-line-strong px-4 py-3 font-bold hover:border-ink"
                }
              >
                {s.kind === "R" ? t("event.replay") : t("event.replaySprint")}
              </Link>
            ))}
          </div>
        )}
      </div>
      {track.data && (
        <CircuitOutline track={track.data} className="h-48 w-full self-center lg:h-64" />
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
      <table className="data-table">
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
      <table className="data-table">
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

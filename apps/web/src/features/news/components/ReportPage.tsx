import type { CSSProperties } from "react";
import type { Schema } from "@stintline/api-types";
import { Link, useParams } from "react-router";

import { DriverName } from "@/components/racing/DriverName";
import { KeyFigures, type Figure as KeyFigure } from "@/components/layout/KeyFigures";
import { DriverPhoto } from "@/components/racing/DriverPhoto";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useSessionDetail } from "@/features/race/api";
import { eventName } from "@/lib/i18n/content";
import { ResultPosition } from "@/components/racing/ResultStatus";
import { useOutText } from "@/lib/useOutText";
import { useI18n } from "@/lib/i18n/context";
import { Trails } from "@/components/layout/Trails";
import { teamColour } from "@/lib/teams";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

import { useReport, useReports } from "../api";
import { type Report, type Section, writeReport } from "../write";
import { RaceFigures, TelemetryFigure, TyresFigure } from "./ReportFigures";

const OTHER_REPORTS = 6;

/** One race or sprint told like a match report: the story, charts, results, standings. */
export function ReportPage() {
  const { t, f, locale } = useI18n();
  const raw = useParams().sessionId ?? "";
  const sessionId = /^\d+$/.test(raw) ? Number(raw) : 0;
  const report = useReport(sessionId);
  const headline = report.data ? writeReport(report.data, t, f, locale).title : null;
  useDocumentTitle(headline);

  if (report.isError) {
    return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;
  }
  if (!report.data) return <Skeleton className="h-[60vh]" />;
  const data = report.data;
  const written = writeReport(data, t, f, locale);
  const colour = data.winner.team_colour;
  const hasTiming = data.story !== null;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
      <article className="flex min-w-0 flex-col gap-8">
        <header
          className="glass glow relative overflow-hidden rounded-[24px]"
          style={
            {
              "--glow": teamColour(colour),
              "--glow-x": "0%",
              "--glow-y": "100%",
            } as CSSProperties
          }
        >
          <DriverPhoto
            imageUrl={data.winner.driver.portrait_url}
            label={data.winner.driver.code ?? data.winner.car_number}
            colour={colour}
            className="aspect-[16/6] w-full"
          />
          <Trails colour={teamColour(colour)} className="opacity-60" />
          <div className="relative flex flex-col gap-3 p-6 sm:p-8">
            <p className="text-sm font-semibold text-muted">
              {data.kind === "SPRINT" ? t("news.sprint") : t("news.race")} ·{" "}
              <Link to={`/events/${String(data.event.id)}`} className="hover:underline">
                {eventName(data.event.name, locale)}
              </Link>{" "}
              · <time dateTime={data.finished_at}>{f.date(data.event.race_date)}</time>
            </p>
            <h1 className="display text-3xl leading-[1.05] sm:text-5xl">{written.title}</h1>
            <p className="text-lg">{written.lede}</p>
          </div>
        </header>

        <Podium report={data} />
        <Figures report={data} />

        {written.sections.map((section) => (
          <SectionBlock key={section.key} section={section}>
            {section.key === "race" && hasTiming && <TimedFigures report={data} />}
            {section.key === "strategy" && hasTiming && (
              <TyresFigure sessionId={data.session_id} totalLaps={totalLapsOf(data)} />
            )}
          </SectionBlock>
        ))}

        {hasTiming && (
          <TelemetryFigure
            sessionId={data.session_id}
            winner={data.winner}
            second={data.podium[1]?.entry}
          />
        )}

        <Results report={data} />

        <div className="flex flex-wrap gap-3">
          {hasTiming && (
            <Link
              to={`/sessions/${String(data.session_id)}`}
              className="rounded-lg bg-action px-4 py-3 font-bold text-white hover:brightness-110"
            >
              {t("news.replay")}
            </Link>
          )}
          <Link
            to={`/events/${String(data.event.id)}${data.kind === "SPRINT" ? "?session=SPRINT" : ""}`}
            className="glass rounded-xl px-4 py-3 font-bold"
          >
            {t("news.seeResults")}
          </Link>
          <Link to="/news" className="px-4 py-3 font-semibold text-mark-text">
            {t("news.all")} →
          </Link>
        </div>
        <p className="text-sm text-muted">{t("news.generated")}</p>
      </article>
      <aside className="flex flex-col gap-8 self-start" aria-label={t("news.others")}>
        <Standings report={data} />
        <OtherReports current={data.session_id} />
      </aside>
    </div>
  );
}

function totalLapsOf(report: Report): number {
  return Math.max(...report.results.map((r) => r.entry.laps_completed ?? 0), 1);
}

function SectionBlock({ section, children }: { section: Section; children?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby={`report-${section.key}`} className="flex flex-col gap-4">
      <h2 id={`report-${section.key}`} className="text-2xl font-bold">
        {t(`report.section.${section.key}`)}
      </h2>
      <p className="text-lg leading-relaxed">{section.sentences.join(" ")}</p>
      {children}
    </section>
  );
}

function TimedFigures({ report }: { report: Report }) {
  const session = useSessionDetail(report.session_id);
  if (!session.data) return session.isError ? null : <Skeleton className="h-[420px]" />;
  return (
    <RaceFigures
      sessionId={report.session_id}
      entries={session.data.entries}
      totalLaps={session.data.total_laps ?? totalLapsOf(report)}
    />
  );
}

function Podium({ report }: { report: Report }) {
  const { t, f } = useI18n();
  return (
    <ol aria-label={t("home.podium")} className="grid gap-3 sm:grid-cols-3">
      {report.podium.map((place, index) => (
        <li
          key={place.entry.car_number}
          className="glass flex items-center gap-3 rounded-[20px] p-3"
        >
          <span className="text-2xl font-bold tabular-nums">{index + 1}</span>
          <span className="flex min-w-0 flex-col">
            <DriverName driver={place.entry.driver} colour={place.entry.team_colour} />
            <span className="text-sm text-muted tabular-nums">
              {index === 0
                ? place.entry.team.name
                : place.laps_down > 0
                  ? t(place.laps_down === 1 ? "event.lapDown" : "event.lapsDown", {
                      n: place.laps_down,
                    })
                  : place.gap_s == null
                    ? place.entry.team.name
                    : `+${f.seconds(place.gap_s, 3)}`}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Figures({ report }: { report: Report }) {
  const { t, f } = useI18n();
  const figures: KeyFigure[] = [];
  const second = report.podium[1];
  if (second?.gap_s != null) {
    figures.push({ label: t("report.figure.margin"), value: f.seconds(second.gap_s, 3) });
  }
  const led = report.story?.leaders.find((l) => l.entry.car_number === report.winner.car_number);
  if (led) {
    figures.push({
      label: t("report.figure.led", { driver: report.winner.driver.family_name }),
      value: led.laps,
    });
  }
  if (report.pit_stops)
    figures.push({ label: t("report.figure.stops"), value: report.pit_stops.total });
  if (report.weather) {
    figures.push({
      label: t("report.figure.track"),
      value: `${f.number(report.weather.track_max, 0)} °C`,
    });
  }
  figures.push({
    label: t("report.figure.finishers"),
    value: `${String(report.starters - report.retirements.length)}/${String(report.starters)}`,
  });
  return <KeyFigures figures={figures} label={t("report.figures")} />;
}

function Results({ report }: { report: Report }) {
  const { t, f } = useI18n();
  const outText = useOutText();
  return (
    <section aria-labelledby="report-results" className="flex flex-col gap-3">
      <h2 id="report-results" className="text-2xl font-bold">
        {t("report.results")}
      </h2>
      <div className="overflow-x-auto">
        <table className="data-table">
          <caption className="sr-only">{t("report.results")}</caption>
          <thead>
            <tr>
              <th className="num">{t("col.position")}</th>
              <th>{t("col.driver")}</th>
              <th className="hidden sm:table-cell">{t("col.team")}</th>
              <th className="num">{t("report.col.gap")}</th>
              <th className="num">{t("report.col.points")}</th>
            </tr>
          </thead>
          <tbody>
            {report.results.map((line) => (
              <tr key={line.entry.car_number}>
                <td className="num font-bold">
                  {line.position != null && /^\d+$/.test(line.classification) ? (
                    line.position
                  ) : (
                    <ResultPosition classification={line.classification} position={null} />
                  )}
                </td>
                <td>
                  <DriverName
                    driver={line.entry.driver}
                    colour={line.entry.team_colour}
                    avatar="xs"
                  />
                </td>
                <td className="hidden text-muted sm:table-cell">{line.entry.team.name}</td>
                <td className="num">{gapText(line, t, f, outText)}</td>
                <td className="num font-semibold">
                  {line.points > 0 ? f.number(line.points, line.points % 1 ? 1 : 0) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function gapText(
  line: Schema<"ResultLine">,
  t: ReturnType<typeof useI18n>["t"],
  f: ReturnType<typeof useI18n>["f"],
  outText: ReturnType<typeof useOutText>,
): string {
  if (line.position === 1) return "";
  const code = line.classification;
  const out = outText(code, line.entry.status);
  if (out !== null) return out;
  if (!/^\d+$/.test(code)) return line.entry.status ?? code;
  if (line.laps_down > 0) {
    return t(line.laps_down === 1 ? "event.lapDown" : "event.lapsDown", { n: line.laps_down });
  }
  return line.gap_s == null ? "" : `+${f.seconds(line.gap_s, 3)}`;
}

function Standings({ report }: { report: Report }) {
  const { t, f } = useI18n();
  if (report.standings.length === 0) return null;
  return (
    <section aria-labelledby="report-standings" className="flex flex-col gap-3">
      <h2 id="report-standings" className="text-lg font-bold">
        {t("report.standings", { round: report.event.round })}
      </h2>
      <ol className="flex flex-col">
        {report.standings.map((row) => (
          <li key={row.driver.ref} className="flex items-center gap-3 border-b border-line py-2">
            <span className="w-5 text-muted tabular-nums">{row.position}</span>
            <span className="min-w-0 flex-1">
              <DriverName driver={row.driver} avatar="xs" />
            </span>
            <Change value={row.change} />
            <span className="font-bold tabular-nums">
              {f.number(row.points, row.points % 1 ? 1 : 0)}
            </span>
          </li>
        ))}
      </ol>
      <Link
        to={`/standings/${String(report.event.season)}`}
        className="text-sm font-semibold text-mark-text"
      >
        {t("home.allStandings")} →
      </Link>
    </section>
  );
}

function Change({ value }: { value: number | null }) {
  const { t } = useI18n();
  if (!value) return <span className="w-10" />;
  const up = value > 0;
  return (
    <span className={`w-10 text-right text-sm font-semibold ${up ? "text-gain" : "text-loss"}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      {Math.abs(value)}
      <span className="sr-only">
        {" "}
        {t(up ? "report.change.up" : "report.change.down", { n: Math.abs(value) })}
      </span>
    </span>
  );
}

/** The latest other reports, to keep reading. */
function OtherReports({ current }: { current: number }) {
  const { t, f, locale } = useI18n();
  const reports = useReports(OTHER_REPORTS + 1);
  const others = (reports.data ?? [])
    .filter((r) => r.session_id !== current)
    .slice(0, OTHER_REPORTS);
  if (others.length === 0) return null;
  return (
    <section aria-labelledby="report-others" className="flex flex-col gap-3">
      <h2 id="report-others" className="text-lg font-bold">
        {t("news.others")}
      </h2>
      <ul className="flex flex-col">
        {others.map((report) => (
          <li key={report.session_id} className="border-b border-line py-3">
            <Link
              to={`/news/${String(report.session_id)}`}
              className="font-semibold hover:underline"
            >
              {writeReport(report, t, f, locale).title}
            </Link>
            <p className="text-sm text-muted">{f.date(report.event.race_date)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

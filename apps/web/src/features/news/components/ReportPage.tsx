import { Link, useParams } from "react-router";

import { DriverName } from "@/components/hub/DriverName";
import { DriverPhoto } from "@/components/racing/DriverPhoto";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { teamColour, teamTint } from "@/lib/teams";

import { useReport, useReports } from "../api";
import { writeReport } from "../write";

const OTHER_REPORTS = 6;

/** One race or sprint report, with the podium and links to the full data. */
export function ReportPage() {
  const { t, f, locale } = useI18n();
  const raw = useParams().sessionId ?? "";
  const sessionId = /^\d+$/.test(raw) ? Number(raw) : 0;
  const report = useReport(sessionId);

  if (report.isError) {
    return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;
  }
  if (!report.data) return <Skeleton className="h-[60vh]" />;
  const data = report.data;
  const written = writeReport(data, t, f, locale);
  const colour = data.winner.team_colour;
  const hasTiming = data.winner_strategy !== null;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
      <article className="flex max-w-3xl flex-col gap-6">
        <header
          className="overflow-hidden rounded-2xl border-t-4"
          style={{ borderTopColor: teamColour(colour), backgroundColor: teamTint(colour, 12) }}
        >
          <DriverPhoto
            imageUrl={data.winner.driver.portrait_url}
            label={data.winner.driver.code ?? data.winner.car_number}
            colour={colour}
            className="aspect-[16/7] w-full"
          />
          <div className="flex flex-col gap-2 p-6">
            <p className="text-sm text-muted">
              {data.kind === "SPRINT" ? t("news.sprint") : t("news.race")} ·{" "}
              <Link to={`/events/${String(data.event.id)}`} className="hover:underline">
                {eventName(data.event.name, locale)}
              </Link>{" "}
              · <time dateTime={data.finished_at}>{f.date(data.event.race_date)}</time>
            </p>
            <h1 className="text-3xl leading-tight font-bold sm:text-4xl">{written.title}</h1>
            <p className="text-lg">{written.lede}</p>
          </div>
        </header>

        <ol aria-label={t("home.podium")} className="grid gap-3 sm:grid-cols-3">
          {data.podium.map((place, index) => (
            <li
              key={place.entry.car_number}
              className="flex items-center gap-3 rounded-xl bg-panel p-3"
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

        <div className="flex flex-col gap-4 text-lg leading-relaxed">
          {written.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

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
            className="rounded-lg border border-line-strong px-4 py-3 font-bold hover:border-ink"
          >
            {t("news.seeResults")}
          </Link>
          <Link to="/news" className="px-4 py-3 font-semibold text-mark-text">
            {t("news.all")} →
          </Link>
        </div>
        <p className="text-sm text-muted">{t("news.generated")}</p>
      </article>
      <OtherReports current={data.session_id} />
    </div>
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
    <aside aria-labelledby="report-others" className="flex flex-col gap-3 self-start">
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
    </aside>
  );
}

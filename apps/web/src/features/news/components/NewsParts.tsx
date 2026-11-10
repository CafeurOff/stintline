import type { Schema } from "@stintline/api-types";
import { Link } from "react-router";

import { DriverPhoto } from "@/components/racing/DriverPhoto";
import { useI18n } from "@/lib/i18n/context";
import { teamColour, teamTint } from "@/lib/teams";

import { useAgo } from "../useAgo";
import { type Report, writeReport } from "../write";

/**
 * One report as a card tinted with the winner's team colour. The lead card shows a large
 * photo and the opening lines; the others stay compact, with a thumbnail.
 */
export function ReportCard({ report, lead = false }: { report: Report; lead?: boolean }) {
  const { t, f, locale } = useI18n();
  const written = writeReport(report, t, f, locale);
  const winner = report.winner;
  const colour = winner.team_colour;
  return (
    <article
      className={`relative flex overflow-hidden rounded-2xl bg-panel ${
        lead ? "flex-col self-start border-t-4 sm:flex-row" : "items-stretch border-l-4"
      }`}
      style={{
        borderTopColor: teamColour(colour),
        borderLeftColor: teamColour(colour),
        backgroundColor: teamTint(colour, 10),
      }}
    >
      <DriverPhoto
        imageUrl={winner.driver.portrait_url}
        label={winner.driver.code ?? winner.car_number}
        colour={colour}
        className={
          lead ? "aspect-[4/3] w-full sm:w-72 sm:shrink-0" : "w-20 shrink-0 text-xl sm:w-24"
        }
      />
      <div className={`flex min-w-0 flex-col gap-1.5 ${lead ? "p-5" : "px-4 py-3"}`}>
        <p className="text-sm text-muted">
          {report.kind === "SPRINT" ? t("news.sprint") : t("news.race")} ·{" "}
          {f.date(report.event.race_date)}
        </p>
        <h3 className={`leading-tight font-bold ${lead ? "text-2xl sm:text-3xl" : "text-base"}`}>
          <Link
            to={`/news/${String(report.session_id)}`}
            className="after:absolute after:inset-0 hover:underline"
          >
            {written.title}
          </Link>
        </h3>
        {lead && <p className="text-muted">{written.lede}</p>}
      </div>
    </article>
  );
}

/** Headlines as plain links to the publishers' articles (ADR 0012). */
export function HeadlineList({ headlines }: { headlines: readonly Schema<"Headline">[] }) {
  const { t } = useI18n();
  const ago = useAgo();
  return (
    <ul className="flex flex-col">
      {headlines.map((headline) => (
        <li key={headline.url} className="border-b border-line py-3">
          <a
            href={headline.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold hover:underline"
          >
            {headline.title}
            <span className="sr-only"> {t("news.opensNew")}</span>
          </a>
          <p className="mt-0.5 text-sm text-muted">
            {headline.source_name} ·{" "}
            <time dateTime={headline.published_at}>{ago(headline.published_at)}</time>
          </p>
        </li>
      ))}
    </ul>
  );
}

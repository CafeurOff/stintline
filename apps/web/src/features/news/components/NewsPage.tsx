import { PageHeader } from "@/components/hub/PageHeader";
import { SectionTitle } from "@/components/hub/SectionTitle";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useI18n } from "@/lib/i18n/context";
import { useSearchParamsState } from "@/lib/useSearchParam";

import { useHeadlines, useReports } from "../api";
import { ReportCard } from "./NewsParts";
import { NewsWire } from "./NewsWire";

/** The latest report and the eight before it: about two months of racing. */
const REPORTS_SHOWN = 9;
const HEADLINES_SHOWN = 40;

/** Race reports written from our data, and the day's headlines linked to their sources. */
export function NewsPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col">
      <PageHeader title={t("news.title")}>{t("news.intro")}</PageHeader>
      <div className="flex flex-col gap-10">
        <Headlines />
        <Reports />
      </div>
    </div>
  );
}

function Reports() {
  const { t } = useI18n();
  const reports = useReports(REPORTS_SHOWN);
  return (
    <section aria-labelledby="news-reports" className="flex flex-col gap-4">
      <SectionTitle id="news-reports">{t("news.reports")}</SectionTitle>
      {reports.isError ? (
        <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />
      ) : !reports.data ? (
        <Skeleton className="h-96" />
      ) : reports.data.length === 0 ? (
        <EmptyState title={t("news.reports")}>{t("news.noReports")}</EmptyState>
      ) : (
        <>
          {reports.data[0] && <ReportCard report={reports.data[0]} lead />}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {reports.data.slice(1).map((report) => (
              <ReportCard key={report.session_id} report={report} />
            ))}
          </div>
          <p className="text-sm text-muted">{t("news.generated")}</p>
        </>
      )}
    </section>
  );
}

function Headlines() {
  const { t, locale } = useI18n();
  const [params, update] = useSearchParamsState();
  const all = params.get("lang") === "all";
  const headlines = useHeadlines(all ? null : locale, HEADLINES_SHOWN);
  return (
    <section aria-labelledby="news-headlines" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <SectionTitle id="news-headlines">{t("news.headlines")}</SectionTitle>
        </div>
        <SegmentedControl
          legend={t("news.lang")}
          hideLegend
          options={[
            { value: "mine", label: t("news.lang.mine") },
            { value: "all", label: t("news.lang.all") },
          ]}
          value={all ? "all" : "mine"}
          onChange={(value) => {
            update({ lang: value === "all" ? "all" : null });
          }}
        />
      </div>
      {headlines.isError ? (
        <ErrorState error={headlines.error} onRetry={() => void headlines.refetch()} />
      ) : !headlines.data ? (
        <Skeleton className="h-96" />
      ) : headlines.data.length === 0 ? (
        <EmptyState title={t("news.headlines")}>{t("news.noHeadlines")}</EmptyState>
      ) : (
        <NewsWire headlines={headlines.data} />
      )}
      <p className="text-sm text-muted">{t("news.sources")}</p>
    </section>
  );
}

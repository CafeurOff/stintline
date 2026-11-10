import { PageHeader } from "@/components/hub/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useI18n } from "@/lib/i18n/context";
import { useSearchParamsState } from "@/lib/useSearchParam";

import { useHeadlines, useReports } from "../api";
import { HeadlineList, ReportCard } from "./NewsParts";

/** The latest report and the eight before it: about two months of racing. */
const REPORTS_SHOWN = 9;
const HEADLINES_SHOWN = 20;

/** Race reports written from our data, and the day's headlines linked to their sources. */
export function NewsPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("news.title")}>{t("news.intro")}</PageHeader>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Reports />
        <Headlines />
      </div>
    </div>
  );
}

function Reports() {
  const { t } = useI18n();
  const reports = useReports(REPORTS_SHOWN);
  return (
    <section aria-labelledby="news-reports" className="flex flex-col gap-4">
      <h2 id="news-reports" className="text-xl font-bold">
        {t("news.reports")}
      </h2>
      {reports.isError ? (
        <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />
      ) : !reports.data ? (
        <Skeleton className="h-96" />
      ) : reports.data.length === 0 ? (
        <EmptyState title={t("news.reports")}>{t("news.noReports")}</EmptyState>
      ) : (
        <>
          {reports.data[0] && <ReportCard report={reports.data[0]} lead />}
          <div className="grid gap-3 sm:grid-cols-2">
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
    <section aria-labelledby="news-headlines" className="flex flex-col gap-4 self-start">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="news-headlines" className="text-xl font-bold">
          {t("news.headlines")}
        </h2>
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
        <HeadlineList headlines={headlines.data} />
      )}
      <p className="text-sm text-muted">{t("news.sources")}</p>
    </section>
  );
}

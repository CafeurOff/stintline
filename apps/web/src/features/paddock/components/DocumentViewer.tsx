import type { Schema } from "@stintline/api-types";
import { ExternalLink, FileText } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Link } from "react-router";

import { Panel } from "@/components/layout/Panel";
import { Flag } from "@/components/racing/Flag";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { DriverChip } from "@/features/analysis/components/common";
import { eventName, fiaSessionLabel } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";

import { pdfUrl, useDocument } from "../api";
import { CategoryTag } from "./CategoryTag";
import { PenaltyTags } from "./PenaltyTags";

const PdfViewer = lazy(async () => ({ default: (await import("./PdfViewer")).PdfViewer }));
export type Decision = Schema<"Decision">;

export function Viewer({ id }: { id: number }) {
  const { t, locale } = useI18n();
  const doc = useDocument(id);
  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  if (doc.isError) return <ErrorState error={doc.error} onRetry={() => void doc.refetch()} />;
  if (!doc.data) return <Skeleton className="h-[70vh]" />;
  const d = doc.data;
  const published = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d.published_at));
  return (
    <Panel
      title={t("docs.docN", { n: d.number })}
      icon={<FileText />}
      action={
        <a
          href={d.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
        >
          {t("docs.onFia")} <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      }
      bodyClassName="gap-4 p-5"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-lg leading-snug font-bold">{d.title}</h3>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <CategoryTag category={d.category} />
          <Flag country={d.event.country} />
          {eventName(d.event.name, locale)} · {published}
        </p>
      </div>
      {d.decision && (
        <Ruling
          decision={d.decision}
          eventId={d.event.id}
          reason={d.reason}
          infringement={d.infringement}
        />
      )}
      <SegmentedControl
        legend={t("docs.show")}
        hideLegend
        options={[
          { value: "pdf", label: t("docs.pdf") },
          { value: "text", label: t("docs.text") },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === "pdf" ? (
        <Suspense fallback={<Skeleton className="aspect-[1/1.41] w-full" />}>
          <PdfViewer url={pdfUrl(d.id)} title={d.title} />
        </Suspense>
      ) : d.text ? (
        <pre className="max-h-[70vh] overflow-auto rounded-lg bg-raised p-4 font-sans text-sm whitespace-pre-wrap">
          {d.text}
        </pre>
      ) : (
        <p className="text-sm text-muted">{t("docs.textPending")}</p>
      )}
    </Panel>
  );
}

function Ruling({
  decision,
  eventId,
  reason,
  infringement,
}: {
  decision: Schema<"DecisionBrief">;
  eventId: number;
  reason: string | null | undefined;
  infringement: string | null | undefined;
}) {
  const { t, locale } = useI18n();
  return (
    <section
      aria-label={t("docs.ruling")}
      className="flex flex-col gap-3 rounded-xl bg-ink/[0.04] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {decision.driver ? (
          <DriverChip
            driver={decision.driver}
            colour={null}
            sub={fiaSessionLabel(decision.session_label, locale)}
          />
        ) : (
          <span className="font-semibold">{decision.driver_name}</span>
        )}
        <PenaltyTags ruling={decision} />
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted">{t("docs.fact")}</dt>
        <dd>{decision.fact}</dd>
        {infringement && (
          <>
            <dt className="text-muted">{t("docs.infringement")}</dt>
            <dd>{infringement}</dd>
          </>
        )}
        <dt className="text-muted">{t("docs.decision")}</dt>
        <dd className="font-semibold">{decision.decision}</dd>
        {decision.lap != null && (
          <>
            <dt className="text-muted">{t("docs.lap")}</dt>
            <dd>
              <Link
                to={`/events/${String(eventId)}?chart=positions&drivers=${String(decision.car_number ?? "")}`}
                className="num font-semibold text-mark-text hover:underline"
              >
                {t("docs.lapN", { n: decision.lap })}
              </Link>
              {decision.incident_time && (
                <span className="num ml-2 text-muted">({decision.incident_time})</span>
              )}
            </dd>
          </>
        )}
        {reason && (
          <>
            <dt className="text-muted">{t("docs.reason")}</dt>
            <dd className="text-muted">{reason}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

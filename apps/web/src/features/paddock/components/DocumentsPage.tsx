import type { Schema } from "@stintline/api-types";
import {
  ExternalLink,
  FileText,
  Gavel,
  ListChecks,
  Scale,
  Search,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { lazy, Suspense, useId, useRef, useState } from "react";
import { Link } from "react-router";

import { Panel, Tile } from "@/components/dash/Panel";
import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { Flag } from "@/components/racing/Flag";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { DriverChip } from "@/features/insights/components/common";
import { useSeasonParam } from "@/features/insights/season";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

import { pdfUrl, useDecisions, useDocument, useDocumentEvents, useDocuments } from "../api";
import { CATEGORIES, type Category, categoryKey } from "../categories";
import { CategoryTag } from "./CategoryTag";
import { DecisionTable } from "./DecisionTable";
import { PenaltyTags } from "./PenaltyTags";

const PdfViewer = lazy(async () => ({ default: (await import("./PdfViewer")).PdfViewer }));

type Doc = Schema<"Document">;
type Decision = Schema<"Decision">;

export function DocumentsPage() {
  const { t, locale } = useI18n();
  const [year, setYear] = useSeasonParam();
  const [params, update] = useSearchParamsState();
  const events = useDocumentEvents(year);
  const askedEvent = intParam(params, "event");
  const eventId = askedEvent ?? events.data?.[0]?.event.id ?? null;
  const search = params.get("q") ?? "";

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t("docs.title")}
        actions={
          <>
            <SeasonSelect
              value={year}
              onChange={(value) => {
                update({ event: null, doc: null, q: null });
                setYear(value);
              }}
            />
            {events.data && events.data.length > 0 && (
              <Select
                label={t("docs.grandPrix")}
                value={eventId ?? ""}
                onChange={(event) => {
                  update({ event: event.target.value, doc: null, q: null, cat: null });
                }}
              >
                {events.data.map((e) => (
                  <option key={e.event.id} value={e.event.id}>
                    {eventName(e.event.name, locale)}
                  </option>
                ))}
              </Select>
            )}
            <SearchBox
              value={search}
              onSearch={(q) => {
                update({ q: q || null, doc: null });
              }}
            />
          </>
        }
      >
        {t("docs.intro")}
      </PageHeader>
      {year === null || events.isPending ? (
        <Skeleton className="h-[60vh]" />
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => void events.refetch()} />
      ) : events.data.length === 0 ? (
        <EmptyState title={t("docs.empty")}>{t("docs.emptyHint")}</EmptyState>
      ) : (
        <Documents
          season={year}
          eventId={eventId}
          summary={events.data.find((e) => e.event.id === eventId) ?? events.data[0] ?? null}
          search={search}
        />
      )}
    </div>
  );
}

function SearchBox({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const { t } = useI18n();
  const id = useId();
  const [draft, setDraft] = useState(value);
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    onSearch(draft.trim());
  };
  return (
    <form
      role="search"
      onSubmit={submit}
      className="flex items-center gap-2 rounded-lg border border-line bg-panel py-1 pr-1 pl-3"
    >
      <label htmlFor={id} className="sr-only">
        {t("docs.search")}
      </label>
      <Search aria-hidden="true" className="size-4 text-muted" />
      <input
        id={id}
        type="search"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        placeholder={t("docs.searchPlaceholder")}
        className="w-40 min-w-0 bg-transparent py-1 text-sm outline-none sm:w-56"
      />
      <button
        type="submit"
        className="rounded-md bg-raised px-2.5 py-1 text-sm font-semibold hover:bg-line"
      >
        {t("docs.searchGo")}
      </button>
    </form>
  );
}

function Documents({
  season,
  eventId,
  summary,
  search,
}: {
  season: number;
  eventId: number | null;
  summary: Schema<"EventDocuments"> | null;
  search: string;
}) {
  const { t, locale } = useI18n();
  const [params, update] = useSearchParamsState();
  const category = CATEGORIES.find((c) => c === params.get("cat")) ?? null;
  const list = useDocuments({ season, event: eventId, category, search });
  const decisions = useDecisions({ season, ...(eventId === null ? {} : { event: eventId }) });
  const viewer = useRef<HTMLDivElement>(null);
  const docs = list.data?.results ?? [];
  const chosen = intParam(params, "doc") ?? docs[0]?.id ?? null;

  const choose = (id: number) => {
    update({ doc: id });
    if (window.innerWidth < 1280) viewer.current?.scrollIntoView({ behavior: "smooth" });
  };

  const ruled = decisions.data ?? [];
  const points = ruled.reduce((sum, d) => sum + (d.penalty_points ?? 0), 0);
  const pointsLeader = [...ruled]
    .filter((d) => d.driver)
    .reduce<Map<string, { decision: Decision; points: number }>>((acc, d) => {
      const key = d.driver?.ref ?? "";
      const now = acc.get(key);
      acc.set(key, { decision: d, points: (now?.points ?? 0) + (d.penalty_points ?? 0) });
      return acc;
    }, new Map());
  const topPoints = [...pointsLeader.values()].sort((a, b) => b.points - a.points)[0];

  return (
    <div className="flex flex-col gap-4">
      {summary && !search && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Tile label={t("docs.tile.documents")} icon={<FileText />}>
            <p className="num text-4xl font-semibold">{summary.documents}</p>
            <p className="flex items-center gap-2 text-sm text-muted">
              <Flag country={summary.event.country} />
              {eventName(summary.event.name, locale)}
            </p>
          </Tile>
          <Tile label={t("docs.tile.decisions")} icon={<Gavel />}>
            <p className="num text-4xl font-semibold">{summary.decisions}</p>
            <p className="text-sm text-muted">{t("docs.tile.decisionsNote")}</p>
          </Tile>
          <Tile label={t("docs.tile.penalties")} icon={<ShieldAlert />}>
            <p className="num text-4xl font-semibold text-loss">{summary.penalties}</p>
            <p className="text-sm text-muted">{t("docs.tile.penaltiesNote")}</p>
          </Tile>
          <Tile label={t("docs.tile.points")} icon={<TriangleAlert />}>
            <p className="num text-4xl font-semibold">{points}</p>
            {topPoints?.decision.driver && topPoints.points > 0 ? (
              <DriverChip
                driver={topPoints.decision.driver}
                colour={topPoints.decision.colour}
                size="size-7"
                sub={t("docs.tile.pointsMost", { n: topPoints.points })}
              />
            ) : (
              <p className="text-sm text-muted">{t("docs.tile.pointsNone")}</p>
            )}
          </Tile>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel
          title={search ? t("docs.results", { q: search }) : t("docs.list")}
          icon={<ListChecks />}
          className="self-start"
          action={
            <CategoryFilter
              value={category}
              onChange={(cat) => {
                update({ cat, doc: null });
              }}
            />
          }
        >
          {list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : !list.data ? (
            <Skeleton className="m-4 h-96" />
          ) : docs.length === 0 ? (
            <p className="p-5 text-sm text-muted">{t("docs.none")}</p>
          ) : (
            <ul className="flex max-h-[70vh] flex-col divide-y divide-line overflow-y-auto xl:max-h-[calc(100vh-9rem)]">
              {docs.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  active={doc.id === chosen}
                  showEvent={search !== ""}
                  onChoose={() => {
                    choose(doc.id);
                  }}
                />
              ))}
            </ul>
          )}
          {list.data && list.data.count > docs.length && (
            <p className="border-t border-line px-5 py-3 text-xs text-muted">
              {t("docs.more", { shown: docs.length, total: list.data.count })}
            </p>
          )}
        </Panel>
        <div
          ref={viewer}
          className="flex min-w-0 scroll-mt-20 flex-col gap-4 xl:sticky xl:top-20 xl:self-start"
        >
          {chosen !== null && <Viewer id={chosen} />}
        </div>
      </div>

      <Panel title={t("docs.decisions")} icon={<Scale />}>
        {decisions.isError ? (
          <ErrorState error={decisions.error} onRetry={() => void decisions.refetch()} />
        ) : !decisions.data ? (
          <Skeleton className="m-4 h-40" />
        ) : decisions.data.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t("docs.noDecisions")}</p>
        ) : (
          <DecisionTable decisions={decisions.data} onOpen={choose} />
        )}
      </Panel>
      <p className="text-xs text-muted">{t("docs.source")}</p>
    </div>
  );
}

function CategoryFilter({
  value,
  onChange,
}: {
  value: Category | null;
  onChange: (value: Category | null) => void;
}) {
  const { t } = useI18n();
  const options: (Category | null)[] = [
    null,
    "decision",
    "infringement",
    "summons",
    "classification",
    "technical",
    "notes",
  ];
  return (
    <div role="group" aria-label={t("docs.category")} className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option ?? "all"}
          type="button"
          aria-pressed={value === option}
          onClick={() => {
            onChange(option);
          }}
          className={`rounded-md px-2 py-1 text-xs font-semibold ${
            value === option ? "bg-ink text-bg" : "bg-raised text-muted hover:text-ink"
          }`}
        >
          {option === null ? t("dash.all") : t(categoryKey(option))}
        </button>
      ))}
    </div>
  );
}

function DocumentRow({
  doc,
  active,
  showEvent,
  onChoose,
}: {
  doc: Doc;
  active: boolean;
  showEvent: boolean;
  onChoose: () => void;
}) {
  const { t, locale } = useI18n();
  const when = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(doc.published_at));
  return (
    <li>
      <button
        type="button"
        onClick={onChoose}
        aria-current={active ? "true" : undefined}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-raised ${
          active ? "bg-mark/10 shadow-[inset_3px_0_0_var(--color-mark)]" : ""
        }`}
      >
        <span className="num grid h-7 min-w-9 place-items-center rounded-md bg-raised text-xs font-bold">
          {doc.number}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm leading-snug font-semibold">{doc.title}</span>
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <CategoryTag category={doc.category} />
            {showEvent && (
              <span className="flex items-center gap-1">
                <Flag country={doc.event.country} />
                {eventName(doc.event.name, locale)}
              </span>
            )}
            <span className="num">{when}</span>
            {doc.decision && <PenaltyTags ruling={doc.decision} />}
            {!doc.has_text && <span>{t("docs.textPending")}</span>}
          </span>
          {doc.snippet && <span className="text-xs text-muted italic">{doc.snippet}</span>}
        </span>
      </button>
    </li>
  );
}

function Viewer({ id }: { id: number }) {
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
  const { t } = useI18n();
  return (
    <section
      aria-label={t("docs.ruling")}
      className="flex flex-col gap-3 rounded-xl border border-line bg-raised/50 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {decision.driver ? (
          <DriverChip driver={decision.driver} colour={null} sub={decision.session_label} />
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

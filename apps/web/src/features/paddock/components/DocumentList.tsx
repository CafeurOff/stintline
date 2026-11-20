import type { Schema } from "@stintline/api-types";
import {
  FileText,
  Gavel,
  ListChecks,
  Scale,
  Search,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { useId, useRef, useState } from "react";

import { Panel, Tile } from "@/components/layout/Panel";
import { Flag } from "@/components/racing/Flag";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { DriverChip } from "@/features/analysis/components/AnalysisParts";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

import { useDecisions, useDocuments } from "../api";
import { CATEGORIES, type Category, categoryKey } from "../categories";
import { CategoryTag } from "./CategoryTag";
import { DecisionTable } from "./DecisionTable";
import { type Decision, Viewer } from "./DocumentViewer";
import { PenaltyTags } from "./PenaltyTags";

type Doc = Schema<"Document">;

export function SearchBox({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
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
      className="glass flex items-center gap-2 rounded-xl py-1 pr-1 pl-3"
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

export function Documents({
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
            <p className="num display text-4xl">{summary.documents}</p>
            <p className="flex items-center gap-2 text-sm text-muted">
              <Flag country={summary.event.country} />
              {eventName(summary.event.name, locale)}
            </p>
          </Tile>
          <Tile label={t("docs.tile.decisions")} icon={<Gavel />}>
            <p className="num display text-4xl">{summary.decisions}</p>
            <p className="text-sm text-muted">{t("docs.tile.decisionsNote")}</p>
          </Tile>
          <Tile label={t("docs.tile.penalties")} icon={<ShieldAlert />}>
            <p className="num display text-4xl text-loss">{summary.penalties}</p>
            <p className="text-sm text-muted">{t("docs.tile.penaltiesNote")}</p>
          </Tile>
          <Tile label={t("docs.tile.points")} icon={<TriangleAlert />}>
            <p className="num display text-4xl">{points}</p>
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
  const { locale } = useI18n();
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
          </span>
          {doc.snippet && <span className="text-xs text-muted italic">{doc.snippet}</span>}
        </span>
      </button>
    </li>
  );
}

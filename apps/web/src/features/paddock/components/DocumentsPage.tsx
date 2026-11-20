import { PageHeader } from "@/components/layout/PageHeader";
import { SeasonSelect } from "@/components/racing/SeasonSelect";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useSeasonParam } from "@/features/analysis/season";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

import { useDocumentEvents } from "../api";
import { Documents, SearchBox } from "./DocumentList";

export function DocumentsPage() {
  const { t, locale } = useI18n();
  const [year, setYear] = useSeasonParam();
  const [params, update] = useSearchParamsState();
  const events = useDocumentEvents(year);
  const askedEvent = intParam(params, "event");
  // Without a choice, open on the latest Grand Prix with rulings: the next one starts empty.
  const eventId =
    askedEvent ?? (events.data?.find((e) => e.decisions > 0) ?? events.data?.[0])?.event.id ?? null;
  const search = params.get("q") ?? "";

  return (
    <div className="flex flex-col">
      <PageHeader
        terms={["penaltyPoints"]}
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

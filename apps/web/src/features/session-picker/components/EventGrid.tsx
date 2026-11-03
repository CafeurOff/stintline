import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

import { useEvents, useSeasons } from "../api";
import { EventCard } from "./EventCard";

/** Season selector and the season's Grands Prix. The season lives in `?season=`. */
export function EventGrid() {
  const [params, update] = useSearchParamsState();
  const seasons = useSeasons();
  const years = seasons.data?.results.map((season) => season.year).sort((a, b) => b - a) ?? [];
  const requested = intParam(params, "season");
  const year = requested !== null && years.includes(requested) ? requested : (years[0] ?? null);
  const events = useEvents(year);
  const [showAll, setShowAll] = useState(false);

  if (seasons.isPending) return <Skeleton className="h-64" label="Loading seasons…" />;
  if (seasons.isError)
    return <ErrorState error={seasons.error} onRetry={() => void seasons.refetch()} />;
  if (year === null)
    return (
      <EmptyState title="No season loaded yet">
        Run <code>make seed</code> to load the demo races.
      </EmptyState>
    );

  const all = events.data?.results ?? [];
  const withData = all.filter((event) => event.sessions.some((session) => session.has_data));
  const visible = showAll ? all : withData;

  return (
    <section aria-labelledby="events-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="events-title" className="text-xl font-semibold tracking-tight">
            {year} Grands Prix
          </h2>
          {events.data && (
            <p className="text-sm text-text-muted">
              {withData.length} of {all.length} rounds have timing data
            </p>
          )}
        </div>
        <div className="flex items-end gap-2">
          {years.length > 1 && (
            <Select
              label="Season"
              value={year}
              onChange={(event) => {
                update({ season: event.target.value });
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )}
          <Button
            variant="ghost"
            aria-pressed={showAll}
            onClick={() => {
              setShowAll((value) => !value);
            }}
          >
            {showAll ? "Only rounds with data" : "Show full calendar"}
          </Button>
        </div>
      </div>
      {events.isPending ? (
        <Skeleton className="h-48" label="Loading Grands Prix…" />
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => void events.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState title="No race with timing data in this season">
          Load one with <code>manage.py ingest --season {year} --round N</code>.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </ul>
      )}
    </section>
  );
}

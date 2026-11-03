import { useQueries, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** A full season fits in one page (24 rounds); the API caps `limit` at 100. */
const EVENTS_PAGE_SIZE = 50;
/** First season with lap-by-lap timing (OpenF1). Older seasons have results only. */
export const TIMING_FIRST_SEASON = 2023;

export function useSeasons() {
  return useQuery({
    queryKey: ["seasons"],
    queryFn: async ({ signal }) => unwrap(await api.GET("/api/v1/seasons", { signal })),
    staleTime: 10 * 60_000,
  });
}

function eventsQuery(year: number) {
  return {
    queryKey: ["events", year],
    queryFn: async ({ signal }: { signal: AbortSignal }) =>
      unwrap(
        await api.GET("/api/v1/seasons/{year}/events", {
          params: { path: { year }, query: { limit: EVENTS_PAGE_SIZE } },
          signal,
        }),
      ),
    staleTime: 10 * 60_000,
  };
}

/** Events of every season with timing data, newest season first. */
export function useTimedSeasonsEvents(years: readonly number[]) {
  return useQueries({ queries: years.map((year) => eventsQuery(year)) });
}

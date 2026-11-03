import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** A full season fits in one page (24 rounds); the API caps `limit` at 100. */
const EVENTS_PAGE_SIZE = 50;

export function useSeasons() {
  return useQuery({
    queryKey: ["seasons"],
    queryFn: async ({ signal }) => unwrap(await api.GET("/api/v1/seasons", { signal })),
    staleTime: 10 * 60_000,
  });
}

export function useEvents(year: number | null) {
  return useQuery({
    queryKey: ["events", year],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/seasons/{year}/events", {
          params: { path: { year: year ?? 0 }, query: { limit: EVENTS_PAGE_SIZE } },
          signal,
        }),
      ),
    enabled: year !== null,
    staleTime: 10 * 60_000,
  });
}

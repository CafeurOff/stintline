import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** The API refreshes forecasts every 3 hours. */
const STALE_MS = 15 * 60_000;

/** Forecasts of upcoming sessions, for one Grand Prix or all of them. */
export function useForecasts(eventId?: number) {
  return useQuery({
    queryKey: ["forecasts", eventId ?? null],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/forecasts", {
          params: { query: eventId === undefined ? {} : { event: eventId } },
          signal,
        }),
      ),
    staleTime: STALE_MS,
  });
}

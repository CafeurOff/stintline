import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** Results change only after a Grand Prix: a few minutes is fresh enough. */
const RESULTS = { staleTime: 5 * 60_000 } as const;
/** Lists are paginated by the API; this covers a season (≤ 40 drivers, ≤ 15 teams). */
const LIST_LIMIT = 60;
/** All-time results of a driver fit in a few pages; the page shows the latest ones. */
const RESULTS_LIMIT = 100;

export function useHome() {
  return useQuery({
    queryKey: ["home"],
    queryFn: async ({ signal }) => unwrap(await api.GET("/api/v1/home", { signal })),
    ...RESULTS,
  });
}

export function useSeasonEvents(year: number | null) {
  return useQuery({
    queryKey: ["events", year],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/seasons/{year}/events", {
          params: { path: { year: year ?? 0 }, query: { limit: 50 } },
          signal,
        }),
      ),
    enabled: year !== null,
    ...RESULTS,
  });
}

export function useEvent(eventId: number, enabled = true) {
  return useQuery({
    queryKey: ["event", eventId],
    enabled,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/events/{event_id}", {
          params: { path: { event_id: eventId } },
          signal,
        }),
      ),
    ...RESULTS,
  });
}

export function useDrivers(search: string, season: number | null) {
  return useQuery({
    queryKey: ["drivers", search, season],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/drivers", {
          params: {
            query: {
              limit: LIST_LIMIT,
              ...(search ? { search } : {}),
              ...(season === null ? {} : { season }),
            },
          },
          signal,
        }),
      ),
    placeholderData: keepPreviousData,
    ...RESULTS,
  });
}

export function useDriver(ref: string) {
  return useQuery({
    queryKey: ["driver", ref],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/api/v1/drivers/{ref}", { params: { path: { ref } }, signal })),
    ...RESULTS,
  });
}

export function useDriverResults(ref: string, season: number | null) {
  return useQuery({
    queryKey: ["driver", ref, "results", season],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/drivers/{ref}/results", {
          params: {
            path: { ref },
            query: { limit: RESULTS_LIMIT, ...(season === null ? {} : { season }) },
          },
          signal,
        }),
      ),
    placeholderData: keepPreviousData,
    ...RESULTS,
  });
}

export function useTeams(search: string, season: number | null) {
  return useQuery({
    queryKey: ["teams", search, season],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/teams", {
          params: {
            query: {
              limit: LIST_LIMIT,
              ...(search ? { search } : {}),
              ...(season === null ? {} : { season }),
            },
          },
          signal,
        }),
      ),
    placeholderData: keepPreviousData,
    ...RESULTS,
  });
}

export function useTeam(ref: string) {
  return useQuery({
    queryKey: ["team", ref],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/api/v1/teams/{ref}", { params: { path: { ref } }, signal })),
    ...RESULTS,
  });
}

export function useStandings(year: number, round: number | null, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["standings", year, round],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/seasons/{year}/standings", {
          params: { path: { year }, query: round === null ? {} : { round } },
          signal,
        }),
      ),
    placeholderData: keepPreviousData,
    ...RESULTS,
  });
}

export function useProgression(year: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["progression", year],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/seasons/{year}/standings/progression", {
          params: { path: { year } },
          signal,
        }),
      ),
    ...RESULTS,
  });
}

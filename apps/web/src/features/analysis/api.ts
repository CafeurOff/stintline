import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** Figures change only after an import: a few minutes is fresh enough. */
const FIGURES = { staleTime: 5 * 60_000, placeholderData: keepPreviousData } as const;

export interface PaceOptions {
  fuel: boolean;
  pit: boolean;
  sc: boolean;
  /** % of the fastest lap; `0` keeps every lap. */
  cutoff: number;
}

export function useTeammates(year: number) {
  return useQuery({
    queryKey: ["analysis", "teammates", year],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/analysis/seasons/{year}/teammates", {
          params: { path: { year } },
          signal,
        }),
      ),
    ...FIGURES,
  });
}

export function useHeadToHead(year: number, a: string | null, b: string | null) {
  return useQuery({
    queryKey: ["analysis", "h2h", year, a, b],
    enabled: a !== null && b !== null && a !== b,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/analysis/head-to-head", {
          params: { query: { season: year, a: a ?? "", b: b ?? "" } },
          signal,
        }),
      ),
    ...FIGURES,
  });
}

export function useConsistency(year: number) {
  return useQuery({
    queryKey: ["analysis", "consistency", year],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/analysis/seasons/{year}/consistency", {
          params: { path: { year } },
          signal,
        }),
      ),
    ...FIGURES,
  });
}

export function usePitStops(year: number) {
  return useQuery({
    queryKey: ["analysis", "pit-stops", year],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/analysis/seasons/{year}/pit-stops", {
          params: { path: { year } },
          signal,
        }),
      ),
    ...FIGURES,
  });
}

export function useCircuits() {
  return useQuery({
    queryKey: ["analysis", "circuits"],
    queryFn: async ({ signal }) => unwrap(await api.GET("/api/v1/analysis/circuits", { signal })),
    staleTime: 5 * 60_000,
  });
}

export function useSessionPace(sessionId: number | null, options: PaceOptions) {
  return useQuery({
    queryKey: ["analysis", "pace", sessionId, options],
    enabled: sessionId !== null,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/sessions/{session_id}/pace", {
          params: {
            path: { session_id: sessionId ?? 0 },
            query: { ...options },
          },
          signal,
        }),
      ),
    ...FIGURES,
  });
}

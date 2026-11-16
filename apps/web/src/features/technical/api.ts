import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** Technical reports arrive during a weekend: a few minutes is fresh enough. */
const TECHNICAL = { staleTime: 5 * 60_000, placeholderData: keepPreviousData } as const;

export function useUpgrades(season: number) {
  return useQuery({
    queryKey: ["technical", "upgrades", season],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/technical/upgrades", { params: { query: { season } }, signal }),
      ),
    ...TECHNICAL,
  });
}

export function usePowerUnits(season: number) {
  return useQuery({
    queryKey: ["technical", "power-units", season],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/technical/power-units", { params: { query: { season } }, signal }),
      ),
    ...TECHNICAL,
  });
}

export function useIncidents(season: number) {
  return useQuery({
    queryKey: ["technical", "incidents", season],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/technical/incidents", { params: { query: { season } }, signal }),
      ),
    ...TECHNICAL,
  });
}

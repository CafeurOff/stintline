import type { Schema } from "@stintline/api-types";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type ApiHealth = Schema<"Health">;

const HEALTH_REFRESH_MS = 30_000;

/**
 * Polls `/api/v1/health`. A 503 still carries a `Health` body describing what is down,
 * so both branches resolve. An empty body resolves to `undefined`, which TanStack Query
 * reports as an error.
 */
export function useApiHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async ({ signal }): Promise<ApiHealth> => {
      const { data, error } = await api.GET("/api/v1/health", { signal });
      return data ?? error;
    },
    refetchInterval: HEALTH_REFRESH_MS,
  });
}

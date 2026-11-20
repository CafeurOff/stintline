import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** Finished sessions do not change: cache for the page lifetime. */
const HISTORICAL = { staleTime: Infinity } as const;

export function useLaps(sessionId: number, cars: readonly number[], enabled: boolean) {
  const key = [...cars].sort((a, b) => a - b).join(",");
  return useQuery({
    queryKey: ["session", sessionId, "laps", key],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/sessions/{session_id}/laps", {
          params: { path: { session_id: sessionId }, query: { cars: key } },
          signal,
        }),
      ),
    enabled: enabled && key !== "",
    ...HISTORICAL,
  });
}

export function useSectors(sessionId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["session", sessionId, "sectors"],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/sessions/{session_id}/sectors", {
          params: { path: { session_id: sessionId } },
          signal,
        }),
      ),
    enabled,
    ...HISTORICAL,
  });
}

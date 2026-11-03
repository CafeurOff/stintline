import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** Finished sessions do not change: cache for the page lifetime. */
const HISTORICAL = { staleTime: Infinity } as const;

export function useSessionDetail(sessionId: number) {
  return useQuery({
    queryKey: ["session", sessionId],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/sessions/{session_id}", {
          params: { path: { session_id: sessionId } },
          signal,
        }),
      ),
    ...HISTORICAL,
  });
}

export function useStints(sessionId: number) {
  return useQuery({
    queryKey: ["session", sessionId, "stints"],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/sessions/{session_id}/stints", {
          params: { path: { session_id: sessionId } },
          signal,
        }),
      ),
    ...HISTORICAL,
  });
}

export function usePitLoss(sessionId: number) {
  return useQuery({
    queryKey: ["session", sessionId, "pit-loss"],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/sessions/{session_id}/pit-loss", {
          params: { path: { session_id: sessionId } },
          signal,
        }),
      ),
    ...HISTORICAL,
  });
}

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { ApiError, unwrap } from "@/lib/errors";

/** Finished sessions do not change: cache for the page lifetime. */
const HISTORICAL = { staleTime: Infinity } as const;

export function useSessionDetail(sessionId: number, enabled = true) {
  return useQuery({
    enabled,
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

/** Circuit outline, or `null` when none was recorded for this race (the map is optional). */
export function useTrack(sessionId: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["session", sessionId, "track"],
    queryFn: async ({ signal }) => {
      try {
        return unwrap(
          await api.GET("/api/v1/sessions/{session_id}/track", {
            params: { path: { session_id: sessionId } },
            signal,
          }),
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    ...HISTORICAL,
  });
}

export function useReplay(sessionId: number) {
  return useQuery({
    queryKey: ["session", sessionId, "replay"],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/sessions/{session_id}/replay", {
          params: { path: { session_id: sessionId } },
          signal,
        }),
      ),
    ...HISTORICAL,
  });
}

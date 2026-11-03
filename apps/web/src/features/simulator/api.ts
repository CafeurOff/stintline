import type { Schema } from "@stintline/api-types";
import { keepPreviousData, skipToken, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

export type UndercutRequest = Schema<"UndercutRequestRequest">;
export type PitExitRequest = Schema<"PitExitRequestRequest">;

/**
 * Simulations are pure functions of their inputs, so they are queries keyed by the request,
 * not mutations: moving a slider back to a previous lap is served from cache. The previous
 * result stays on screen while the next one loads.
 */
export function useUndercut(sessionId: number, request: UndercutRequest | null) {
  return useQuery({
    queryKey: ["session", sessionId, "undercut", request],
    queryFn: request
      ? async ({ signal }) =>
          unwrap(
            await api.POST("/api/v1/sessions/{session_id}/simulate/undercut", {
              params: { path: { session_id: sessionId } },
              body: request,
              signal,
            }),
          )
      : skipToken,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: false,
  });
}

export function usePitExit(sessionId: number, request: PitExitRequest | null) {
  return useQuery({
    queryKey: ["session", sessionId, "pit-exit", request],
    queryFn: request
      ? async ({ signal }) =>
          unwrap(
            await api.POST("/api/v1/sessions/{session_id}/simulate/pit-exit", {
              params: { path: { session_id: sessionId } },
              body: request,
              signal,
            }),
          )
      : skipToken,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: false,
  });
}

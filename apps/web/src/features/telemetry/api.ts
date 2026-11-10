import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** Stored once after the race: it never changes. */
const STORED = { staleTime: 60 * 60_000 } as const;

export function useTelemetryLaps(sessionId: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["session", sessionId, "telemetry"],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/sessions/{session_id}/telemetry", {
          params: { path: { session_id: sessionId } },
          signal,
        }),
      ),
    ...STORED,
  });
}

export function useTelemetryCompare(sessionId: number, cars: readonly number[]) {
  return useQuery({
    enabled: cars.length > 0,
    queryKey: ["session", sessionId, "telemetry", cars.join(",")],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/sessions/{session_id}/telemetry/compare", {
          params: { path: { session_id: sessionId }, query: { cars: cars.join(",") } },
          signal,
        }),
      ),
    placeholderData: keepPreviousData,
    ...STORED,
  });
}

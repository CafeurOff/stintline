import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** Whole-field fit: compound summaries need every stint, the chart filters client-side. */
export function useDegradation(sessionId: number) {
  return useQuery({
    queryKey: ["session", sessionId, "degradation"],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/sessions/{session_id}/degradation", {
          params: { path: { session_id: sessionId } },
          signal,
        }),
      ),
    staleTime: Infinity,
  });
}

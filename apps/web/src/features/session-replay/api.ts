import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** Every lap of a session on its clock (ADR 0028). Finished sessions do not change. */
export function useTimeline(sessionId: number) {
  return useQuery({
    queryKey: ["session", sessionId, "timeline"],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/sessions/{session_id}/timeline", {
          params: { path: { session_id: sessionId } },
          signal,
        }),
      ),
    staleTime: Infinity,
  });
}

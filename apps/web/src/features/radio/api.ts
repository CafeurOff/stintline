import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** Team radio of a session with lap and transcript (ADR 0029). Transcripts arrive after the
 * import, so this is refreshed now and then rather than cached forever. */
const RADIO_STALE_MS = 5 * 60 * 1000;

export function useSessionRadio(sessionId: number) {
  return useQuery({
    queryKey: ["session", sessionId, "radio"],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/sessions/{session_id}/radio", {
          params: { path: { session_id: sessionId } },
          signal,
        }),
      ),
    staleTime: RADIO_STALE_MS,
  });
}

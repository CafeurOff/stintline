import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** How often the page asks whether a session has started (the socket takes over then). */
const STATUS_POLL_MS = 30_000;
/** The header and the live page read the same status: a page opened right after the
 * header asked does not ask again. */
const STATUS_FRESH_MS = 10_000;

export function useLiveStatus() {
  return useQuery({
    queryKey: ["live"],
    queryFn: async ({ signal }) => unwrap(await api.GET("/api/v1/live", { signal })),
    refetchInterval: STATUS_POLL_MS,
    staleTime: STATUS_FRESH_MS,
  });
}

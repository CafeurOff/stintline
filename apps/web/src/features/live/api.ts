import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** How often the page asks whether a session has started (the socket takes over then). */
const STATUS_POLL_MS = 30_000;

export function useLiveStatus() {
  return useQuery({
    queryKey: ["live"],
    queryFn: async ({ signal }) => unwrap(await api.GET("/api/v1/live", { signal })),
    refetchInterval: STATUS_POLL_MS,
    staleTime: 0,
  });
}

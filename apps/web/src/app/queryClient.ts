import { QueryClient } from "@tanstack/react-query";

const HISTORICAL_STALE_MS = 5 * 60_000;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: HISTORICAL_STALE_MS, refetchOnWindowFocus: false, retry: 1 },
    },
  });
}

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** Title maths of a season (ADR 0022): changes only when results are imported. */
export function useTitle(year: number | null) {
  return useQuery({
    enabled: year !== null,
    queryKey: ["season", year, "title"],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/seasons/{year}/title", {
          params: { path: { year: year ?? 0 } },
          signal,
        }),
      ),
    staleTime: 10 * 60_000,
  });
}

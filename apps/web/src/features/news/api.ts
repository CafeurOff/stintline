import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** Feeds are read every 30 minutes on the server. */
const HEADLINES = { staleTime: 5 * 60_000, refetchInterval: 15 * 60_000 } as const;
/** Reports change only when a race is imported. */
const REPORTS = { staleTime: 5 * 60_000 } as const;

export type HeadlineLanguage = "en" | "fr";

export function useHeadlines(lang: HeadlineLanguage | null, limit = 30) {
  return useQuery({
    queryKey: ["headlines", lang, limit],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/news/headlines", {
          params: { query: { limit, ...(lang ? { lang } : {}) } },
          signal,
        }),
      ),
    ...HEADLINES,
  });
}

export function useReports(limit = 12) {
  return useQuery({
    queryKey: ["reports", limit],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/api/v1/news/reports", { params: { query: { limit } }, signal })),
    ...REPORTS,
  });
}

export function useReport(sessionId: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["report", sessionId],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/news/reports/{session_id}", {
          params: { path: { session_id: sessionId } },
          signal,
        }),
      ),
    ...REPORTS,
  });
}

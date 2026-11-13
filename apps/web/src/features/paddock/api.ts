import type { Schema } from "@stintline/api-types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { unwrap } from "@/lib/errors";

/** Documents arrive during a weekend: a minute is fresh enough. */
const DOCUMENTS = { staleTime: 60_000 } as const;
export const PAGE_SIZE = 40;

export interface DocumentFilters {
  season: number;
  event: number | null;
  category: string | null;
  search: string;
}

export function useDocumentEvents(season: number | null) {
  return useQuery({
    queryKey: ["documents", "events", season],
    enabled: season !== null,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/documents/events", {
          params: { query: { season: season ?? 0 } },
          signal,
        }),
      ),
    ...DOCUMENTS,
  });
}

export function useDocuments(filters: DocumentFilters, enabled = true) {
  const { season, event, category, search } = filters;
  return useQuery({
    queryKey: ["documents", "list", season, event, category, search],
    enabled,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/documents", {
          params: {
            query: {
              season,
              limit: search ? PAGE_SIZE : 100,
              ...(event === null || search ? {} : { event }),
              ...(category ? { category: category as Schema<"DocumentCategoryEnum"> } : {}),
              ...(search ? { q: search } : {}),
            },
          },
          signal,
        }),
      ),
    placeholderData: keepPreviousData,
    ...DOCUMENTS,
  });
}

export function useDocument(id: number | null) {
  return useQuery({
    queryKey: ["documents", "detail", id],
    enabled: id !== null,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/documents/{document_id}", {
          params: { path: { document_id: id ?? 0 } },
          signal,
        }),
      ),
    ...DOCUMENTS,
  });
}

export function useDecisions(
  query: { season?: number; event?: number; driver?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: ["decisions", query],
    enabled,
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/api/v1/stewards/decisions", { params: { query }, signal })),
    ...DOCUMENTS,
  });
}

/** Where the viewer reads a document's PDF (relayed by our API, ADR 0018). */
export function pdfUrl(id: number): string {
  return `/api/v1/documents/${String(id)}/pdf`;
}

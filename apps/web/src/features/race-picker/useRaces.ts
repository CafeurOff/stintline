import type { Schema } from "@stintline/api-types";

import { TIMING_FIRST_SEASON, useSeasons, useTimedSeasonsEvents } from "./api";

export type EventItem = Schema<"Event">;

export interface SeasonEvents {
  year: number;
  events: EventItem[];
}

/** Race and sprint sessions of an event that have lap timing (the replay works). */
export function timedSessions(event: EventItem) {
  return event.sessions.filter((s) => s.has_data && (s.kind === "R" || s.kind === "SPRINT"));
}

/** Calendars of every season with timing data, newest season first. */
export function useTimedEvents() {
  const seasons = useSeasons();
  const years = (seasons.data?.results ?? [])
    .map((s) => s.year)
    .filter((year) => year >= TIMING_FIRST_SEASON)
    .sort((a, b) => b - a);
  const queries = useTimedSeasonsEvents(years);
  const failed = queries.find((q) => q.isError);

  const data: SeasonEvents[] = years.map((year, index) => ({
    year,
    events: queries[index]?.data?.results ?? [],
  }));
  const latestSessionId =
    data
      .flatMap((s) => [...s.events].reverse())
      .map((event) => timedSessions(event).find((s) => s.kind === "R"))
      .find((s) => s !== undefined)?.id ?? null;

  return {
    seasons: data,
    latestSessionId,
    isPending: seasons.isPending || queries.some((q) => q.isPending),
    isError: seasons.isError || failed !== undefined,
    error: seasons.error ?? failed?.error ?? null,
    refetch: () => {
      void seasons.refetch();
      for (const q of queries) void q.refetch();
    },
  };
}

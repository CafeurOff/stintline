import { TIMING_FIRST_SEASON, useSeasons, useTimedSeasonsEvents } from "./api";

export interface RaceOption {
  sessionId: number;
  eventName: string;
  year: number;
  round: number;
  kind: "R" | "SPRINT";
}

/** Races and sprints with timing data in every timed season, most recent first. */
export function useRaces() {
  const seasons = useSeasons();
  const years = (seasons.data?.results ?? [])
    .map((s) => s.year)
    .filter((year) => year >= TIMING_FIRST_SEASON)
    .sort((a, b) => b - a);
  const events = useTimedSeasonsEvents(years);

  const races: RaceOption[] = [];
  for (const query of events) {
    for (const event of query.data?.results ?? []) {
      for (const session of event.sessions) {
        if (!session.has_data || (session.kind !== "R" && session.kind !== "SPRINT")) continue;
        races.push({
          sessionId: session.id,
          eventName: event.name,
          year: event.season,
          round: event.round,
          kind: session.kind,
        });
      }
    }
  }
  races.sort((a, b) => b.year - a.year || b.round - a.round || (a.kind === "R" ? -1 : 1));
  const failed = events.find((q) => q.isError);

  return {
    races,
    isPending: seasons.isPending || events.some((q) => q.isPending),
    isError: seasons.isError || failed !== undefined,
    error: seasons.error ?? failed?.error ?? null,
    noSeason: seasons.isSuccess && years.length === 0,
    refetch: () => {
      void seasons.refetch();
      for (const q of events) void q.refetch();
    },
  };
}

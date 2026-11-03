import { useEvents, useSeasons } from "./api";

export interface RaceOption {
  sessionId: number;
  eventName: string;
  year: number;
  round: number;
  kind: "R" | "SPRINT";
}

/** Races and sprints with timing data in the latest season, most recent first. */
export function useRaces() {
  const seasons = useSeasons();
  const year = seasons.data?.results.map((s) => s.year).sort((a, b) => b - a)[0] ?? null;
  const events = useEvents(year);

  const races: RaceOption[] = [];
  for (const event of events.data?.results ?? []) {
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
  races.sort((a, b) => b.round - a.round || (a.kind === "R" ? -1 : 1));

  return {
    races,
    isPending: seasons.isPending || (year !== null && events.isPending),
    isError: seasons.isError || events.isError,
    error: seasons.error ?? events.error,
    noSeason: seasons.isSuccess && year === null,
    refetch: () => {
      void seasons.refetch();
      void events.refetch();
    },
  };
}

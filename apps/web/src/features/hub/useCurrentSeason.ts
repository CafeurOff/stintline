import { useSeasons } from "@/features/session-picker/api";

import { useHome } from "./api";

/** The season of the latest race, else the most recent stored season. */
export function useCurrentSeason(): { season: number | null; isPending: boolean } {
  const home = useHome();
  const seasons = useSeasons();
  const latest = seasons.data?.results.map((s) => s.year).sort((a, b) => b - a)[0] ?? null;
  return {
    season: home.data?.season ?? latest,
    isPending: home.isPending && seasons.isPending,
  };
}

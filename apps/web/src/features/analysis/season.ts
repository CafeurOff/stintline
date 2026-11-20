import type { Schema } from "@stintline/api-types";

import { initials } from "@/components/racing/initials";
import { useCurrentSeason } from "@/features/hub/useCurrentSeason";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

type Driver = Schema<"Driver">;

/** First season with timing, so with engine figures (ADR 0004). */
export const FIRST_TIMED_SEASON = 2023;

export function driverLabel(driver: Driver): string {
  return driver.code ?? initials(driver.given_name, driver.family_name);
}

/** First season of the archive. */
const FIRST_SEASON = 1950;

/** The season in `?season=`, else the current one; `null` while it loads. Pages that need
 * timing show why a season before 2023 is empty rather than silently switching. */
export function useSeasonParam(): [number | null, (year: number | null) => void] {
  const [params, update] = useSearchParamsState();
  const current = useCurrentSeason().season;
  const asked = intParam(params, "season");
  const year = asked !== null && asked >= FIRST_SEASON ? asked : current;
  return [
    year,
    (value) => {
      update({ season: value === current ? null : value });
    },
  ];
}

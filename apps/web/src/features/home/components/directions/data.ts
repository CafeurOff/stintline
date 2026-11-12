import type { Schema } from "@stintline/api-types";

import { useHome, useSeasonEvents } from "@/features/hub/api";
import { useHeadlines, useReports } from "@/features/news/api";
import { useSessionDetail, useStints } from "@/features/race/api";
import { useI18n } from "@/lib/i18n/context";
import { timeLeft, useClock } from "@/lib/useClock";

export type Entry = Schema<"Entry">;
export type Headline = Schema<"Headline">;
export type EntryStints = Schema<"EntryStints">;

/** Everything a home page direction draws, from the same queries as the real home page. */
export function useHomeBundle() {
  const { locale } = useI18n();
  const home = useHome();
  const last = home.data?.last_race ?? null;
  const sessionId = last?.session_id ?? 0;
  const detail = useSessionDetail(sessionId, last !== null);
  const stints = useStints(sessionId, last?.has_data ?? false);
  const headlines = useHeadlines(locale, 12);
  const reports = useReports(3);
  const season = home.data?.season ?? null;
  const events = useSeasonEvents(season);
  const entries = [...(detail.data?.entries ?? [])]
    .filter((e) => e.finish_position != null)
    .sort((a, b) => (a.finish_position ?? 99) - (b.finish_position ?? 99));
  return {
    home,
    last,
    next: home.data?.next_event ?? null,
    drivers: home.data?.drivers ?? [],
    constructors: home.data?.constructors ?? [],
    season,
    entries,
    totalLaps: detail.data?.total_laps ?? entries[0]?.laps_completed ?? null,
    stints: new Map((stints.data ?? []).map((s) => [s.car_number, s])),
    headlines: headlines.data ?? [],
    reports: reports.data ?? [],
    events: events.data?.results ?? [],
  };
}

export type HomeBundle = ReturnType<typeof useHomeBundle>;

export function photoOf(entry: Entry): string | null {
  return entry.media?.driver_image_url ?? entry.driver.photo_url;
}

/** Gap to the winner as a timing sheet writes it: race time, gap, laps down or retirement. */
export function useGap() {
  const { t, f } = useI18n();
  return (entry: Entry, winner: Entry | undefined): string => {
    if (!winner || entry === winner) return f.lapTime(entry.race_time_s);
    if (!/^\d+$/.test(entry.classification ?? "")) {
      return entry.status ?? entry.classification ?? "—";
    }
    const down = (winner.laps_completed ?? 0) - (entry.laps_completed ?? 0);
    if (down > 0) return t("home.lapsDown", { laps: down });
    if (entry.race_time_s == null || winner.race_time_s == null) return "—";
    return `+${(entry.race_time_s - winner.race_time_s).toFixed(3)}`;
  };
}

/** Time left before `target`, as numbers to lay out. */
export function useCountdown(target: string) {
  const now = useClock(1000);
  return timeLeft(new Date(target).getTime(), now);
}

export function raceStart(event: Schema<"Event">): string {
  const race = event.sessions.find((s) => s.kind === "R");
  return race?.scheduled_start ?? `${event.race_date}T12:00:00Z`;
}

export const pad = (n: number) => String(n).padStart(2, "0");

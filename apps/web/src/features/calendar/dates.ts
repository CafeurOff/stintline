import type { Schema } from "@stintline/api-types";

const DAY_MS = 86_400_000;

/** "20–22 Nov" from the first scheduled session to race day (race day alone if unknown). */
export function weekendDates(event: Schema<"Event">, locale: string): string {
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const format = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: "UTC" });
  const raceDay = new Date(`${event.race_date}T12:00:00Z`);
  const starts = event.sessions
    .map((s) => s.scheduled_start)
    .filter((s): s is string => s !== null && s !== undefined)
    .map((s) => new Date(s))
    .sort((a, b) => a.getTime() - b.getTime());
  const first = starts[0];
  if (!first || first.getTime() >= raceDay.getTime() - DAY_MS / 2) return format.format(raceDay);
  return format.formatRange(first, raceDay);
}

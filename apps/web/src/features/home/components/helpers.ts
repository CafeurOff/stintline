import type { Schema } from "@stintline/api-types";
import type { CSSProperties } from "react";

import { initials } from "@/components/racing/initials";

export type Entry = Schema<"Entry">;
export type Line = Schema<"StandingLine">;
export type Event = Schema<"Event">;
export type Report = Schema<"RaceReport">;

/**
 * Font size that makes a word fill `pct` % of its container's width (container query units),
 * for the hollow watermarks: expanded heavy capitals and digits are about 0.9 em wide.
 */
export function fitWidth(word: string, pct: number): string {
  return `${(pct / (Math.max(word.length, 1) * 0.9)).toFixed(2)}cqw`;
}

export function glowStyle(colour: string, x = "100%", y = "100%"): CSSProperties {
  return { "--glow": colour, "--glow-x": x, "--glow-y": y } as CSSProperties;
}

export function photoOf(entry: { driver: Schema<"Driver">; media?: Schema<"Media"> | null }) {
  return entry.media?.driver_image_url ?? entry.driver.photo_url;
}

export function codeOf(driver: Schema<"Driver">): string {
  return driver.code ?? initials(driver.given_name, driver.family_name);
}

export function two(n: number): string {
  return String(n).padStart(2, "0");
}

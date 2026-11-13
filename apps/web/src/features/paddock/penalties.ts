import type { Schema } from "@stintline/api-types";

import type { MessageKey } from "@/lib/i18n/en";

type Ruling = Pick<
  Schema<"DecisionBrief">,
  | "time_penalty_s"
  | "drive_through"
  | "stop_go_s"
  | "grid_places"
  | "back_of_grid"
  | "pit_lane_start"
  | "penalty_points"
  | "reprimand"
  | "fine_eur"
  | "disqualified"
  | "lap_time_deleted"
  | "no_further_action"
>;

export type Tone = "penalty" | "warning" | "neutral";

export interface PenaltyTag {
  key: MessageKey;
  params?: Record<string, string | number>;
  tone: Tone;
}

/** What a ruling imposes, as short tags in reading order (heaviest first). */
export function penaltyTags(r: Ruling): PenaltyTag[] {
  const tags: PenaltyTag[] = [];
  if (r.disqualified) tags.push({ key: "penalty.dsq", tone: "penalty" });
  if (r.drive_through) tags.push({ key: "penalty.driveThrough", tone: "penalty" });
  if (r.stop_go_s)
    tags.push({ key: "penalty.stopGo", params: { s: r.stop_go_s }, tone: "penalty" });
  if (r.time_penalty_s)
    tags.push({ key: "penalty.time", params: { s: r.time_penalty_s }, tone: "penalty" });
  if (r.grid_places)
    tags.push({ key: "penalty.grid", params: { n: r.grid_places }, tone: "penalty" });
  if (r.back_of_grid) tags.push({ key: "penalty.backOfGrid", tone: "penalty" });
  if (r.pit_lane_start) tags.push({ key: "penalty.pitLane", tone: "penalty" });
  if (r.lap_time_deleted) tags.push({ key: "penalty.lapDeleted", tone: "penalty" });
  if (r.penalty_points)
    tags.push({ key: "penalty.points", params: { n: r.penalty_points }, tone: "warning" });
  if (r.reprimand) tags.push({ key: "penalty.reprimand", tone: "warning" });
  if (r.fine_eur) tags.push({ key: "penalty.fine", params: { eur: r.fine_eur }, tone: "warning" });
  if (r.no_further_action) tags.push({ key: "penalty.nfa", tone: "neutral" });
  return tags;
}

/** Retry delay asked by the relay (``Retry-After``), bounded. */
export function retryDelayMs(header: string | null, fallbackS = 10): number {
  const seconds = Number(header);
  return (Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 30) : fallbackS) * 1000;
}

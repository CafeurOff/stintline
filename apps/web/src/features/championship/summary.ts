import type { Schema } from "@stintline/api-types";

type Title = Schema<"Title">;
type Row = Title["drivers"][number];

export type TitleSummary =
  | { kind: "decided"; champion: Row; round: NonNullable<Title["decided"]>; spare: number }
  | {
      kind: "clinch";
      leader: Row;
      next: NonNullable<Title["next_round"]>;
      rivals: { rival: Row; margin: number }[];
    }
  | { kind: "open"; leader: Row; contenders: Row[]; title: Title }
  | null;

/**
 * What to say about a title fight: settled (with how many Grands Prix were still to run),
 * settable at the next round (and what the leader needs against each rival), or open.
 */
export function titleSummary(title: Title | undefined): TitleSummary {
  const leader = title?.drivers[0];
  if (!title || !leader) return null;
  if (title.decided && leader.status === "champion") {
    return {
      kind: "decided",
      champion: leader,
      round: title.decided,
      spare: title.races_done + title.races_left - title.decided.round,
    };
  }
  const rivals = title.drivers
    .filter((row) => row.clinch_margin != null)
    .map((row) => ({ rival: row, margin: row.clinch_margin ?? 0 }));
  if (title.next_round && rivals.length > 0) {
    return { kind: "clinch", leader, next: title.next_round, rivals };
  }
  return {
    kind: "open",
    leader,
    contenders: title.drivers.filter((row) => row.status === "contender"),
    title,
  };
}

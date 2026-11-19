import type { Schema } from "@stintline/api-types";

import { title } from "@/test/fixtures/title";

import { titleSummary } from "./summary";

type Title = Schema<"Title">;

function withLeader(changes: Partial<Title>, rows: Partial<Title["drivers"][number]>[]): Title {
  const base: Title = title;
  return {
    ...base,
    ...changes,
    drivers: base.drivers.map((row, index) => ({ ...row, ...rows[index] })),
  };
}

describe("titleSummary", () => {
  it("names the champion and the round it was settled at", () => {
    const summary = titleSummary(title);

    expect(summary?.kind).toBe("decided");
    if (summary?.kind !== "decided") return;
    expect(summary.champion.driver.code).toBe("NOR");
    expect(summary.round.name).toBe("Abu Dhabi Grand Prix");
    expect(summary.spare).toBe(0);
  });

  it("lists what the leader needs against each rival when the next round can settle it", () => {
    const next = {
      round: 23,
      event_id: 23,
      name: "Qatar Grand Prix",
      race_date: "2025-11-30",
      sprint: true,
    };
    const open = withLeader({ decided: null, next_round: next, races_left: 2, races_done: 22 }, [
      { status: "leader" },
      { status: "contender", clinch_margin: 9 },
      { status: "contender", clinch_margin: -3 },
    ]);

    const summary = titleSummary(open);

    expect(summary?.kind).toBe("clinch");
    if (summary?.kind !== "clinch") return;
    expect(summary.rivals.map((r) => [r.rival.driver.code, r.margin])).toEqual([
      ["VER", 9],
      ["PIA", -3],
    ]);
  });

  it("counts the contenders of an open fight, and says nothing without data", () => {
    const open = withLeader({ decided: null, next_round: null, races_left: 5 }, [
      { status: "leader" },
      { status: "contender" },
    ]);

    const summary = titleSummary(open);

    expect(summary?.kind).toBe("open");
    if (summary?.kind !== "open") return;
    expect(summary.contenders).toHaveLength(1);
    expect(titleSummary(undefined)).toBeNull();
    expect(titleSummary({ ...title, drivers: [] })).toBeNull();
  });
});

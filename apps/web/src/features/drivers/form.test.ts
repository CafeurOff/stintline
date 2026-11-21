import { driverForm } from "@/test/fixtures/hub";

import { type FormRace, finishOf, formSummary, placesGained } from "./form";

const base = driverForm.races[0] as FormRace;

function race(fields: Partial<FormRace>): FormRace {
  return { ...base, ...fields };
}

describe("driver form helpers", () => {
  it("counts only a numeric classification as a finish", () => {
    expect(finishOf(race({ classification: "3", finish_position: 3 }))).toBe(3);
    expect(finishOf(race({ classification: "R", finish_position: 17 }))).toBeNull();
  });

  it("gives places gained from the grid, none from the pit lane", () => {
    expect(placesGained(race({ grid_position: 5, classification: "2", finish_position: 2 }))).toBe(
      3,
    );
    expect(
      placesGained(race({ grid_position: 0, classification: "9", finish_position: 9 })),
    ).toBeNull();
    expect(
      placesGained(race({ grid_position: 4, classification: "D", finish_position: 19 })),
    ).toBeNull();
  });

  it("sums up the fixture's five Grands Prix", () => {
    const summary = formSummary(driverForm.races);

    expect(summary).toMatchObject({
      races: 5,
      wins: 2,
      podiums: 2,
      averageGrid: 2.2,
      averageFinish: 4.8,
      paced: 2,
      quicker: 1,
      teammate: "Piastri",
    });
    expect(summary.averageGap).toBeCloseTo(-0.013, 3);
  });

  it("names no teammate when the paced races were against different ones", () => {
    const other = { ...base.teammate, ref: "stand-in", family_name: "Reserve" } as const;
    const summary = formSummary([
      race({ pace_gap_s: 0.1 }),
      race({ pace_gap_s: -0.2, teammate: { ...other, given_name: "Res" } }),
    ]);

    expect(summary.teammate).toBeNull();
    expect(summary.averageGap).toBeCloseTo(-0.05, 3);
  });

  it("has no averages without a grid slot, finish or pace gap", () => {
    const summary = formSummary([
      race({ grid_position: null, classification: "W", finish_position: null, pace_gap_s: null }),
    ]);

    expect(summary).toMatchObject({
      averageGrid: null,
      averageFinish: null,
      averageGap: null,
      paced: 0,
      teammate: null,
    });
  });
});

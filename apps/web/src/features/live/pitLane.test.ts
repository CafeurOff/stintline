import { mean, teamAverages } from "./pitLane";

describe("teamAverages", () => {
  it("averages each team's pit-lane times, quickest first, and skips unknown cars", () => {
    const teams = new Map([
      [1, { team: "A", colour: "111111" }],
      [2, { team: "A", colour: "111111" }],
      [3, { team: "B", colour: "222222" }],
    ]);
    const stops = [
      { number: 1, lap: 10, pit_lane_duration_s: 22 },
      { number: 2, lap: 11, pit_lane_duration_s: 24 },
      { number: 3, lap: 12, pit_lane_duration_s: 21 },
      { number: 9, lap: 13, pit_lane_duration_s: 19 },
    ];

    const rows = teamAverages(stops, (n) => teams.get(n));

    expect(rows.map((r) => [r.team, r.average, r.stops])).toEqual([
      ["B", 21, 1],
      ["A", 23, 2],
    ]);
    expect(mean([1, 2, 3])).toBe(2);
  });
});

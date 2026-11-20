import { gapsByLap, placesGained, positionsByLap } from "./laps";

const clocks = [
  { carNumber: 1, lineTimes: [90, 180, 270], finished: true },
  { carNumber: 4, lineTimes: [91, 179, 272], finished: true },
  { carNumber: 16, lineTimes: [95], finished: false },
];

describe("lap analysis", () => {
  it("ranks cars by their line-crossing time on each lap", () => {
    const positions = positionsByLap(clocks, 3);

    expect(positions.get(1)).toEqual([1, 2, 1]);
    expect(positions.get(4)).toEqual([2, 1, 2]);
    expect(positions.get(16)).toEqual([3, null, null]);
  });

  it("measures gaps to the leader of each lap", () => {
    const gaps = gapsByLap(clocks, 3);

    expect(gaps.get(1)).toEqual([0, 1, 0]);
    expect(gaps.get(16)).toEqual([5, null, null]);
  });

  it("counts places gained from the grid, ignoring pit-lane starts", () => {
    expect(placesGained(10, 4)).toBe(6);
    expect(placesGained(2, 5)).toBe(-3);
    expect(placesGained(0, 5)).toBeNull();
    expect(placesGained(null, 5)).toBeNull();
  });
});

import { SECOND_DRIVER, duelColours, median, quantile, rollingMedian, share } from "./duel";

describe("duel helpers", () => {
  it("draws the second teammate in grey", () => {
    expect(duelColours("FF8000", "FF8000")).toEqual(["#ff8000", SECOND_DRIVER]);
    expect(duelColours("FF8000", "3671C6")).toEqual(["#ff8000", "#3671c6"]);
  });

  it("splits a tally, evenly when nothing was decided", () => {
    expect(share([3, 1])).toBe(0.75);
    expect(share([0, 0])).toBe(0.5);
  });

  it("takes medians and quantiles", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([1, 2, 3, 4, 5], 0.9)).toBeCloseTo(4.6);
  });

  it("smooths a lap series and keeps the gaps", () => {
    expect(rollingMedian([90, 100, 91, null, 92], 3)).toEqual([95, 91, 95.5, null, 92]);
  });
});

import { createFormatters } from "./format";

const en = createFormatters("en");
const fr = createFormatters("fr");

describe("createFormatters", () => {
  it("formats durations with the locale decimal separator", () => {
    expect(en.seconds(21.276)).toBe("21.3 s");
    expect(fr.seconds(21.276)).toBe("21,3 s");
    expect(fr.seconds(null)).toBe("—");
  });

  it("signs deltas with a true minus", () => {
    expect(en.delta(1.23)).toBe("+1.2 s");
    expect(fr.delta(-0.44)).toBe("−0,4 s");
    expect(en.delta(0.01)).toBe("±0.0 s");
  });

  it("formats lap times as minutes and seconds", () => {
    expect(en.lapTime(80.642)).toBe("1:20.642");
    expect(fr.lapTime(65.1)).toBe("1:05,100");
    expect(en.lapTime(21.3)).toBe("21.300");
    expect(en.lapTime(undefined)).toBe("—");
  });

  it("clamps probabilities at the extremes", () => {
    expect(en.probability(0.0001)).toBe("<1%");
    expect(en.probability(0.999)).toBe(">99%");
    expect(en.probability(0.364)).toBe("36%");
    expect(fr.percent(0.49)).toBe("49 %");
  });

  it("writes ordinals the way each language does", () => {
    expect([1, 2, 3, 4, 11, 22].map(en.ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "22nd",
    ]);
    expect([1, 5].map(fr.ordinal)).toEqual(["1er", "5e"]);
  });

  it("formats race dates in UTC and milliseconds", () => {
    expect(en.date("2025-08-03")).toBe("3 Aug 2025");
    expect(fr.date("2025-08-03")).toBe("3 août 2025");
    expect(en.millis(0.0447)).toBe("45 ms");
  });
});

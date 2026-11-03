import {
  formatDate,
  formatDelta,
  formatLapTime,
  formatPercent,
  formatPosition,
  formatProbability,
  formatSeconds,
} from "./format";

describe("formatLapTime", () => {
  it("formats minutes, seconds and milliseconds", () => {
    expect(formatLapTime(80.642)).toBe("1:20.642");
  });

  it("pads seconds below ten", () => {
    expect(formatLapTime(65.1)).toBe("1:05.100");
  });

  it("omits minutes under a minute", () => {
    expect(formatLapTime(21.3)).toBe("21.300");
  });

  it("renders missing values as an em dash", () => {
    expect(formatLapTime(null)).toBe("—");
    expect(formatLapTime(Number.NaN)).toBe("—");
  });
});

describe("formatDelta", () => {
  it("uses a plus sign for gains and a true minus for losses", () => {
    expect(formatDelta(0.123)).toBe("+0.12 s");
    expect(formatDelta(-1.3)).toBe("−1.30 s");
  });

  it("shows ± when the rounded value is zero", () => {
    expect(formatDelta(0.001)).toBe("±0.00 s");
  });
});

describe("formatProbability", () => {
  it("clamps the extremes", () => {
    expect(formatProbability(0.0001)).toBe("<1%");
    expect(formatProbability(0.999)).toBe(">99%");
  });

  it("rounds to a whole percentage", () => {
    expect(formatProbability(0.364)).toBe("36%");
  });
});

describe("small formatters", () => {
  it("format seconds, ratios, positions and dates", () => {
    expect(formatSeconds(21.276)).toBe("21.3 s");
    expect(formatSeconds(null)).toBe("—");
    expect(formatPercent(0.49)).toBe("49%");
    expect(formatPosition(4)).toBe("P4");
    expect(formatPosition(null)).toBe("—");
    expect(formatDate("2025-08-03")).toBe("3 Aug 2025");
  });
});
